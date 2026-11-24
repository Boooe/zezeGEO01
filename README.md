# 星河GEO · 私有化部署说明（README）

本仓库是「星河GEO」客户交付后台的全量代码与配套物料。应用原本运行在飞书妙搭（Miaoda）托管环境，本文说明**在自有云服务器上从零拉起同一套服务**需要装什么、配什么、跑什么命令，以及哪些地方需要额外改造。

> 结论先说：代码是完整可编译的前后端源码，**不需要**妙搭平台才能编译；但它依赖一个平台运行时包 `@lark-apaas/fullstack-nestjs-core`（已在公共 npm 可安装），并且**数据库必须是 PostgreSQL**。按本文步骤可以跑起来，鉴权/CSRF 这类平台中间件需要用环境变量显式关闭或替换。

---

## 1. 仓库结构

| 路径 | 内容 | 部署是否需要 |
|---|---|---|
| `app_src/` | 应用源码（前端 `client/`、后端 `server/`、共享类型 `shared/`、构建脚本 `scripts/`、数据库定义 `server/database/`） | **是，部署只用这一套** |
| `dist/`、`dist_ondir/` | 已打包的「星河GEO发布客户端」桌面版（PyInstaller 产物） | 否，是交付物料 |
| `geo-publish-client.py` | 发布客户端 Python 源 | 否（除非要改客户端） |
| `巡检/`、`录屏帧/`、`星河GEO.ico` | 交付物料、图标 | 否 |

---

## 2. 云服务器环境要求

已在本机云主机实测确认过的：Ubuntu 22.04、Node v22.23.4、npm 10.9.9、git 2.34.1 可用；**PostgreSQL 未预装，需要自己装**。

| 组件 | 版本要求 | 说明 |
|---|---|---|
| 操作系统 | Linux（Ubuntu 22.04+ / Debian 12+） | `scripts/*.sh` 是 bash 脚本，Windows 需 WSL |
| Node.js | **>= 22.0.0**（`engines` 硬性声明） | 推荐 22 LTS；Node 20 可能因引擎校验告警 |
| npm | **>= 10.0.0** | 随 Node 22 自带 |
| PostgreSQL | **14+**（推荐 16） | 代码用 `PostgresJsDatabase`，DDL 用到 `gen_random_uuid()`、`UUID`、`JSONB` |
| Redis | 可选 | 不配只会在日志里告警「cache-service effectively disabled」 |
| 端口 | 默认 **3000** | 可用 `SERVER_PORT` 改 |
| 内存/磁盘 | 建议 ≥ 2C4G，磁盘 ≥ 20G | `npm ci` 依赖体积较大，含 swc/vite/pdfkit |

```bash
# Node 22（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

> 国内网络建议给 npm 配镜像：`npm config set registry https://registry.npmmirror.com/`（仓库的 `package-lock.json` 里的 resolved 地址就是 npmmirror）。

---

## 3. 依赖说明

`app_src/package.json` 的运行时依赖只有 24 个，其中**唯一与平台绑定的是**：

- `@lark-apaas/fullstack-nestjs-core` `^1.1.79` —— 已确认可从公共 npm 安装（`registry.npmmirror.com` 上有 `1.1.79`，还有 alpha/beta 通道）。它负责：
  - 注入数据库客户端 `DRIZZLE_DATABASE`（内部读 `SUDA_DATABASE_URL`）
  - 注册缓存模块（内部读 `MIAODA_CACHE_URL`）
  - `configureApp(app)`：body-parser、cookie、CSRF、全局前缀、公共静态资源、平台鉴权中间件（AuthNPaas / DataPaas）

其余为常规依赖：`@nestjs/*` 10.x、`drizzle-orm` 0.45、`pdfkit`、`bcryptjs`、`dayjs`、`ws`、`h3`/`react`/`vite` 等，全部公开可装。

**不要直接用这两个默认脚本**（它们会联网调用妙搭 CLI，脱离平台会失败）：

- `npm run dev` → `scripts/dev.sh`，内部会尝试 `npx @lark-apaas/miaoda-cli app sync`
- `npm run build` → `scripts/build.sh`，内部会 `npx fullstack-cli action-plugin init`

自建环境请用 `npm run build:prod`（= `build:server` + `build:client`，纯 nest + vite）。

---

## 4. 环境变量

复制 `app_src/.env.example` 为 `app_src/.env`，按下表补齐。以下变量均已在源码/SDK 中核实存在。

### 4.1 必须

| 变量 | 示例 | 作用 |
|---|---|---|
| `SUDA_DATABASE_URL` | `postgres://geo:pass@127.0.0.1:5432/geo` | PostgreSQL 连接串，平台 SDK 用它创建 Drizzle 连接池 |
| `SERVER_HOST` | `0.0.0.0` | 监听地址（默认 `localhost`，容器/服务器要改） |
| `SERVER_PORT` | `3000` | 监听端口 |
| `NODE_ENV` | `production` | 生产模式；会启用进程守护与静态资源中间件 |
| `AI_PROVIDER` | `deepseek` / `dashscope` / `ark` | **不能再用默认 `platform`**（平台内置 AI 在自建环境不可用） |
| `AI_API_KEY` | `sk-xxxx` | 对应厂商 Key（火山方舟 / 通义 / DeepSeek 均可） |
| `AI_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3` | 厂商兼容接口地址 |
| `AI_MODEL` | `doubao-seed-2-1-pro` / `qwen-plus` / `deepseek-chat` | 模型名，按厂商实际模型填写 |

### 4.2 建议/按需

| 变量 | 默认 | 作用 |
|---|---|---|
| `MIAODA_CACHE_URL` | 空 | Redis 连接串，`redis://127.0.0.1:6379`；不填仅告警 |
| `FORCE_FRAMEWORK_DISABLE_DATAPASS` | 未设 | 置 `true` 时**跳过平台 AuthNPaas/DataPaas 中间件**，自建环境通常必须开启，否则请求会走平台鉴权链路 |
| `CLIENT_BASE_PATH` | 空 | 部署在子路径（如 `/geo`）时设置全局前缀 |
| `BODY_SIZE_LIMIT` | `1mb` | 请求体上限，上传大文件时调大 |
| `MIAODA_APP_ID` | 空 | 部分平台能力（如文件存储）读它，自建可留空 |
| `CHROMIUM_PATH` | 空 | 若启用自动发布/网页抓取，指定本地 Chromium 可执行文件路径 |

---

## 5. 从 GitHub 拉代码并启动（分步）

```bash
# 1) 拉代码（仓库为私有库，需 PAT 或 SSH）
git clone https://github.com/Boooe/zezeGEO01.git
cd zezeGEO01/app_src

# 2) 安装依赖
npm ci

# 3) 建库与建表
sudo -u postgres createuser -P geo            # 设密码
sudo -u postgres createdb -O geo geo
psql "postgres://geo:pass@127.0.0.1:5432/geo" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 4) 建表：两种方式二选一
#    a. 用仓库内的增量 DDL（按文件名顺序执行）
for f in server/database/ddl/*.sql; do psql "postgres://geo:pass@127.0.0.1:5432/geo" -f "$f"; done
#    b. 用 Drizzle 定义一键推表（server/database/schema.ts，132KB，覆盖全部表）
npx -y drizzle-kit push --dialect postgresql \
  --schema ./server/database/schema.ts \
  --url "postgres://geo:pass@127.0.0.1:5432/geo"

# 5) 配环境变量
cp .env.example .env && vi .env     # 按第 4 节填

# 6) 编译（不要用 npm run build，原因见第 3 节）
npm run build:prod

# 7) 生产启动（产物在 dist/，必须从 dist/ 目录启动）
cd dist
NODE_ENV=production SUDA_DATABASE_URL="postgres://geo:pass@127.0.0.1:5432/geo" \
FORCE_FRAMEWORK_DISABLE_DATAPASS=true \
node server/main.js
```

> 编译产物：`dist/server/main.js`（后端）、`dist/client/`（前端静态资源，由应用自己托管，不需要额外静态服务器）。`scripts/run.sh` 就是上面第 7 步的封装。

### 5.1 systemd 常驻

```ini
# /etc/systemd/system/xinghe-geo.service
[Unit]
Description=Xinghe GEO Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/zezeGEO01/app_src/dist
EnvironmentFile=/opt/zezeGEO01/app_src/.env
Environment=NODE_ENV=production
Environment=SUDA_DATABASE_URL=postgres://geo:pass@127.0.0.1:5432/geo
Environment=FORCE_FRAMEWORK_DISABLE_DATAPASS=true
ExecStart=/usr/bin/node server/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now xinghe-geo
sudo systemctl status xinghe-geo
```

### 5.2 Nginx 反代（可选，建议上 HTTPS）

```nginx
server {
  listen 80;
  server_name geo.example.com;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 5.3 启动自检

```bash
curl -s http://127.0.0.1:3000/api/auth/me
# 期望：{"user":null}（未登录态，说明服务与数据库链路都通了）
curl -sI http://127.0.0.1:3000/ | head -1
# 期望：HTTP/1.1 200 OK（前端页面正常返回）
```

---

## 6. 自建部署的已知限制（务必先看）

1. **平台鉴权中间件**：SDK 的 `PlatformModule` 默认会挂 `AuthNPaasModule` 与 `DataPaasModule`，它们原本依赖妙搭注入的平台凭据。自建环境需设 `FORCE_FRAMEWORK_DISABLE_DATAPASS=true` 跳过；应用自身的登录态（`POST /api/auth/login`、Bearer Token、30 天会话）是自建 JWT 逻辑，不依赖平台。
2. **CSRF 双提交**：托管环境由平台 `CsrfMiddleware` 校验 `suda-csrf-token` cookie 与 `x-suda-csrf-token` 头；跳过 DataPaas 后该校验链路随之失效，前端已做自举容错，但仍建议在网关层补同源校验。
3. **建表口径**：`server/database/schema.ts` 是平台 `db-schema-sync` 生成的 Drizzle 定义，`server/database/ddl/*.sql` 是业务增量脚本（含 `geo_commitment.sql`、`geo_creation_unified.sql`、`geo_credit_*.sql`、`geo_publication_records.sql`、`003_video_image_config.sql`）。自建时以 schema.ts 推表为准，再跑增量 DDL 补齐。
4. **平台专属能力**：文件/对象存储、妙搭内置 AI（`AI_PROVIDER=platform`）、部分消息通知需要在自建侧替换。AI 能力请改用自己的 Key（火山/通义/DeepSeek 均可）。
5. **连接凭据文件**：SDK 里还有一条 `connectionTokenFilePath: /var/run/secrets/zti/credential` 的兜底路径（平台 K8s 注入）；自建环境该文件不存在时走 `SUDA_DATABASE_URL`，不影响启动。
6. **未完成端到端验证**：本文的版本要求、依赖来源、环境变量名均来自对源码与 SDK（1.1.79）的实际核查，但**尚未在自有云主机上完成「装库→推表→编译→起服务→登录走查」的全链路验证**。首次部署建议按第 5 节顺序逐步确认，任何一步报错把日志发我。

---

## 7. 与托管环境的关系

| 方式 | 状态 | 适用 |
|---|---|---|
| 妙搭托管（`app.app_17hwmq4p6qy`） | 已上线，全功能验证过 | 现在对外售卖、给客户演示 |
| 自有云主机自建 | 代码齐备，按本文可编译启动，需完成首次联调 | 客户要求私有化/独立域名/等保时 |

两份代码同源：本仓库 `app_src/` 即托管环境当前运行源码的导出，提交历史见 `git log`。

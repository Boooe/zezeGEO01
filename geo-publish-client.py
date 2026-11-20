#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
星河GEO 发布客户端
用于本地半自动发布文章到各内容平台

用法:
  python geo-publish-client.py --help
  python geo-publish-client.py bind <授权码>
  python geo-publish-client.py run
  python geo-publish-client.py status
  python geo-publish-client.py unbind
"""

import argparse
import base64
import hashlib
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

CONFIG_DIR = Path.home() / ".geo_publish_client"
CONFIG_FILE = CONFIG_DIR / "config.json"
TASKS_DIR = CONFIG_DIR / "tasks"

DEFAULT_SERVER = "https://4mdyqq3k3dr8c.doubaoapps.com/app/app_17hwmq4p6qy"

# 自定义协议：网页点「打开客户端」时用 xinghegeo://open 唤起本机 exe
URI_SCHEME = "xinghegeo"

HEARTBEAT_INTERVAL = 60
POLL_INTERVAL = 30


def fetch_csrf_token(base_url: str) -> str | None:
    """访问应用首页，从 Set-Cookie 里取 suda-csrf-token。"""
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(__import__("http.cookiejar", fromlist=["CookieJar"]).CookieJar())
    )
    try:
        with opener.open(base_url.rstrip("/") + "/accounts", timeout=15) as resp:
            for header in resp.headers.get_all("Set-Cookie") or []:
                if header.lower().startswith("suda-csrf-token="):
                    return header.split(";")[0].split("=", 1)[1]
    except Exception:
        return None
    return None


def api_request(base_url: str, path: str, method: str = "GET",
                data: dict | None = None, token: str | None = None,
                csrf: str | None = None) -> dict:
    url = base_url.rstrip("/") + path
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Client-Token", token)
    if csrf:
        req.add_header("x-suda-csrf-token", csrf)
        req.add_header("Cookie", f"suda-csrf-token={csrf}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_body = resp.read().decode("utf-8")
            return json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            err = json.loads(err_body)
            msg = err.get("error", {}).get("message", str(e))
        except Exception:
            msg = err_body[:200]
        print(f"[错误] 请求失败: {e.code} {msg}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"[错误] 网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[警告] 配置文件读取失败: {e}", file=sys.stderr)
        return {}


def save_config(config: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except Exception:
        pass


def cmd_bind(args) -> None:
    base_url = args.server.rstrip("/")
    auth_code = args.code.strip()

    print(f"正在绑定授权码: {auth_code}")
    print(f"服务器: {base_url}")

    result = api_request(
        base_url,
        "/api/publish-client/bind",
        method="POST",
        data={
            "authCode": auth_code,
            "clientVersion": "1.0.0",
        },
    )

    config = {
        "server": base_url,
        "token": result["token"],
        "accountId": result["accountId"],
        "platform": result["platform"],
        "accountName": result["accountName"],
        "boundAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    save_config(config)

    print(f"\n[成功] 绑定完成！")
    print(f"  平台: {result['platform']}")
    print(f"  账号: {result['accountName']}")
    print(f"  配置已保存到: {CONFIG_FILE}")
    print(f"\n执行以下命令开始监听任务:")
    print(f"  python {sys.argv[0]} run")


def cmd_status(_args) -> None:
    config = load_config()
    if not config.get("token"):
        print("[未绑定] 尚未绑定任何账号，请先执行 bind 命令")
        return

    print("=== 客户端状态 ===")
    print(f"  服务器: {config.get('server', '-')}")
    print(f"  平台: {config.get('platform', '-')}")
    print(f"  账号: {config.get('accountName', '-')}")
    print(f"  账号ID: {config.get('accountId', '-')}")
    print(f"  绑定时间: {config.get('boundAt', '-')}")

    try:
        result = api_request(
            config["server"],
            "/api/publish-client/heartbeat",
            method="POST",
            data={"token": config["token"], "clientVersion": "1.0.0"},
        )
        print(f"  连接状态: 在线 (心跳正常)")
    except SystemExit:
        print(f"  连接状态: 离线 (心跳失败)")


def cmd_unbind(_args) -> None:
    config = load_config()
    if not config.get("token"):
        print("尚未绑定，无需解绑")
        return

    confirm = input(f"确认解绑账号「{config.get('accountName')}」？(y/N): ")
    if confirm.lower() != "y":
        print("已取消")
        return

    if CONFIG_FILE.exists():
        backup = CONFIG_FILE.with_suffix(".bak")
        CONFIG_FILE.rename(backup)
        print(f"已解绑，配置已备份到 {backup}")
    else:
        print("已解绑")


LOGIN_URLS = {
    "baijiahao": "https://baijiahao.baidu.com/builder/rc/home",
    "toutiao": "https://mp.toutiao.com/profile_v4/graphic/publish",
    "sohu": "https://mp.sohu.com/",
    "wangyi": "https://mp.163.com/login",
    "zhihu": "https://www.zhihu.com/signin",
    "wechat": "https://mp.weixin.qq.com/",
    "douyin": "https://creator.douyin.com/",
    "xiaohongshu": "https://creator.xiaohongshu.com/login",
    "weibo": "https://weibo.com/login.php",
    "bilibili": "https://passport.bilibili.com/login",
}

PLATFORM_NAMES = {
    "baijiahao": "百家号", "toutiao": "今日头条", "sohu": "搜狐号",
    "wangyi": "网易号", "zhihu": "知乎", "wechat": "微信公众号",
    "douyin": "抖音", "xiaohongshu": "小红书", "weibo": "微博",
    "bilibili": "B站",
}


LOGIN_COOKIES = {
    "baijiahao": ["BDUSS"],
    "zhihu": ["z_c0"],
    "toutiao": ["sessionid", "sid_tt"],
    "wechat": ["slave_sid", "bizuin"],
    "douyin": ["sessionid", "sid_tt"],
    "xiaohongshu": ["web_session"],
    "weibo": ["SUB"],
    "bilibili": ["SESSDATA"],
    "sohu": ["SUV", "ppinf"],
    "wangyi": ["P_INFO"],
}

EDITOR_URLS = {
    "baijiahao": "https://baijiahao.baidu.com/builder/rc/edit?type=news",
    "zhihu": "https://zhuanlan.zhihu.com/write",
    "toutiao": "https://mp.toutiao.com/profile_v4/graphic/publish",
    "sohu": "https://mp.sohu.com/mpfe/v3/main/news/addnews",
    "xiaohongshu": "https://creator.xiaohongshu.com/publish/publish",
    "weibo": "https://weibo.com/",
}


def find_chromium() -> str | None:
    env = os.environ
    candidates = [
        os.path.join(env.get("PROGRAMFILES", ""), r"Google\Chrome\Application\chrome.exe"),
        os.path.join(env.get("PROGRAMFILES(X86)", ""), r"Google\Chrome\Application\chrome.exe"),
        os.path.join(env.get("LOCALAPPDATA", ""), r"Google\Chrome\Application\chrome.exe"),
        os.path.join(env.get("PROGRAMFILES", ""), r"Microsoft\Edge\Application\msedge.exe"),
        os.path.join(env.get("PROGRAMFILES(X86)", ""), r"Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    return None


class _WebSocket:
    """最小可用的 WebSocket 客户端，只用于 Chrome DevTools Protocol。"""

    def __init__(self, host: str, port: int, path: str):
        self.sock = socket.create_connection((host, port), timeout=10)
        key = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WebSocket 握手失败：连接被关闭")
            head += chunk
        if b"101" not in head.split(b"\r\n")[0]:
            raise RuntimeError("WebSocket 握手失败：" + head[:120].decode(errors="replace"))

    def send_json(self, obj: dict) -> None:
        data = json.dumps(obj).encode()
        mask = os.urandom(4)
        header = bytearray([0x81])
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack("!H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack("!Q", n)
        header += mask
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + payload)

    def _recv_exact(self, size: int) -> bytes:
        buf = b""
        while len(buf) < size:
            chunk = self.sock.recv(size - len(buf))
            if not chunk:
                raise RuntimeError("WebSocket 连接中断")
            buf += chunk
        return buf

    def recv_json(self, timeout: float = 10) -> dict | None:
        self.sock.settimeout(timeout)
        first = self._recv_exact(2)
        opcode = first[0] & 0x0F
        masked = first[1] & 0x80
        length = first[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]
        if masked:
            self._recv_exact(4)
        body = self._recv_exact(length)
        if opcode == 0x1:
            return json.loads(body.decode("utf-8", errors="replace"))
        if opcode == 0x9:
            self.sock.sendall(bytes([0x8A]) + struct.pack("!B", len(body)) + body)
        return None


class Browser:
    """独立的 Chrome/Edge 实例，带 CDP，用于读取登录态和执行自动发布。"""

    def __init__(self, port: int | None = None):
        exe = find_chromium()
        if not exe:
            raise RuntimeError("未找到 Chrome 或 Edge，无法自动读取登录态")
        self.port = port or self._free_port()
        self.profile = tempfile.mkdtemp(prefix="geo_client_")
        self.proc = subprocess.Popen(
            [
                exe,
                f"--remote-debugging-port={self.port}",
                f"--user-data-dir={self.profile}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-popup-blocking",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self.ws = None
        self._msg_id = 0
        self._connect()

    @staticmethod
    def _free_port() -> int:
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    def _connect(self) -> None:
        deadline = time.time() + 20
        last_err = None
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{self.port}/json/list", timeout=3
                ) as resp:
                    targets = json.loads(resp.read().decode())
                page = next((t for t in targets if t.get("type") == "page"), None)
                if page is None:
                    raise RuntimeError("浏览器还没有可用页面")
                ws_url = page["webSocketDebuggerUrl"]
                self.ws = _WebSocket("127.0.0.1", self.port, "/" + ws_url.split("/", 3)[-1])
                self.call("Network.enable")
                self.call("Page.enable")
                return
            except Exception as e:  # 浏览器启动需要时间
                last_err = e
                time.sleep(0.6)
        raise RuntimeError(f"无法连接浏览器调试端口: {last_err}")

    def call(self, method: str, params: dict | None = None, timeout: float = 15) -> dict:
        self._msg_id += 1
        mid = self._msg_id
        self.ws.send_json({"id": mid, "method": method, "params": params or {}})
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = self.ws.recv_json(timeout=max(0.5, deadline - time.time()))
            if not msg:
                continue
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method} 失败: {msg['error']}")
                return msg.get("result", {})
        raise RuntimeError(f"{method} 超时")

    def navigate(self, url: str, wait: float = 3) -> None:
        self.call("Page.navigate", {"url": url})
        time.sleep(wait)

    def cookies(self) -> list[dict]:
        return self.call("Network.getAllCookies").get("cookies", [])

    def set_cookies(self, cookie_text: str, domain_hint: str) -> int:
        count = 0
        for pair in cookie_text.split(";"):
            if "=" not in pair:
                continue
            name, value = pair.split("=", 1)
            name, value = name.strip(), value.strip()
            if not name:
                continue
            try:
                self.call("Network.setCookie", {
                    "name": name, "value": value, "domain": domain_hint,
                    "path": "/", "secure": True,
                })
                count += 1
            except Exception:
                pass
        return count

    def evaluate(self, expression: str) -> dict:
        return self.call("Runtime.evaluate", {
            "expression": expression, "awaitPromise": True, "returnByValue": True,
        }).get("result", {})

    def close(self) -> None:
        try:
            if self.ws:
                self.ws.sock.close()
        except Exception:
            pass
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass


def browser_capture_cookie(platform: str, timeout: int = 240) -> str:
    """打开独立浏览器窗口让用户登录，登录后直接读取该平台 cookie，无需手工粘贴。"""
    login_url = LOGIN_URLS.get(platform)
    if not login_url:
        raise RuntimeError(f"暂无 {platform} 的登录地址配置")
    cookies_needed = LOGIN_COOKIES.get(platform, [])

    browser = Browser()
    try:
        browser.navigate(login_url, wait=2)
        print()
        print("  已打开独立登录窗口（与你自己日常浏览器互不影响）")
        print("  请在这个窗口里扫码 / 登录该平台账号，登录成功后会自动读取登录态")
        print(f"  最长等待 {timeout} 秒，按 Ctrl+C 可取消")
        print()

        deadline = time.time() + timeout
        captured: list[dict] = []
        while time.time() < deadline:
            time.sleep(2)
            all_cookies = browser.cookies()
            host = urllib.parse.urlparse(login_url).hostname or ""
            host_root = ".".join(host.split(".")[-2:])
            relevant = [c for c in all_cookies if host_root in (c.get("domain") or "")]
            matched = [c for c in relevant if c.get("name") in cookies_needed]
            if matched:
                captured = relevant
                break
            print(f"  等待登录中… 已检测到 {len(relevant)} 条 cookie", end="\r")
        print()
        if not captured:
            raise RuntimeError("等待超时，未检测到登录态，请重试")
        cookie_text = "; ".join(f"{c['name']}={c['value']}" for c in captured)
        print(f"  已读取登录态：{len(captured)} 条 cookie，命中关键字段 {', '.join(cookies_needed)}")
        return cookie_text
    finally:
        browser.close()


def _http_get(url: str, cookie: str | None = None, timeout: int = 15) -> tuple[int, str]:
    req = urllib.request.Request(url, method="GET")
    req.add_header(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    )
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(4096).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return 0, ""


def cookie_alive(platform: str, cookie: str) -> bool:
    """带 cookie 请求平台首页，判断登录态是否仍然有效。"""
    url = LOGIN_URLS.get(platform or "")
    if not url or not cookie:
        return False
    status, body = _http_get(url, cookie)
    if status in (301, 302, 303):
        return False
    if status != 200:
        return False
    lowered = body.lower()
    for marker in ("请登录", "立即登录", "passport.", "login"):
        if marker in lowered:
            return False
    return True


def read_cookie_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def prompt_cookie(platform: str) -> str:
    name = PLATFORM_NAMES.get(platform, platform or "目标平台")
    url = LOGIN_URLS.get(platform or "")
    print()
    print(f"  请在浏览器中打开并登录 {name}：")
    print(f"    {url}")
    print()
    print("  登录成功后取登录态（两种任选）：")
    print("    A. 按 F12 打开开发者工具 → Application/应用 → Cookies → 选中该站点")
    print("       → 右键任意一条 → Copy all as text，把结果整段粘贴回来")
    print("    B. 直接粘贴形如  BDUSS=xxx; STOKEN=yyy  的 cookie 字符串")
    print("  注意：这里只上传登录态，不会上传你的账号密码。")
    print()
    cookie = input("  粘贴 cookie（回车跳过）: ").strip()
    return cookie


def cmd_auth(args) -> None:
    base_url = args.server.rstrip("/")
    code = args.code.strip()

    print("=== 星河GEO 账号授权（扫码登录回传登录态） ===")
    print(f"  服务器: {base_url}")
    print(f"  授权码: {code}")

    csrf = fetch_csrf_token(base_url)
    if not csrf:
        print("[错误] 无法从服务器获取 csrf token，请检查服务器地址", file=sys.stderr)
        sys.exit(1)

    resolve = api_request(
        base_url, f"/api/account-auths/resolve-code?code={urllib.parse.quote(code)}",
        csrf=csrf,
    )
    account_id = resolve.get("accountId") or args.account
    platform = (resolve.get("platform") or args.platform or "").strip()
    if not account_id:
        print("[错误] 授权码无效或已过期，请回到后台重新生成", file=sys.stderr)
        sys.exit(1)

    print(f"  账号ID: {account_id}")
    print(f"  平台: {PLATFORM_NAMES.get(platform, platform or '-')}")

    if args.cookie_file:
        cookie = read_cookie_file(args.cookie_file)
    elif args.cookie:
        cookie = args.cookie.strip()
    elif args.manual:
        if platform in LOGIN_URLS:
            try:
                webbrowser.open(LOGIN_URLS[platform])
            except Exception:
                pass
        cookie = prompt_cookie(platform)
    else:
        try:
            print("  正在启动独立登录窗口，自动读取登录态…")
            cookie = browser_capture_cookie(platform)
        except KeyboardInterrupt:
            print("\n  已取消自动读取，改为手动粘贴")
            cookie = prompt_cookie(platform)
        except Exception as e:
            print(f"  [提示] 自动读取失败（{e}），改为手动粘贴")
            if platform in LOGIN_URLS:
                try:
                    webbrowser.open(LOGIN_URLS[platform])
                except Exception:
                    pass
            cookie = prompt_cookie(platform)

    if not cookie:
        print("[取消] 未提供登录态，授权未完成", file=sys.stderr)
        sys.exit(1)

    alive = cookie_alive(platform, cookie)
    if alive:
        print("  登录态自检: 未发现未登录跳转（启发式检查，最终以后台心跳为准）")
    else:
        print("  登录态自检: 检测到未登录/失效迹象，建议重新登录后再回传")

    expires = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 30 * 86400))
    result = api_request(
        base_url,
        f"/api/account-auths/{account_id}/session",
        method="POST",
        data={
            "authMode": "qr" if not args.mode else args.mode,
            "cookieText": cookie,
            "platformAccountName": args.account_name or PLATFORM_NAMES.get(platform, platform),
            "expiresAt": expires,
            "clientVersion": "1.1.0",
        },
        csrf=csrf,
    )

    config = load_config()
    config.update({
        "server": base_url,
        "accountId": account_id,
        "platform": platform,
        "accountName": args.account_name or PLATFORM_NAMES.get(platform, platform),
        "cookie": cookie,
        "cookieSavedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "expiresAt": expires,
    })
    save_config(config)

    print()
    print("[成功] 登录态已回传，后台账号状态应变为「已授权」")
    print(f"  有效期至: {expires[:10]}")
    print(f"  登录态已存本机: {CONFIG_FILE}（仅本机可读，不上传密码）")
    print("  之后可执行: python geo-publish-client.py check   # 复查登录态是否仍有效")


def cmd_check(args) -> None:
    base_url = args.server.rstrip("/")
    config = load_config()
    cookie = config.get("cookie", "")
    account_id = config.get("accountId", "")
    platform = config.get("platform", "")
    if not (cookie and account_id):
        print("[错误] 本机没有保存登录态，请先执行 auth 授权", file=sys.stderr)
        sys.exit(1)

    alive = cookie_alive(platform, cookie)
    print(f"  平台: {PLATFORM_NAMES.get(platform, platform)}  登录态: {'未发现失效迹象' if alive else '已失效'}")

    csrf = fetch_csrf_token(base_url)
    api_request(
        base_url,
        f"/api/account-auths/{account_id}/heartbeat",
        method="POST",
        data={"ok": alive, "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        csrf=csrf,
    )
    if not alive:
        print("  已上报后台为「登录态已失效」，请在后台重新生成授权码后再次 auth")
        sys.exit(2)


def save_task_file(task: dict) -> Path:
    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    task_id = task["id"]
    safe_title = "".join(
        c for c in task["title"] if c.isalnum() or c in "-_ "
    ).strip()[:50] or "untitled"
    filename = f"{task_id[:8]}_{safe_title}.txt"
    filepath = TASKS_DIR / filename

    content = f"""标题: {task['title']}
平台: {task.get('platform', '-')}
账号: {task.get('accountName', '-')}
渠道: {task.get('channelName', '-')}
标签: {', '.join(task.get('tags', []))}
任务ID: {task['id']}
领取时间: {task.get('claimedAt', '-')}

========== 正文 ==========

{task.get('content', '(无正文)')}

========== 操作指南 ==========

1. 打开对应平台后台编辑器页面
2. 将上方标题和正文粘贴到编辑器
3. 发布后，将公网链接粘贴到下面命令中

"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


def open_editor(platform: str | None) -> None:
    urls = {
        "baijiahao": "https://baijiahao.baidu.com/builder/rc/home",
        "toutiao": "https://mp.toutiao.com/profile_v4/graphic/publish",
        "sohu": "https://mp.sohu.com/mpfe/v3/main/news/addnews",
        "wangyi": "https://dy.163.com/article/article-add.html",
        "zhihu": "https://zhuanlan.zhihu.com/write",
        "wechat": "https://mp.weixin.qq.com/",
        "douyin": "https://creator.douyin.com/creator-micro/content/publish",
        "xiaohongshu": "https://creator.xiaohongshu.com/publish/publish",
        "weibo": "https://weibo.com/",
        "bilibili": "https://member.bilibili.com/platform/upload/text",
    }
    url = urls.get(platform or "")
    if url:
        try:
            webbrowser.open(url)
            print(f"  已打开 {platform} 后台编辑器")
        except Exception:
            print(f"  请手动打开: {url}")
    else:
        print(f"  请手动打开对应平台的后台编辑器")


def process_task(config: dict, task: dict) -> None:
    print(f"\n{'='*50}")
    print(f"[新任务] {task['title']}")
    print(f"  平台: {task.get('platform', '-')}")
    print(f"  账号: {task.get('accountName', '-')}")

    filepath = save_task_file(task)
    print(f"  内容已保存到: {filepath}")
    print()

    open_editor(task.get("platform"))
    print()
    print("请在平台编辑器中粘贴内容并发布")
    print()

    while True:
        choice = input("发布完成？输入 [Y] 已发布并填链接 / [s] 跳过 / [q] 退出: ").strip().lower()
        if choice in ("y", "yes", ""):
            break
        elif choice == "s":
            print("跳过此任务")
            api_request(
                config["server"],
                f"/api/publish-client/task/{task['id']}/result",
                method="POST",
                data={
                    "token": config["token"],
                    "taskId": task["id"],
                    "success": False,
                    "error": "用户跳过",
                },
            )
            return
        elif choice == "q":
            print("退出")
            sys.exit(0)

    publish_url = input("请输入发布后的公网链接: ").strip()
    if not publish_url:
        print("链接不能为空，标记为失败")
        api_request(
            config["server"],
            f"/api/publish-client/task/{task['id']}/result",
            method="POST",
            data={
                "token": config["token"],
                "taskId": task["id"],
                "success": False,
                "error": "未提供发布链接",
            },
        )
        return

    result = api_request(
        config["server"],
        f"/api/publish-client/task/{task['id']}/result",
        method="POST",
        data={
            "token": config["token"],
            "taskId": task["id"],
            "success": True,
            "publishUrl": publish_url,
            "publishedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        },
    )
    print(f"[完成] 已回传发布结果，链接: {publish_url}")


FILL_SCRIPT = r"""
(function(title, body){
  function setTitle(){
    var inputs = Array.from(document.querySelectorAll('input[type=text],input:not([type])'));
    var hit = inputs.filter(function(i){
      var ph = (i.placeholder||'') + (i.getAttribute('data-placeholder')||'');
      return ph.indexOf('标题') >= 0;
    })[0];
    if(!hit) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(hit, title);
    hit.dispatchEvent(new Event('input',{bubbles:true}));
    hit.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }
  function setBody(){
    var eds = Array.from(document.querySelectorAll('[contenteditable=true],.ql-editor,.ProseMirror'));
    if(!eds.length) return false;
    var ed = eds[0];
    ed.focus();
    if (ed.classList.contains('ql-editor')) {
      ed.innerHTML = body.split('\n').map(function(p){return '<p>'+p+'</p>'}).join('');
    } else {
      ed.innerText = body;
    }
    ed.dispatchEvent(new InputEvent('input',{bubbles:true,data:body}));
    return true;
  }
  return JSON.stringify({title: setTitle(), body: setBody()});
})('%TITLE%', '%BODY%')
"""

PUBLISH_SCRIPT = r"""
(function(){
  var btns = Array.from(document.querySelectorAll('button,span,a'));
  var hit = btns.filter(function(b){
    var t = (b.innerText||'').replace(/\s+/g,'');
    return t === '发布' || t === '发表' || t === '定时发布' || t === '提交';
  });
  if(!hit.length) return 'NO_BUTTON';
  hit[0].click();
  return 'CLICKED:' + (hit[0].innerText||'').trim();
})()
"""


def _read_task_text(path: str) -> tuple[str, str]:
    raw = Path(path).read_text(encoding="utf-8")
    title, body = "未命名", raw
    if raw.startswith("标题:"):
        head, _, rest = raw.partition("========== 正文 ==========")
        for line in head.strip().splitlines():
            if line.startswith("标题:"):
                title = line.split(":", 1)[1].strip()
        body = rest.split("========== 操作指南 ==========")[0].strip()
    return title, body


def cmd_publish(args) -> None:
    config = load_config()
    platform = args.platform or config.get("platform")
    cookie = args.cookie or config.get("cookie")
    if not cookie:
        print("[错误] 本机没有登录态，请先执行 auth 授权", file=sys.stderr)
        sys.exit(1)
    if not platform:
        print("[错误] 未指定平台", file=sys.stderr)
        sys.exit(1)

    title, body = _read_task_text(args.file) if args.file else (args.title, "")
    if args.text_file:
        body = Path(args.text_file).read_text(encoding="utf-8")
    if not body:
        print("[错误] 正文为空，请用 --file 指定任务文件或 --text-file 指定正文", file=sys.stderr)
        sys.exit(1)

    host = urllib.parse.urlparse(LOGIN_URLS.get(platform, "")).hostname or ""
    editor = args.url or EDITOR_URLS.get(platform)
    if not editor:
        print(f"[错误] 暂未内置 {platform} 的自动发布编辑器地址", file=sys.stderr)
        sys.exit(1)

    print("=== 星河GEO 自动发布（实验性） ===")
    print(f"  平台: {PLATFORM_NAMES.get(platform, platform)}")
    print(f"  标题: {title}")
    print(f"  正文: {len(body)} 字")
    print(f"  模式: {'预演（不点发布）' if args.dry_run else '正式发布'}")

    browser = Browser()
    try:
        n = browser.set_cookies(cookie, host)
        print(f"  已注入 {n} 条登录 cookie")
        browser.navigate(editor, wait=float(args.wait))
        time.sleep(2)

        expr = FILL_SCRIPT.replace("%TITLE%", title.replace("\\", "\\\\").replace("'", "\\'")) \
                           .replace("%BODY%", body.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n"))
        result = browser.evaluate(expr).get("value")
        print(f"  填充结果: {result}")

        if args.dry_run:
            info = browser.evaluate(
                "JSON.stringify({title:document.title,url:location.href,"
                "editable:document.querySelectorAll('[contenteditable=true]').length})"
            ).get("value")
            print(f"  预演完成，未点击发布。页面信息: {info}")
            return

        click = browser.evaluate(PUBLISH_SCRIPT).get("value")
        print(f"  点击发布: {click}")
        time.sleep(float(args.wait))
        url = browser.evaluate("location.href").get("value")
        print(f"  当前页面: {url}")
        print("  请到平台后台确认是否已发布成功；成功后可执行 run 回传链接")
    finally:
        browser.close()


STOP_FLAG = {"stop": False}


def cmd_run(_args) -> None:
    config = load_config()
    if not config.get("token"):
        print("[错误] 尚未绑定账号，请先执行: bind <授权码>", file=sys.stderr)
        sys.exit(1)

    print("=== 星河GEO 发布客户端 ===")
    print(f"  平台: {config.get('platform')}")
    print(f"  账号: {config.get('accountName')}")
    print(f"  服务器: {config.get('server')}")
    print(f"  任务目录: {TASKS_DIR}")
    print(f"\n开始运行，按 Ctrl+C 停止\n")

    last_heartbeat = 0
    consecutive_errors = 0
    STOP_FLAG["stop"] = False

    while not STOP_FLAG["stop"]:
        try:
            now = time.time()

            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                api_request(
                    config["server"],
                    "/api/publish-client/heartbeat",
                    method="POST",
                    data={"token": config["token"], "clientVersion": "1.0.0"},
                )
                last_heartbeat = now
                print(f"[{time.strftime('%H:%M:%S')}] 心跳正常", end="\r")

            resp = api_request(
                config["server"],
                "/api/publish-client/tasks",
                method="POST",
                data={"token": config["token"]},
            )
            tasks = resp.get("tasks", [])

            if tasks:
                for task in tasks:
                    process_task(config, task)
                consecutive_errors = 0

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n\n收到停止信号，正在退出...")
            break
        except SystemExit:
            consecutive_errors += 1
            if consecutive_errors >= 5:
                print("[错误] 连续 5 次请求失败，请检查网络或服务器地址", file=sys.stderr)
                sys.exit(1)
            time.sleep(POLL_INTERVAL)
        except Exception as e:
            print(f"[错误] 异常: {e}", file=sys.stderr)
            consecutive_errors += 1
            time.sleep(POLL_INTERVAL)

    print("客户端已停止")


def register_protocol() -> bool:
    """把 xinghegeo:// 协议注册到当前用户（HKCU，无需管理员）。"""
    if sys.platform != "win32":
        return False
    try:
        import winreg

        exe_path = os.path.abspath(sys.executable)
        if getattr(sys, "frozen", False):
            key_cmd = f'"{exe_path}" "%1"'
        else:
            key_cmd = f'"{exe_path}" "{os.path.abspath(__file__)}" "%1"'

        base = rf"Software\Classes\{URI_SCHEME}"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base) as k:
            winreg.SetValueEx(k, "", 0, winreg.REG_SZ, "URL:Xinghe GEO Client")
            winreg.SetValueEx(k, "URL Protocol", 0, winreg.REG_SZ, "")
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base + r"\DefaultIcon") as k:
            winreg.SetValueEx(k, "", 0, winreg.REG_SZ, exe_path + ",0")
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, base + r"\shell\open\command") as k:
            winreg.SetValueEx(k, "", 0, winreg.REG_SZ, key_cmd)
        return True
    except Exception as e:
        try:
            LOG.write(f"[提示] 协议注册失败（{e}），网页「打开客户端」将不可用\n")
        except Exception:
            pass
        return False


def focus_existing() -> bool:
    """把已经打开的客户端窗口拉到前台。"""
    if sys.platform != "win32":
        return False
    try:
        import ctypes

        hwnd = ctypes.windll.user32.FindWindowW(None, "星河GEO 发布客户端")
        if hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 9)
            ctypes.windll.user32.SetForegroundWindow(hwnd)
            return True
    except Exception:
        pass
    return False


def launch_gui(native: bool = False) -> None:
    """启动本地图形界面：内置小服务 + 原生窗口（Edge WebView2），失败则退回浏览器。"""
    import http.server
    import threading

    class LogBuf:
        def __init__(self):
            self.lines: list[str] = []
            self.lock = threading.Lock()
            self.pending = ""

        def write(self, s):
            if not s:
                return
            s = s.replace("\r", "\n")
            with self.lock:
                self.pending += s
                parts = self.pending.split("\n")
                self.pending = parts.pop()
                for piece in parts:
                    if piece.strip():
                        self.lines.append(piece)
                if len(self.lines) > 800:
                    del self.lines[:200]

        def flush(self):
            pass

        def since(self, n):
            with self.lock:
                start = max(0, n)
                return {"total": len(self.lines), "lines": self.lines[start:]}

    LOG = LogBuf()
    sys.stdout = LOG
    sys.stderr = LOG
    JOB = {"busy": False}
    LOCK = threading.Lock()

    def run_job(name, fn, *a):
        with LOCK:
            if JOB["busy"]:
                return False
            JOB["busy"] = True

        def go():
            try:
                LOG.write(f"\n>> {name}\n")
                fn(*a)
            except SystemExit:
                pass
            except Exception as e:
                LOG.write(f"\n[出错] {e}\n")
            finally:
                LOG.write("\n")
                JOB["busy"] = False

        threading.Thread(target=go, daemon=True).start()
        return True

    def status_payload():
        cfg = load_config()
        exp = (cfg.get("expiresAt") or "")[:10]
        return {
            "bound": bool(cfg.get("token")),
            "account": cfg.get("accountName") or "未绑定",
            "platform": PLATFORM_NAMES.get(cfg.get("platform"), cfg.get("platform") or "—"),
            "expire": exp or "—",
            "busy": JOB["busy"],
        }

    PAGE = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>星河GEO 发布客户端</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Microsoft YaHei UI","PingFang SC",sans-serif;background:#F8FAFC;color:#0F172A;padding:22px}
.wrap{max-width:880px;margin:0 auto}
.head{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.brand{font-size:22px;font-weight:700;color:#2563EB;letter-spacing:.5px}
.tag{font-size:13px;color:#64748B}
.card{background:#fff;border:1px solid #E9EDF3;border-radius:12px;padding:18px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.k{font-size:11px;color:#64748B;margin-bottom:4px}
.v{font-size:14px;font-weight:600}
.row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.row label{width:76px;font-size:13px;color:#334155}
input[type=text]{flex:1;padding:9px 12px;border:1px solid #DDE3EC;border-radius:8px;font-size:13px;outline:none}
input[type=text]:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
textarea{width:100%;min-height:110px;padding:10px 12px;border:1px solid #DDE3EC;border-radius:8px;font-size:13px;resize:vertical;outline:none}
textarea:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.btn{border:0;border-radius:8px;padding:9px 16px;font-size:13px;cursor:pointer;background:#F1F5F9;color:#0F172A}
.btn:hover{background:#E2E8F0}
.btn.pri{background:#2563EB;color:#fff}
.btn.pri:hover{background:#1D4ED8}
.btn:disabled{opacity:.5;cursor:not-allowed}
.hint{font-size:12px;color:#94A3B8}
.log{background:#FBFCFE;border:1px solid #EEF2F7;border-radius:10px;padding:12px;height:230px;overflow:auto;
font-family:Consolas,monospace;font-size:12px;color:#334155;white-space:pre-wrap;line-height:1.6}
.ttl{font-size:13px;font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center}
#toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#0F172A;color:#fff;
padding:9px 18px;border-radius:8px;font-size:13px;opacity:0;transition:.25s;pointer-events:none}
#toast.on{opacity:1}
</style></head><body><div class="wrap">
<div class="head"><span class="brand">星河GEO</span><span class="tag">发布客户端 · 登录态仅存本机</span>
<a href="#" onclick="quitApp();return false" style="margin-left:auto;font-size:12px;color:#94A3B8;text-decoration:none">退出客户端</a></div>

<div class="card"><div class="grid">
<div><div class="k">账号</div><div class="v" id="v_acc">—</div></div>
<div><div class="k">平台</div><div class="v" id="v_plat">—</div></div>
<div><div class="k">登录态有效期</div><div class="v" id="v_exp">—</div></div>
<div><div class="k">服务器</div><div class="v" style="font-size:12px;font-weight:500">已连接</div></div>
</div></div>

<div class="card">
<div class="row"><label>授权码</label><input type="text" id="auth" placeholder="8 位授权码，如 A7K2-9XQP"><button class="btn pri" onclick="auth()">扫码授权</button></div>
<div class="row"><span class="hint">授权码在后台「账号」→「添加账号」→ 选平台 →「扫码授权」里生成，30 分钟内有效、只能用一次</span></div>
<div class="row"><span class="hint">授权会弹出独立登录窗口，在里面登录一次即可，无需手工拷 cookie</span></div>
</div>

<div class="card">
<div class="ttl">自动发文（实验性）<span class="hint" id="pubhint"></span></div>
<div class="row"><label>标题</label><input type="text" id="title" placeholder="文章标题"></div>
<textarea id="body" placeholder="正文内容，回车分段"></textarea>
<div class="row" style="margin-top:12px">
<button class="btn" onclick="pub(true)">只填内容（预演）</button>
<button class="btn pri" onclick="pub(false)">直接发布</button>
<button class="btn" onclick="check()">复查登录态</button>
<button class="btn" onclick="runStart()">常驻监听</button>
<button class="btn" onclick="runStop()">停止监听</button>
</div></div>

<div class="card"><div class="ttl">运行日志<span class="hint"><a href="#" onclick="clr();return false">清空</a></span></div>
<div class="log" id="log"></div></div>
</div><div id="toast"></div>
<script>
let since=0,busy=false;
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),2200)}
async function post(p,d){const r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d||{})});return r.json()}
function lock(){['auth'].forEach(i=>{const e=document.getElementById(i);if(e)e.disabled=busy});document.querySelectorAll('.btn').forEach(b=>b.disabled=busy)}
async function refresh(){const s=await(await fetch('/api/status')).json();busy=s.busy;
document.getElementById('v_acc').textContent=s.account;document.getElementById('v_plat').textContent=s.platform;
document.getElementById('v_exp').textContent=s.expire;lock()}
async function auth(){const c=document.getElementById('auth').value.trim();if(!c){toast('先填 8 位授权码');return}await post('/api/auth',{code:c});toast('已开始授权，请在弹出的窗口里登录');refresh()}
async function check(){await post('/api/check',{});toast('已开始复查');refresh()}
async function pub(dry){const t=document.getElementById('title').value.trim();const b=document.getElementById('body').value.trim();
if(!b){toast('正文不能为空');return}await post('/api/publish',{title:t,body:b,dry:dry});toast(dry?'已开始填内容（不发布）':'已开始发布');refresh()}
async function runStart(){await post('/api/run/start',{});toast('常驻监听已启动');refresh()}
async function runStop(){await post('/api/run/stop',{});toast('已发送停止信号');refresh()}
function clr(){since=0;document.getElementById('log').textContent=''}
async function quitApp(){if(!confirm('确定退出发布客户端？退出后需重新启动才能继续用。'))return;
await post('/api/quit',{});document.body.innerHTML='<p style="padding:40px;font-size:14px;color:#64748B">客户端已退出，可以关闭这个页面了。</p>'}
async function tick(){const r=await(await fetch('/api/log?since='+since)).json();since=r.total;
if(r.lines.length){const el=document.getElementById('log');el.textContent+=r.lines.join('\\n')+'\\n';el.scrollTop=el.scrollHeight}}
setInterval(tick,900);setInterval(refresh,2000);refresh();tick();
document.getElementById('pubhint').textContent='发布后请到平台后台确认结果';
</script></body></html>"""

    class Handler(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def _send(self, code, body, ctype="application/json; charset=utf-8"):
            data = body.encode("utf-8") if isinstance(body, str) else body
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = urllib.parse.urlparse(self.path).path
            if path == "/":
                self._send(200, PAGE, "text/html; charset=utf-8")
            elif path == "/api/status":
                self._send(200, json.dumps(status_payload(), ensure_ascii=False))
            elif path == "/api/log":
                qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
                n = int((qs.get("since") or ["0"])[0])
                self._send(200, json.dumps(LOG.since(n), ensure_ascii=False))
            elif path == "/favicon.ico":
                self._send(204, b"")
            else:
                self._send(404, json.dumps({"error": "not found"}))

        def do_POST(self):
            path = urllib.parse.urlparse(self.path).path
            length = int(self.headers.get("Content-Length") or 0)
            try:
                data = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                data = {}
            try:
                if path == "/api/bind":
                    code = (data.get("code") or "").strip()
                    if not code:
                        return self._send(400, json.dumps({"error": "缺少绑定码"}))
                    run_job(f"绑定 {code}", cmd_bind,
                            argparse.Namespace(code=code, server=DEFAULT_SERVER))
                elif path == "/api/auth":
                    code = (data.get("code") or "").strip()
                    if not code:
                        return self._send(400, json.dumps({"error": "缺少授权码"}))
                    run_job(f"授权 {code}", cmd_auth, argparse.Namespace(
                        code=code, server=DEFAULT_SERVER, cookie=None, cookie_file=None,
                        account_name=None, platform=None, account=None, mode="qr", manual=False))
                elif path == "/api/check":
                    run_job("复查登录态", cmd_check, argparse.Namespace(server=DEFAULT_SERVER))
                elif path == "/api/publish":
                    title = (data.get("title") or "未命名").strip()
                    body = (data.get("body") or "").strip()
                    if not body:
                        return self._send(400, json.dumps({"error": "正文为空"}))
                    tmp = Path(tempfile.gettempdir()) / f"geo_task_{int(time.time())}.txt"
                    tmp.write_text(
                        f"标题: {title}\n========== 正文 ==========\n{body}\n", encoding="utf-8")
                    run_job("自动发文", cmd_publish, argparse.Namespace(
                        file=str(tmp), text_file=None, title=None, platform=None,
                        cookie=None, dry_run=bool(data.get("dry")), wait="5", url=None))
                elif path == "/api/run/start":
                    run_job("常驻监听", cmd_run, None)
                elif path == "/api/run/stop":
                    STOP_FLAG["stop"] = True
                elif path == "/api/quit":
                    self._send(200, json.dumps({"ok": True}))
                    threading.Timer(0.4, lambda: os._exit(0)).start()
                    return
                else:
                    return self._send(404, json.dumps({"error": "not found"}))
                self._send(200, json.dumps({"ok": True}))
            except Exception as e:
                self._send(500, json.dumps({"error": str(e)}, ensure_ascii=False))

    port = 8765
    # 已在运行：把已有窗口拉到前台，不再起第二个实例
    try:
        urllib.request.urlopen("http://127.0.0.1:8765/api/status", timeout=1.5).read()
        if focus_existing():
            return
        if not native:
            webbrowser.open("http://127.0.0.1:8765/")
            return
    except Exception:
        pass

    for cand in range(8765, 8790):
        try:
            server = http.server.ThreadingHTTPServer(("127.0.0.1", cand), Handler)
            port = cand
            break
        except OSError:
            continue
    else:
        raise RuntimeError("没有可用端口")

    url = f"http://127.0.0.1:{port}/"
    threading.Thread(target=server.serve_forever, daemon=True).start()

    if native:
        try:
            import webview
            window = webview.create_window(
                "星河GEO 发布客户端", url, width=1040, height=820,
                min_size=(860, 620), background_color="#F8FAFC",
            )
            window.events.closed += lambda: os._exit(0)
            webview.start()
            os._exit(0)
        except Exception as e:
            LOG.write(f"[提示] 原生窗口不可用（{e}），已改为浏览器打开\n")
            try:
                webbrowser.open(url)
            except Exception:
                pass
    else:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    print(f"图形界面已启动: {url}")

    # 无控制台打包时保持进程存活
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


def _setup_stdio() -> None:
    """让打包后的 exe 输出编码与当前终端一致，避免中文乱码。"""
    enc = "utf-8"
    try:
        if sys.stdout.isatty():
            import ctypes
            cp = ctypes.windll.kernel32.GetConsoleOutputCP()
            if cp and cp != 65001:
                enc = f"cp{cp}"
    except Exception:
        pass
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding=enc, errors="replace")
        except Exception:
            pass


def interactive_menu() -> None:
    """双击 exe 时的图形化入口：一步步提示，不要求用户会敲参数。"""
    cfg = load_config()
    while True:
        print()
        print("=" * 46)
        print("        星河GEO 发布客户端")
        print("=" * 46)
        if cfg.get("accountName"):
            print(f"  当前账号：{cfg.get('accountName')}（{PLATFORM_NAMES.get(cfg.get('platform'), cfg.get('platform'))}）")
        else:
            print("  当前未绑定账号")
        print("  1) 平台扫码授权（输入后台给的 8 位授权码）")
        print("  2) 查看绑定与授权状态")
        print("  3) 复查登录态")
        print("  4) 自动发文（实验性）")
        print("  5) 常驻监听发布任务（Ctrl+C 停止）")
        print("  0) 退出")
        choice = input("  请选择编号后回车: ").strip()
        print()
        try:
            if choice in ("0", "q", ""):
                return
            if choice == "1":
                code = input("  请输入 8 位授权码（形如 A7K2-9XQP）: ").strip()
                if code:
                    ns = argparse.Namespace(
                        code=code, server=DEFAULT_SERVER, cookie=None, cookie_file=None,
                        account_name=None, platform=None, account=None, mode="qr", manual=False,
                    )
                    cmd_auth(ns)
                    cfg = load_config()
            elif choice == "2":
                cmd_status(None)
            elif choice == "3":
                cmd_check(argparse.Namespace(server=DEFAULT_SERVER))
            elif choice == "4":
                path = input("  请输入任务文件路径（可直接把文件拖进来）: ").strip().strip('"')
                if path:
                    dry = input("  只填内容不发布？(y/N): ").strip().lower() == "y"
                    ns = argparse.Namespace(
                        file=path, text_file=None, title=None, platform=None,
                        cookie=None, dry_run=dry, wait="5", url=None,
                    )
                    cmd_publish(ns)
            elif choice == "5":
                cmd_run(None)
            else:
                print("  没有这个选项，请重新输入")
        except SystemExit as e:
            if e.code not in (0, None):
                print("  上一步没有成功，可以重试或查看提示信息")
        except KeyboardInterrupt:
            print("\n  已中断当前操作")
        except Exception as e:
            print(f"  出错了：{e}")


def main() -> None:
    _setup_stdio()

    # 被网页 xinghegeo:// 唤起时，直接开界面
    uri_args = [a for a in sys.argv[1:] if str(a).lower().startswith(URI_SCHEME + ":")]
    if uri_args:
        register_protocol()
        launch_gui(native=True)
        return

    register_protocol()

    parser = argparse.ArgumentParser(
        prog="geo-publish-client",
        description="星河GEO 发布客户端 - 本地半自动发布工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s auth A7K2-9XQP              # 授权码 + 自动抓登录态（会打开独立登录窗口）
  %(prog)s auth A7K2-9XQP --manual     # 改为手动粘贴 cookie
  %(prog)s check                       # 复查登录态并上报心跳
  %(prog)s publish --file <任务txt>     # 自动发文（实验性）
  %(prog)s publish --file <任务txt> --dry-run   # 只填内容不点发布
  %(prog)s bind 123456                # 使用授权码绑定发布客户端
  %(prog)s run                        # 启动客户端，监听发布任务
""",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("status", help="查看绑定状态")
    subparsers.add_parser("run", help="启动客户端，监听发布任务")
    subparsers.add_parser("unbind", help="解绑当前账号")

    auth_parser = subparsers.add_parser("auth", help="扫码登录后回传账号登录态")
    auth_parser.add_argument("code", help="后台生成的一次性授权码，如 A7K2-9XQP")
    auth_parser.add_argument("--server", default=DEFAULT_SERVER, help="服务器地址")
    auth_parser.add_argument("--cookie", help="直接传入 cookie 字符串")
    auth_parser.add_argument("--cookie-file", help="从文件读取 cookie")
    auth_parser.add_argument("--account-name", help="平台账号昵称，可选")
    auth_parser.add_argument("--platform", help="平台键，如 baijiahao（授权码已带平台时可省略）")
    auth_parser.add_argument("--account", help="账号ID，可选（用于授权码无法解析时兜底）")
    auth_parser.add_argument("--mode", default="qr", choices=["qr", "password", "oauth"], help="接入方式")
    auth_parser.add_argument("--manual", action="store_true", help="不自动读 cookie，改为手动粘贴")
    parser.add_argument("--gui", action="store_true", help="打开图形界面")
    parser.add_argument("--native", action="store_true", help="图形界面使用原生窗口（WebView2）")
    parser.add_argument("--web", action="store_true", help="图形界面改用浏览器打开")

    publish_parser = subparsers.add_parser("publish", help="用已授权的登录态自动发文（实验性）")
    publish_parser.add_argument("--file", help="客户端任务文件（run 时生成的那种 txt）")
    publish_parser.add_argument("--text-file", help="纯正文文件")
    publish_parser.add_argument("--title", help="标题（配合 --text-file）")
    publish_parser.add_argument("--platform", help="平台键，默认用最近一次 auth 的平台")
    publish_parser.add_argument("--cookie", help="临时指定 cookie")
    publish_parser.add_argument("--dry-run", action="store_true", help="只填内容不点发布")
    publish_parser.add_argument("--wait", default="5", help="页面等待秒数")
    publish_parser.add_argument("--url", help="直接指定编辑器地址（调试用）")

    check_parser = subparsers.add_parser("check", help="复查登录态是否仍有效并上报心跳")
    check_parser.add_argument("--server", default=DEFAULT_SERVER, help="服务器地址")

    args = parser.parse_args()

    if args.gui:
        launch_gui(native=args.native)
        return

    if not args.command:
        if getattr(sys, "stdout", None) is None:
            launch_gui(native=not args.web)
        else:
            interactive_menu()
        return

    if args.command == "bind":
        cmd_bind(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "unbind":
        cmd_unbind(args)
    elif args.command == "auth":
        cmd_auth(args)
    elif args.command == "check":
        cmd_check(args)
    elif args.command == "publish":
        cmd_publish(args)


if __name__ == "__main__":
    main()

export const CLIENT_SCRIPT_CONTENT = `#!/usr/bin/env python3
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
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

CONFIG_DIR = Path.home() / ".geo_publish_client"
CONFIG_FILE = CONFIG_DIR / "config.json"
TASKS_DIR = CONFIG_DIR / "tasks"

HEARTBEAT_INTERVAL = 60
POLL_INTERVAL = 30


def api_request(base_url: str, path: str, method: str = "GET",
                data: dict | None = None, token: str | None = None) -> dict:
    url = base_url.rstrip("/") + path
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("X-Client-Token", token)
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

    print(f"\\n[成功] 绑定完成！")
    print(f"  平台: {result['platform']}")
    print(f"  账号: {result['accountName']}")
    print(f"  配置已保存到: {CONFIG_FILE}")
    print(f"\\n执行以下命令开始监听任务:")
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
    print(f"\\n{'='*50}")
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
    print(f"\\n开始运行，按 Ctrl+C 停止\\n")

    last_heartbeat = 0
    consecutive_errors = 0

    while True:
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
                print(f"[{time.strftime('%H:%M:%S')}] 心跳正常", end="\\r")

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
            print("\\n\\n收到停止信号，正在退出...")
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


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="geo-publish-client",
        description="星河GEO 发布客户端 - 本地半自动发布工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s bind 123456                # 使用授权码绑定账号
  %(prog)s bind 123456 --server https://4mdyqq3k3dr8c.doubaoapps.com/app/app_17hwmq4p6qy
  %(prog)s status                     # 查看绑定状态
  %(prog)s run                        # 启动客户端，监听发布任务
  %(prog)s unbind                     # 解绑当前账号
""",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    bind_parser = subparsers.add_parser("bind", help="使用授权码绑定账号")
    bind_parser.add_argument("code", help="6 位授权码")
    bind_parser.add_argument(
        "--server",
        default="https://4mdyqq3k3dr8c.doubaoapps.com/app/app_17hwmq4p6qy",
        help="服务器地址 (默认: https://4mdyqq3k3dr8c.doubaoapps.com/app/app_17hwmq4p6qy)",
    )

    subparsers.add_parser("status", help="查看绑定状态")
    subparsers.add_parser("run", help="启动客户端，监听发布任务")
    subparsers.add_parser("unbind", help="解绑当前账号")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "bind":
        cmd_bind(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "unbind":
        cmd_unbind(args)


if __name__ == "__main__":
    main()
`;

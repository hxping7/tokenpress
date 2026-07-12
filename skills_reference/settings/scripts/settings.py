#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Token00 Settings Controller
通过 API Token 远程读取/修改 Token00 全站系统设置（含友链与顶部导航）。

依赖：仅 Python 标准库（urllib / json / argparse），无需 pip install。
用法详见 SKILL.md。
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

# ---------- 设置项契约（客户端校验用） ----------
# type: text | url | enum | bool | int | json
SCHEMA = {
    "site_name": {"type": "text"},
    "site_description": {"type": "text"},
    "header_logo": {"type": "url"},
    "footer_logo": {"type": "url"},

    "default_theme": {"type": "enum", "enum": ["night", "cyber", "lava", "light", "space"]},
    "frontend_locale": {"type": "enum", "enum": ["zh", "en"]},
    "backend_locale": {"type": "enum", "enum": ["zh", "en"]},
    "content_max_width": {"type": "text"},

    "hero_slides": {"type": "json"},
    "hero_size": {"type": "enum", "enum": ["default", "fullscreen", "wide"]},
    "hero_carousel_use_articles": {"type": "bool"},
    "hero_carousel_article_source": {"type": "text"},
    "hero_carousel_max_items": {"type": "int"},
    "hero_carousel_interval": {"type": "int"},
    "hero_cta_buttons": {"type": "json"},

    "home_banner_enabled": {"type": "bool"},
    "home_banner_type": {"type": "enum", "enum": ["cta", "cards", "image", "notice"]},
    "home_banner_position": {"type": "enum", "enum": ["after_hero", "after_articles"]},
    "home_banner_cta": {"type": "json"},
    "home_banner_cards": {"type": "json"},
    "home_banner_image": {"type": "json"},
    "home_banner_notice": {"type": "json"},

    "footer_nav": {"type": "json"},
    "footer_nav_columns": {"type": "int"},
    "friend_links_columns": {"type": "int"},

    "copyright_text": {"type": "text"},
    "icp_number": {"type": "text"},
    "icp_url": {"type": "url"},
    "powered_by": {"type": "text"},

    "backup_auto_enabled": {"type": "bool"},
    "backup_interval_hours": {"type": "int"},
    "backup_retention_days": {"type": "int"},
    "backup_include_uploads": {"type": "bool"},

    "analytics_code": {"type": "text"},

    "anti_scraping_enabled": {"type": "bool"},
    "content_review_enabled": {"type": "bool"},
    "review_cloud_provider": {"type": "enum", "enum": ["none", "tencent", "aliyun", "baidu", "builtin"]},
    "review_tencent_secret_id": {"type": "text"},
    "review_tencent_secret_key": {"type": "text"},
    "review_tencent_region": {"type": "text"},
    "review_aliyun_access_key_id": {"type": "text"},
    "review_aliyun_access_key_secret": {"type": "text"},
    "review_aliyun_region": {"type": "text"},
    "review_baidu_app_id": {"type": "text"},
    "review_baidu_api_key": {"type": "text"},
    "review_baidu_secret_key": {"type": "text"},
    "review_builtin_ai_api_url": {"type": "text"},
    "review_builtin_ai_api_key": {"type": "text"},

    "share_config": {"type": "json"},
}

GROUP_KEYS = {
    "basic": ["site_name", "site_description", "header_logo", "footer_logo"],
    "ui": ["default_theme", "frontend_locale", "backend_locale", "content_max_width"],
    "logo": ["header_logo", "footer_logo"],
    "home": ["home_banner_enabled", "home_banner_type", "home_banner_position",
             "home_banner_cta", "home_banner_cards", "home_banner_image", "home_banner_notice",
             "hero_slides", "hero_size", "hero_carousel_use_articles", "hero_carousel_article_source",
             "hero_carousel_max_items", "hero_carousel_interval", "hero_cta_buttons"],
    "hero": ["hero_slides", "hero_size", "hero_carousel_use_articles", "hero_carousel_article_source",
             "hero_carousel_max_items", "hero_carousel_interval", "hero_cta_buttons"],
    "banner": ["home_banner_enabled", "home_banner_type", "home_banner_position",
               "home_banner_cta", "home_banner_cards", "home_banner_image", "home_banner_notice"],
    "nav": ["footer_nav", "footer_nav_columns"],
    "footer": ["footer_nav", "footer_nav_columns", "copyright_text", "icp_number", "icp_url", "powered_by", "footer_logo"],
    "analytics": ["analytics_code"],
    "security": ["anti_scraping_enabled", "content_review_enabled", "review_cloud_provider",
                 "review_tencent_secret_id", "review_tencent_secret_key", "review_tencent_region",
                 "review_aliyun_access_key_id", "review_aliyun_access_key_secret", "review_aliyun_region",
                 "review_baidu_app_id", "review_baidu_api_key", "review_baidu_secret_key",
                 "review_builtin_ai_api_url", "review_builtin_ai_api_key"],
    "backup": ["backup_auto_enabled", "backup_interval_hours", "backup_retention_days", "backup_include_uploads"],
    "share": ["share_config"],
}


def validate_value(key, value):
    """返回 (ok, msg)。ok=False 时 msg 为错误原因。"""
    spec = SCHEMA.get(key)
    if not spec:
        return True, f"warning: unknown key '{key}' (will still attempt to write)"
    t = spec["type"]
    if t == "enum":
        if value not in spec["enum"]:
            return False, f"key '{key}' 取值非法: '{value}'；允许值: {', '.join(spec['enum'])}"
    elif t == "bool":
        if str(value).lower() not in ("true", "false", "1", "0", "yes", "no", "on", "off"):
            return False, f"key '{key}' 需为布尔值 (true/false/1/0/yes/no)"
    elif t == "int":
        try:
            int(value)
        except ValueError:
            return False, f"key '{key}' 需为整数，收到: '{value}'"
    elif t == "json":
        try:
            json.loads(value)
        except json.JSONDecodeError as e:
            return False, f"key '{key}' 应为合法 JSON，解析失败: {e}"
    return True, ""


# ---------- 配置加载 ----------
def load_config(cli_api_base=None, cli_token=None):
    api_base = cli_api_base
    token = cli_token

    if not api_base:
        api_base = os.environ.get("TOKEN00_API_BASE")
    if not token:
        token = os.environ.get("TOKEN00_TOKEN")

    if not api_base or not token:
        for base in (os.getcwd(), os.path.dirname(os.path.abspath(__file__))):
            cfg_path = os.path.join(base, ".token00.conf")
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                    if not api_base and cfg.get("api_base"):
                        api_base = cfg["api_base"]
                    if not token:
                        if cfg.get("token"):
                            token = cfg["token"]
                        elif cfg.get("token_file") and os.path.exists(cfg["token_file"]):
                            with open(cfg["token_file"], "r", encoding="utf-8") as tf:
                                token = tf.read().strip()
                except Exception:
                    pass
                break

    if not token:
        for base in (os.getcwd(), os.path.dirname(os.path.abspath(__file__))):
            pt = os.path.join(base, "pub_token.txt")
            if os.path.exists(pt):
                with open(pt, "r", encoding="utf-8") as f:
                    token = f.read().strip()
                break

    if not api_base:
        api_base = "http://localhost:4001/api/v1"
    if not token:
        print("ERROR: 未找到 API Token。请在 .token00.conf 配置 token，或用 --token 传入。", file=sys.stderr)
        sys.exit(1)
    return api_base.rstrip("/"), token


# ---------- API 调用 ----------
api_base_from_call = ""


def call(method, path, token, body=None):
    full = path if path.startswith("http") else f"{api_base_from_call}{path}"
    url = full
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"success": False, "error": raw}
        return e.code, payload
    except Exception as e:
        return 0, {"success": False, "error": str(e)}


def print_result(status, payload):
    ok = payload.get("success") if isinstance(payload, dict) else False
    if status >= 200 and status < 300 and ok:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return True
    else:
        print(f"HTTP {status} — 失败:", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        return False


# ---------- 子命令实现 ----------
def cmd_get(args, token):
    if args.group:
        keys = GROUP_KEYS.get(args.group)
        if not keys:
            print(f"未知分组: {args.group}；可选: {', '.join(GROUP_KEYS.keys())}", file=sys.stderr)
            sys.exit(1)
        path = f"/site-settings/keys/{','.join(keys)}"
    elif args.keys:
        path = f"/site-settings/keys/{args.keys}"
    else:
        path = "/site-settings"
    status, payload = call("GET", path, token)
    if not print_result(status, payload):
        sys.exit(1)
    if args.file:
        with open(args.file, "w", encoding="utf-8") as f:
            json.dump(payload.get("data", {}), f, ensure_ascii=False, indent=2)
        print(f"\n已写入 {args.file}")


def cmd_set(args, token):
    key = args.key
    value = args.value
    ok, msg = validate_value(key, value)
    if not ok:
        print(f"校验失败: {msg}", file=sys.stderr)
        sys.exit(1)
    if msg.startswith("warning"):
        print(f"[warn] {msg}")
    status, payload = call("PUT", "/site-settings", token, {"settings": {key: value}})
    if not print_result(status, payload):
        sys.exit(1)


def cmd_set_many(args, token):
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = json.loads(args.data)
    if not isinstance(data, dict):
        print("ERROR: 批量数据必须是 {key: value} 对象", file=sys.stderr)
        sys.exit(1)
    settings = {}
    for k, v in data.items():
        val = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
        ok, msg = validate_value(k, val)
        if not ok:
            print(f"校验失败 (key={k}): {msg}", file=sys.stderr)
            sys.exit(1)
        if msg.startswith("warning"):
            print(f"[warn] {msg}")
        settings[k] = val
    status, payload = call("PUT", "/site-settings", token, {"settings": settings})
    if not print_result(status, payload):
        sys.exit(1)


def cmd_links(args, token):
    action = args.action
    if action == "list":
        status, payload = call("GET", "/friend-links", token)
        if not print_result(status, payload):
            sys.exit(1)
        return
    if action == "add":
        if not args.name or not args.url:
            print("links add 需要 --name 与 --url", file=sys.stderr)
            sys.exit(1)
        body = {"name": args.name, "url": args.url}
        if args.description:
            body["description"] = args.description
        if args.sort_order is not None:
            body["sortOrder"] = args.sort_order
        if args.is_active is not None:
            body["isActive"] = args.is_active
        status, payload = call("POST", "/friend-links", token, body)
    elif action == "update":
        if args.id is None:
            print("links update 需要 --id", file=sys.stderr)
            sys.exit(1)
        body = {}
        if args.name:
            body["name"] = args.name
        if args.url:
            body["url"] = args.url
        if args.description is not None:
            body["description"] = args.description
        if args.sort_order is not None:
            body["sortOrder"] = args.sort_order
        if args.is_active is not None:
            body["isActive"] = args.is_active
        status, payload = call("PUT", f"/friend-links/{args.id}", token, body)
    elif action == "delete":
        if args.id is None:
            print("links delete 需要 --id", file=sys.stderr)
            sys.exit(1)
        status, payload = call("DELETE", f"/friend-links/{args.id}", token)
    else:
        print(f"未知 links 动作: {action}", file=sys.stderr)
        sys.exit(1)
    if not print_result(status, payload):
        sys.exit(1)


def cmd_sections(args, token):
    action = args.action
    if action == "list":
        status, payload = call("GET", "/sections", token)
        if not print_result(status, payload):
            sys.exit(1)
        return
    if action == "add":
        if not args.name or not args.path:
            print("sections add 需要 --name 与 --path", file=sys.stderr)
            sys.exit(1)
        body = {"name": args.name, "path": args.path}
        if args.slug:
            body["slug"] = args.slug
        if args.description:
            body["description"] = args.description
        if args.external_url:
            body["externalUrl"] = args.external_url
        if args.sort_order is not None:
            body["sortOrder"] = args.sort_order
        if args.is_active is not None:
            body["isActive"] = args.is_active
        status, payload = call("POST", "/sections", token, body)
    elif action == "update":
        if args.id is None:
            print("sections update 需要 --id", file=sys.stderr)
            sys.exit(1)
        body = {}
        if args.name:
            body["name"] = args.name
        if args.slug:
            body["slug"] = args.slug
        if args.path:
            body["path"] = args.path
        if args.description is not None:
            body["description"] = args.description
        if args.external_url is not None:
            body["externalUrl"] = args.external_url
        if args.sort_order is not None:
            body["sortOrder"] = args.sort_order
        if args.is_active is not None:
            body["isActive"] = args.is_active
        status, payload = call("PUT", f"/sections/{args.id}", token, body)
    elif action == "delete":
        if args.id is None:
            print("sections delete 需要 --id", file=sys.stderr)
            sys.exit(1)
        status, payload = call("DELETE", f"/sections/{args.id}", token)
    else:
        print(f"未知 sections 动作: {action}", file=sys.stderr)
        sys.exit(1)
    if not print_result(status, payload):
        sys.exit(1)


# ---------- 参数解析 ----------
def str2bool(v):
    if v is None:
        return None
    return str(v).lower() in ("true", "1", "yes", "on")


def build_parser():
    p = argparse.ArgumentParser(description="Token00 系统设置远程控制器")
    p.add_argument("--api-base", help="API 基础 URL")
    p.add_argument("--token", help="API Token (t00_sk_...)")
    sub = p.add_subparsers(dest="cmd", required=True)

    # get
    g = sub.add_parser("get", help="读取设置")
    g.add_argument("--keys", help="逗号分隔的 key 列表")
    g.add_argument("--group", help="逻辑分组: " + ", ".join(GROUP_KEYS.keys()))
    g.add_argument("--file", help="将结果写入该 JSON 文件")

    # set
    s = sub.add_parser("set", help="修改单个设置")
    s.add_argument("--key", required=True)
    s.add_argument("--value", required=True)

    # set-many
    sm = sub.add_parser("set-many", help="批量修改设置")
    sm.add_argument("--file", help="JSON 文件，内容 {key: value}")
    sm.add_argument("--data", help="JSON 字符串，内容 {key: value}")

    # links
    lk = sub.add_parser("links", help="友链管理 (需 friendlinks:write)")
    lk.add_argument("action", choices=["list", "add", "update", "delete"])
    lk.add_argument("--id", type=int)
    lk.add_argument("--name")
    lk.add_argument("--url")
    lk.add_argument("--description")
    lk.add_argument("--sort-order", type=int, dest="sort_order")
    lk.add_argument("--is-active", type=str2bool, dest="is_active")

    # sections
    sc = sub.add_parser("sections", help="顶部导航管理 (需 sections:write)")
    sc.add_argument("action", choices=["list", "add", "update", "delete"])
    sc.add_argument("--id", type=int)
    sc.add_argument("--name")
    sc.add_argument("--slug")
    sc.add_argument("--path")
    sc.add_argument("--description")
    sc.add_argument("--external-url", dest="external_url")
    sc.add_argument("--sort-order", type=int, dest="sort_order")
    sc.add_argument("--is-active", type=str2bool, dest="is_active")

    return p


def main():
    global api_base_from_call
    args = build_parser().parse_args()
    api_base, token = load_config(args.api_base, args.token)
    api_base_from_call = api_base

    if args.cmd == "get":
        cmd_get(args, token)
    elif args.cmd == "set":
        cmd_set(args, token)
    elif args.cmd == "set-many":
        cmd_set_many(args, token)
    elif args.cmd == "links":
        cmd_links(args, token)
    elif args.cmd == "sections":
        cmd_sections(args, token)


if __name__ == "__main__":
    main()

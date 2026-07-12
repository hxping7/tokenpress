#!/usr/bin/env python3
"""Token00 远程后台管理 CLI（token00-admin 技能）

通过 API Token（access token）远程控制 Token00 全站后台设置与管理项。
纯标准库实现，无需第三方依赖。

配置：项目根目录或 ~/.workbuddy/ 下的 .token00.conf
    [token00]
    api_base=https://www.token00.com
    token=t00_sk_xxxxxxxx

子命令：
    settings    get-all | get --keys a,b | set --key K --value V [--json] | set-many --file f.json
    friend-links list | create --name --url [--description] | update --id N --json '{...}' | delete --id N
    sections     list | create --name --path [--slug] | update --id N --json | delete --id N
    categories   list | create --name --section-id N [--slug] [--description] | update --id N --json | delete --id N
    backup       settings | set --json '{...}' | create | list | restore-id --id N | delete --id N
    ads          list | pending | create --json '{...}' | approve --id N | reject --id N | toggle --id N --active true|false
    keywords     list | add --keyword [--category] [--severity] [--action] [--scope] | delete --id N | batch --json '[{...}]'
    reviews      list | pending | stats | approve --id N [--note N] | reject --id N [--note N] | retry --id N
    users        list | create --username --password [--role user] [--display-name] | update --id N --json | reset-pwd --id N | delete --id N
    raw          --method GET|POST|... --path /api/v1/xxx [--json '{...}']
"""
import argparse
import configparser
import json
import os
import sys
import urllib.error
import urllib.request

# ---------- 配置加载 ----------
def load_config():
    candidates = [
        os.path.join(os.getcwd(), ".token00.conf"),
        os.path.join(os.path.expanduser("~"), ".workbuddy", ".token00.conf"),
        os.path.join(os.path.expanduser("~"), ".token00.conf"),
    ]
    cfg = configparser.ConfigParser()
    for p in candidates:
        if os.path.exists(p):
            cfg.read(p)
            break
    section = cfg["token00"] if cfg.has_section("token00") else cfg.defaults()
    api_base = (section.get("api_base") or "").rstrip("/")
    token = section.get("token") or ""
    if not api_base or not token:
        sys.exit("✗ 未找到配置。请在 .token00.conf 中设置 api_base 与 token。")
    return api_base, token


# ---------- 请求封装 ----------
def request(method, path, token, body=None, base=None):
    if base is None:
        base, token = load_config()
    url = base + path
    data = None
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if body is not None:
        data = body.encode("utf-8") if isinstance(body, str) else json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
            msg = payload.get("error", raw)
        except Exception:
            msg = raw
        return e.code, {"success": False, "error": msg}
    except Exception as e:  # noqa
        return 0, {"success": False, "error": str(e)}


def out(status, payload):
    print(json.dumps({"http": status, "body": payload}, ensure_ascii=False, indent=2))
    if status >= 400 or not payload.get("success", True):
        sys.exit(1)


def jarg(s):
    return s


# ---------- 子命令实现 ----------
def cmd_settings(args):
    if args.sub == "get-all":
        out(*request("GET", "/api/v1/site-settings"))
    elif args.sub == "get":
        keys = ",".join(args.keys)
        out(*request("GET", f"/api/v1/site-settings/keys/{keys}"))
    elif args.sub == "set":
        value = args.value
        if args.json:
            try:
                value = json.loads(args.value)
            except Exception:
                sys.exit("✗ --json 值不是合法 JSON")
        body = {"key": args.key, "value": value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)}
        out(*request("PUT", "/api/v1/site-settings", None, body))
    elif args.sub == "set-many":
        with open(args.file, "r", encoding="utf-8") as f:
            arr = json.load(f)
        if not isinstance(arr, list):
            sys.exit("✗ set-many 文件需为对象数组")
        out(*request("PUT", "/api/v1/site-settings", None, arr))


def cmd_friend_links(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/friend-links"))
    elif args.sub == "create":
        body = {"name": args.name, "url": args.url}
        if args.description:
            body["description"] = args.description
        out(*request("POST", "/api/v1/friend-links", None, body))
    elif args.sub == "update":
        out(*request("PUT", f"/api/v1/friend-links/{args.id}", None, json.loads(args.json)))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/friend-links/{args.id}"))


def cmd_sections(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/sections"))
    elif args.sub == "create":
        body = {"name": args.name, "path": args.path}
        if args.slug:
            body["slug"] = args.slug
        out(*request("POST", "/api/v1/sections", None, body))
    elif args.sub == "update":
        out(*request("PUT", f"/api/v1/sections/{args.id}", None, json.loads(args.json)))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/sections/{args.id}"))


def cmd_categories(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/categories"))
    elif args.sub == "create":
        body = {"name": args.name, "sectionId": args.section_id}
        if args.slug:
            body["slug"] = args.slug
        if args.description:
            body["description"] = args.description
        out(*request("POST", "/api/v1/categories", None, body))
    elif args.sub == "update":
        out(*request("PUT", f"/api/v1/categories/{args.id}", None, json.loads(args.json)))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/categories/{args.id}"))


def cmd_backup(args):
    if args.sub == "settings":
        out(*request("GET", "/api/v1/backup/settings"))
    elif args.sub == "set":
        out(*request("PUT", "/api/v1/backup/settings", None, json.loads(args.json)))
    elif args.sub == "create":
        out(*request("POST", "/api/v1/backup", None, "{}"))
    elif args.sub == "list":
        out(*request("GET", "/api/v1/backup"))
    elif args.sub == "restore-id":
        out(*request("POST", f"/api/v1/backup/{args.id}/restore", None, "{}"))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/backup/{args.id}"))


def cmd_ads(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/admin/ads"))
    elif args.sub == "pending":
        out(*request("GET", "/api/v1/admin/ads/pending"))
    elif args.sub == "create":
        out(*request("POST", "/api/v1/admin/ads", None, json.loads(args.json)))
    elif args.sub == "approve":
        out(*request("POST", f"/api/v1/admin/ads/{args.id}/approve", None, "{}"))
    elif args.sub == "reject":
        body = {"note": args.note} if args.note else {}
        out(*request("POST", f"/api/v1/admin/ads/{args.id}/reject", None, json.dumps(body)))
    elif args.sub == "toggle":
        out(*request("POST", f"/api/v1/admin/ads/{args.id}/toggle", None, json.dumps({"isActive": args.active == "true"})))


def cmd_keywords(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/admin/sensitive-keywords"))
    elif args.sub == "add":
        body = {"keyword": args.keyword}
        for k in ("category", "severity", "action", "scope"):
            v = getattr(args, k)
            if v:
                body[k] = v
        out(*request("POST", "/api/v1/admin/sensitive-keywords", None, body))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/admin/sensitive-keywords/{args.id}"))
    elif args.sub == "batch":
        out(*request("POST", "/api/v1/admin/sensitive-keywords/batch", None, json.loads(args.json)))


def cmd_reviews(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/admin/reviews"))
    elif args.sub == "pending":
        out(*request("GET", "/api/v1/admin/reviews/pending"))
    elif args.sub == "stats":
        out(*request("GET", "/api/v1/admin/reviews/stats"))
    elif args.sub in ("approve", "reject", "retry"):
        body = {}
        if args.note:
            body["note"] = args.note
        out(*request("POST", f"/api/v1/admin/reviews/{args.id}/{args.sub}", None, json.dumps(body) if body else "{}"))


def cmd_users(args):
    if args.sub == "list":
        out(*request("GET", "/api/v1/users"))
    elif args.sub == "create":
        body = {"username": args.username, "password": args.password, "role": args.role}
        if args.display_name:
            body["displayName"] = args.display_name
        out(*request("POST", "/api/v1/users", None, body))
    elif args.sub == "update":
        out(*request("PUT", f"/api/v1/users/{args.id}", None, json.loads(args.json)))
    elif args.sub == "reset-pwd":
        out(*request("PATCH", f"/api/v1/users/{args.id}/reset-password", None, "{}"))
    elif args.sub == "delete":
        out(*request("DELETE", f"/api/v1/users/{args.id}"))


def cmd_raw(args):
    body = json.loads(args.json) if args.json else None
    out(*request(args.method, args.path, None, body))


# ---------- 参数解析 ----------
def build_parser():
    p = argparse.ArgumentParser(description="Token00 远程后台管理 CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("settings"); ssp = sp.add_subparsers(dest="sub", required=True)
    ssp.add_parser("get-all")
    g = ssp.add_parser("get"); g.add_argument("--keys", nargs="+", required=True)
    s = ssp.add_parser("set"); s.add_argument("--key", required=True); s.add_argument("--value", required=True); s.add_argument("--json", action="store_true")
    sm = ssp.add_parser("set-many"); sm.add_argument("--file", required=True)
    sp.set_defaults(func=cmd_settings)

    fl = sub.add_parser("friend-links"); fsp = fl.add_subparsers(dest="sub", required=True)
    fsp.add_parser("list")
    c = fsp.add_parser("create"); c.add_argument("--name", required=True); c.add_argument("--url", required=True); c.add_argument("--description")
    u = fsp.add_parser("update"); u.add_argument("--id", required=True); u.add_argument("--json", required=True)
    d = fsp.add_parser("delete"); d.add_argument("--id", required=True)
    fl.set_defaults(func=cmd_friend_links)

    se = sub.add_parser("sections"); esp = se.add_subparsers(dest="sub", required=True)
    esp.add_parser("list")
    c = esp.add_parser("create"); c.add_argument("--name", required=True); c.add_argument("--path", required=True); c.add_argument("--slug")
    u = esp.add_parser("update"); u.add_argument("--id", required=True); u.add_argument("--json", required=True)
    d = esp.add_parser("delete"); d.add_argument("--id", required=True)
    se.set_defaults(func=cmd_sections)

    ca = sub.add_parser("categories"); csp = ca.add_subparsers(dest="sub", required=True)
    csp.add_parser("list")
    c = csp.add_parser("create"); c.add_argument("--name", required=True); c.add_argument("--section-id", required=True, type=int); c.add_argument("--slug"); c.add_argument("--description")
    u = csp.add_parser("update"); u.add_argument("--id", required=True, type=int); u.add_argument("--json", required=True)
    d = csp.add_parser("delete"); d.add_argument("--id", required=True, type=int)
    ca.set_defaults(func=cmd_categories)

    bk = sub.add_parser("backup"); bsp = bk.add_subparsers(dest="sub", required=True)
    bsp.add_parser("settings")
    bsp.add_parser("set").add_argument("--json", required=True)
    bsp.add_parser("create")
    bsp.add_parser("list")
    bsp.add_parser("restore-id").add_argument("--id", required=True, type=int)
    bsp.add_parser("delete").add_argument("--id", required=True, type=int)
    bk.set_defaults(func=cmd_backup)

    ad = sub.add_parser("ads"); adsp = ad.add_subparsers(dest="sub", required=True)
    adsp.add_parser("list"); adsp.add_parser("pending")
    adsp.add_parser("create").add_argument("--json", required=True)
    adsp.add_parser("approve").add_argument("--id", required=True, type=int)
    rj = adsp.add_parser("reject"); rj.add_argument("--id", required=True, type=int); rj.add_argument("--note")
    tg = adsp.add_parser("toggle"); tg.add_argument("--id", required=True, type=int); tg.add_argument("--active", choices=["true", "false"], required=True)
    ad.set_defaults(func=cmd_ads)

    kw = sub.add_parser("keywords"); kwsp = kw.add_subparsers(dest="sub", required=True)
    kwsp.add_parser("list")
    a = kwsp.add_parser("add"); a.add_argument("--keyword", required=True); a.add_argument("--category"); a.add_argument("--severity"); a.add_argument("--action"); a.add_argument("--scope")
    kwsp.add_parser("delete").add_argument("--id", required=True, type=int)
    kwsp.add_parser("batch").add_argument("--json", required=True)
    kw.set_defaults(func=cmd_keywords)

    rv = sub.add_parser("reviews"); rvsp = rv.add_subparsers(dest="sub", required=True)
    rvsp.add_parser("list"); rvsp.add_parser("pending"); rvsp.add_parser("stats")
    for act in ("approve", "reject", "retry"):
        ap = rvsp.add_parser(act); ap.add_argument("--id", required=True, type=int); ap.add_argument("--note")
    rv.set_defaults(func=cmd_reviews)

    us = sub.add_parser("users"); usp = us.add_subparsers(dest="sub", required=True)
    usp.add_parser("list")
    c = usp.add_parser("create"); c.add_argument("--username", required=True); c.add_argument("--password", required=True); c.add_argument("--role", default="user"); c.add_argument("--display-name")
    u = usp.add_parser("update"); u.add_argument("--id", required=True, type=int); u.add_argument("--json", required=True)
    usp.add_parser("reset-pwd").add_argument("--id", required=True, type=int)
    usp.add_parser("delete").add_argument("--id", required=True, type=int)
    us.set_defaults(func=cmd_users)

    rw = sub.add_parser("raw"); rw.add_argument("--method", required=True); rw.add_argument("--path", required=True); rw.add_argument("--json")
    rw.set_defaults(func=cmd_raw)

    return p


if __name__ == "__main__":
    args = build_parser().parse_args()
    args.func(args)

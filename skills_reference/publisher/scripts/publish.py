#!/usr/bin/env python3
"""
Token00 文章发布脚本

从 Markdown 文件发布文章到 AI Publish API。

功能:
  - 解析 Markdown frontmatter 获取元数据
  - 自动检测并上传本地图片，替换为远程 URL
  - 根据 frontmatter 或内容关键词自动匹配板块+分类
  - 自动追加作者署名
  - 支持单文件/批量目录发布

用法:
  python publish.py <article.md>
  python publish.py <directory>/
  python publish.py <article.md> --status draft
  python publish.py <article.md> --section ai_coding --category tools
  python publish.py <article.md> --force-slug my-article
  python publish.py <article.md> --api-base https://x.com/api/v1 --token t00_sk_xxx --author "Name"
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import resolve_config
from backup import save_backup
from util import (
    api_request,
    parse_frontmatter,
    process_media_in_content,
)


# ============================================================
# 板块+分类智能匹配
# ============================================================


def auto_detect_section(title: str, content: str, section_map: dict, default_section: str) -> str:
    """根据标题+内容关键词匹配板块"""
    text = (title + " " + content).lower()
    section_map_lower = {k.lower(): v for k, v in section_map.items()}

    # 先检查标题中的关键词（权重更高）
    title_lower = title.lower()
    for keyword, section_slug in section_map_lower.items():
        if keyword in title_lower:
            return section_slug

    # 再检查内容中的关键词
    for keyword, section_slug in section_map_lower.items():
        if keyword in text:
            return section_slug

    return default_section or "blog"


def fetch_categories_for_section(api_base: str, section_slug: str, token: str) -> list[dict]:
    """通过 API 获取板块下的分类列表"""
    sections_resp = api_request("GET", f"{api_base}/sections", token)
    if not sections_resp.get("success"):
        return []

    sections = sections_resp.get("data", [])
    target = None
    for s in sections:
        if s.get("slug") == section_slug:
            target = s
            break

    if not target:
        return []

    cats_resp = api_request("GET", f"{api_base}/sections/{target['id']}/categories", token)
    if not cats_resp.get("success"):
        return []
    return cats_resp.get("data", [])


def auto_detect_category(title: str, content: str, categories: list[dict]) -> str | None:
    """根据标题+内容关键词匹配分类"""
    if not categories:
        return None

    text = (title + " " + content).lower()

    for cat in categories:
        cat_name = cat.get("name", "").lower()
        cat_desc = (cat.get("description") or "").lower()
        if cat_name and cat_name in text:
            return cat.get("slug") or cat.get("name")
        if cat_desc and len(cat_desc) > 2 and cat_desc in text:
            return cat.get("slug") or cat.get("name")

    return None


# ============================================================
# 作者署名
# ============================================================


def append_author_signature(content: str, author: str) -> str:
    """在文章末尾追加作者署名（如果内容中没有的话）"""
    if not author:
        return content

    # 检查是否已有署名（匹配多种格式）
    patterns = [
        # 格式1: 作者：xxx 或 Author: xxx
        r"(作者[：:]|Author[：:])\s*" + re.escape(author),
        # 格式2: 本文由 **xxx** 发布
        r"本文由\s*\*{1,2}" + re.escape(author) + r"\*{1,2}\s*发布",
    ]
    for pat in patterns:
        if re.search(pat, content, re.IGNORECASE):
            return content

    signature = f"\n\n---\n\n> 本文由 **{author}** 发布\n"
    return content.rstrip() + signature


# ============================================================
# 发布
# ============================================================


def publish_article(
    markdown_path: str,
    token: str,
    api_base: str,
    status_override: str = None,
    section_override: str = None,
    category_override: str = None,
    force_slug: str = None,
    author: str = "",
    section_map: dict = None,
    default_section: str = "blog",
) -> dict:
    """发布单篇文章"""
    with open(markdown_path, "r", encoding="utf-8") as f:
        raw_content = f.read()

    meta, body = parse_frontmatter(raw_content)
    md_dir = str(Path(markdown_path).parent)

    # 构建基础 payload
    payload = {"content": body}

    field_map = {
        "title": "title",
        "coverImageUrl": "coverImageUrl",
        "publishedAt": "publishedAt",
    }
    for md_key, api_key in field_map.items():
        if md_key in meta:
            payload[api_key] = meta[md_key]

    if "tags" in meta:
        payload["tags"] = meta["tags"]

    # --- 状态 (CLI > frontmatter > published) ---
    if status_override:
        payload["status"] = status_override
    elif "status" in meta:
        payload["status"] = meta["status"]
    else:
        payload["status"] = "published"

    # --- slug (CLI --force-slug > frontmatter > auto) ---
    if force_slug:
        payload["slug"] = force_slug
    elif "slug" in meta:
        payload["slug"] = meta["slug"]

    # --- 板块 (CLI --section > frontmatter > auto-detect > default) ---
    title = payload.get("title", "")
    section_map = section_map or {}
    default_section = default_section or "blog"

    if section_override:
        payload["section"] = section_override
    elif "section" in meta:
        payload["section"] = meta["section"]
    else:
        detected = auto_detect_section(title, body, section_map, default_section)
        payload["section"] = detected

    # --- 分类 (CLI --category > frontmatter > auto-detect) ---
    if category_override:
        payload["category"] = category_override
    elif "category" in meta:
        payload["category"] = meta["category"]
    else:
        categories = fetch_categories_for_section(api_base, payload["section"], token)
        detected_cat = auto_detect_category(title, body, categories)
        if detected_cat:
            payload["category"] = detected_cat

    # --- 媒体处理（图片/视频/音频自动上传） ---
    processed_content, media_stats = process_media_in_content(
        payload["content"], md_dir, token, api_base, payload["section"]
    )
    payload["content"] = processed_content

    # --- 作者署名 ---
    if author:
        payload["content"] = append_author_signature(payload["content"], author)

    # --- 校验 ---
    required = ["title", "content", "section"]
    missing = [f for f in required if f not in payload or not payload[f]]
    if missing:
        return {
            "success": False,
            "error": f"Missing required fields: {', '.join(missing)}",
            "file": markdown_path,
        }

    # --- 发送 ---
    url = f"{api_base}/ai/publish"
    print(f"\n  Title:    {payload['title']}")
    print(f"  Section:  {payload['section']}")
    if "category" in payload:
        print(f"  Category: {payload['category']}")
    print(f"  Slug:     {payload.get('slug', 'auto')}")
    print(f"  Status:   {payload.get('status', 'draft')}")
    if media_stats.get("ok") or media_stats.get("fail"):
        parts = []
        if media_stats.get("images"):
            parts.append(f"{media_stats['images']} images")
        if media_stats.get("videos"):
            parts.append(f"{media_stats['videos']} videos")
        if media_stats.get("audio"):
            parts.append(f"{media_stats['audio']} audio")
        media_str = " + ".join(parts) if parts else "files"
        print(f"  Media:    {media_str} uploaded")
        if media_stats["fail"]:
            print(f"  Skip:     {media_stats['fail']} failed")

    result = api_request("POST", url, token, payload)
    result["_payload"] = payload
    result["_source_file"] = markdown_path
    return result


# ============================================================
# Main
# ============================================================


def main():
    parser = argparse.ArgumentParser(
        description="Publish Markdown articles via AI Publish API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s article.md                          Publish with config defaults
  %(prog)s posts/                              Batch publish all .md in dir
  %(prog)s article.md --status draft           Publish as draft
  %(prog)s article.md --section ai_coding       Override section
  %(prog)s article.md --category tools          Override category
  %(prog)s article.md --force-slug my-article   Force slug (for update)
  %(prog)s article.md --author "My Name"       Override author
        """,
    )
    parser.add_argument("path", help="Markdown file or directory to publish")
    parser.add_argument("--status", choices=["draft", "published"], default=None)
    parser.add_argument("--section", default=None, help="Override section slug")
    parser.add_argument("--category", default=None, help="Override category slug")
    parser.add_argument("--force-slug", default=None, help="Force article slug (for updating existing article)")
    parser.add_argument("--token", default=None, help="API token (direct)")
    parser.add_argument("--token-file", default=None, help="Path to API token file")
    parser.add_argument("--api-base", default=None, help="API base URL")
    parser.add_argument("--author", default=None, help="Author name for signature")

    args = parser.parse_args()

    api_base, token, conf = resolve_config(
        api_base=args.api_base,
        token=args.token,
        token_file=args.token_file,
        author=args.author,
    )

    author = args.author or conf.get("author", "")
    section_map = conf.get("section_map", {})
    default_section = conf.get("default_section", "blog")

    target = Path(args.path)

    if target.is_file():
        files = [target]
    elif target.is_dir():
        files = sorted(target.glob("*.md"))
        if not files:
            print(f"No .md files found in {target}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"Error: {target} is not a valid file or directory", file=sys.stderr)
        sys.exit(1)

    print(f"AI Publish - {len(files)} article(s)")
    print(f"API: {api_base}")
    if author:
        print(f"Author: {author}")
    print("=" * 60)

    success_count = 0
    fail_count = 0

    for f in files:
        result = publish_article(
            str(f),
            token,
            api_base,
            status_override=args.status,
            section_override=args.section,
            category_override=args.category,
            force_slug=args.force_slug,
            author=author,
            section_map=section_map,
            default_section=default_section,
        )

        if result.get("success"):
            success_count += 1
            data = result.get("data", {})
            print(f"  Result:   OK ({data.get('action', 'created')})")
            print(f"  URL:      {data.get('url', '-')}")

            backup_path = save_backup(
                source_file=result.get("_source_file", ""),
                result_data=data,
                payload=result.get("_payload", {}),
                author=author,
            )
            if backup_path:
                print(f"  Backup:   {backup_path}")
        else:
            fail_count += 1
            print(f"  Result:   FAILED")
            print(f"  Error:    {result.get('error', 'Unknown error')}")
            hint = result.get("hint", "")
            if hint:
                print(f"  Hint:     {hint}")

        print("-" * 60)

    print(f"\nDone: {success_count} succeeded, {fail_count} failed out of {len(files)} total")
    sys.exit(1 if fail_count > 0 else 0)


if __name__ == "__main__":
    main()

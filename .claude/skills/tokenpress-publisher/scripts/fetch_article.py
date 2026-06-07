#!/usr/bin/env python3
"""
Token00 文章拉取脚本

从 Token00 网站拉取已发布文章，导出为带 frontmatter 的 Markdown 文件，
方便本地编辑后重新发布（更新）。

用法:
  python fetch_article.py <URL或slug>
  python fetch_article.py https://www.token00.com/token-plan/china-coding-plan-comparison-2026
  python fetch_article.py china-coding-plan-comparison-2026
  python fetch_article.py <URL> --output posts/article.md
  python fetch_article.py --list                           列出所有已发布文章
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import resolve_config
from util import api_request, parse_frontmatter, derive_site_url


def extract_slug_from_url(url: str) -> str | None:
    """从文章 URL 中提取 slug"""
    clean = url.split("?")[0].split("#")[0].rstrip("/")
    parts = clean.rstrip("/").split("/")
    if len(parts) >= 2:
        return parts[-1]
    elif len(parts) == 1 and parts[0]:
        return parts[0]
    return None


def find_article_by_slug(api_base: str, token: str, slug: str) -> dict | None:
    """
    通过 AI Articles 列表查找文章 ID，然后获取完整内容。
    返回完整文章数据字典，未找到返回 None。
    """
    page = 1
    while True:
        list_url = f"{api_base}/ai/articles?page={page}&limit=50"
        resp = api_request("GET", list_url, token)
        if not resp.get("success"):
            print(f"Error listing articles: {resp.get('error')}", file=sys.stderr)
            return None

        articles = resp.get("data", [])
        if not articles:
            break

        for a in articles:
            if a.get("slug") == slug:
                article_id = a["id"]
                list_section = a.get("section") or {}
                detail_resp = api_request("GET", f"{api_base}/articles/{article_id}")
                if detail_resp.get("success"):
                    article = detail_resp["data"]
                    if not article.get("section") and list_section:
                        article["section"] = list_section
                    return article
                else:
                    print(f"Error fetching article detail: {detail_resp.get('error')}", file=sys.stderr)
                    return None

        page += 1

    return None


def article_to_markdown(article: dict) -> str:
    """将 API 返回的文章数据转换为带 frontmatter 的 Markdown"""
    fm = {}

    fm["title"] = article.get("title", "")

    section = article.get("section")
    if section and isinstance(section, dict):
        fm["section"] = section.get("slug", "")
    elif article.get("sectionId"):
        fm["section"] = str(article["sectionId"])

    category = article.get("category")
    if category and isinstance(category, dict):
        fm["category"] = category.get("slug") or category.get("name", "")
    elif article.get("categoryId"):
        fm["category"] = str(article["categoryId"])

    tags = article.get("tags", [])
    if tags and isinstance(tags, list):
        tag_names = []
        for t in tags:
            if isinstance(t, dict):
                tag_names.append(t.get("name", ""))
            elif isinstance(t, str):
                tag_names.append(t)
        if tag_names:
            fm["tags"] = tag_names

    if article.get("coverImage"):
        fm["coverImageUrl"] = article["coverImage"]
    if article.get("slug"):
        fm["slug"] = article["slug"]
    if article.get("status"):
        fm["status"] = article["status"]
    if article.get("publishedAt"):
        fm["publishedAt"] = article["publishedAt"]

    fm_lines = ["---"]
    for key, value in fm.items():
        if key == "tags" and isinstance(value, list):
            fm_lines.append("tags:")
            for tag in value:
                fm_lines.append(f"  - {tag}")
        else:
            fm_lines.append(f"{key}: {value}")
    fm_lines.append("---")

    content = article.get("content", "")
    return "\n".join(fm_lines) + "\n\n" + content


def list_articles(api_base: str, token: str, limit: int = 50) -> None:
    """列出所有已发布文章"""
    site_url = derive_site_url(api_base)
    page = 1
    total = 0

    while True:
        resp = api_request("GET", f"{api_base}/ai/articles?page={page}&limit={limit}", token)
        if not resp.get("success"):
            print(f"Error: {resp.get('error')}", file=sys.stderr)
            return

        articles = resp.get("data", [])
        if not articles:
            break

        for a in articles:
            section = a.get("section", {})
            section_slug = section.get("slug", "?") if isinstance(section, dict) else "?"
            url = f"{site_url}/{section_slug}/{a['slug']}"
            date = a.get("publishedAt", "")[:10] if a.get("publishedAt") else ""
            print(f"  [{a['id']:>4}] {date}  {section_slug}/{a['slug']}")
            print(f"        {a.get('title', '')[:80]}")
            print(f"        {url}")
            total += 1

        page += 1

    print(f"\nTotal: {total} article(s)")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch published articles from Token00 for editing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --list                                          List all articles
  %(prog)s china-coding-plan-comparison-2026                Fetch by slug
  %(prog)s https://www.token00.com/blog/my-article        Fetch by URL
  %(prog)s my-article --output posts/my-article.md          Save to specific path
        """,
    )
    parser.add_argument("target", nargs="?", help="Article URL, slug, or article ID")
    parser.add_argument("--output", "-o", default=None, help="Output file path (default: auto-generated)")
    parser.add_argument("--list", action="store_true", help="List all published articles")
    parser.add_argument("--token", default=None, help="API token (direct)")
    parser.add_argument("--token-file", default=None, help="Path to API token file")
    parser.add_argument("--api-base", default=None, help="API base URL")

    args = parser.parse_args()

    api_base, token, conf = resolve_config(
        api_base=args.api_base,
        token=args.token,
        token_file=args.token_file,
    )

    if args.list:
        print(f"Published Articles on {api_base}")
        print("=" * 60)
        list_articles(api_base, token)
        return

    if not args.target:
        parser.print_help()
        sys.exit(1)

    target = args.target.strip()

    if "/" in target or target.startswith("http"):
        slug = extract_slug_from_url(target)
    else:
        slug = target

    if not slug:
        print(f"Error: Cannot extract slug from '{target}'", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching article: {slug}")
    article = find_article_by_slug(api_base, token, slug)

    if not article:
        print(f"Error: Article '{slug}' not found", file=sys.stderr)
        sys.exit(1)

    markdown = article_to_markdown(article)

    if args.output:
        out_path = Path(args.output)
    else:
        out_path = Path.cwd() / f"{slug}.md"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(markdown)

    section = article.get("section")
    if section and isinstance(section, dict):
        section_slug = section.get("slug", "?")
        section_name = section.get("name", "")
    else:
        section_slug = "?"
        section_name = ""
    category = article.get("category")
    cat_name = category.get("name", "") if category and isinstance(category, dict) else ""

    site_url = derive_site_url(api_base)
    print(f"  Title:   {article.get('title', '')}")
    print(f"  Section: {section_name} ({section_slug})")
    if cat_name:
        print(f"  Category: {cat_name}")
    print(f"  Slug:    {slug}")
    print(f"  Status:  {article.get('status', '')}")
    print(f"  Saved:   {out_path}")
    print(f"\nEdit the file, then publish to update:")
    print(f"  python publish.py {out_path}")
    print(f"\nOr force-update a specific slug:")
    print(f"  python publish.py {out_path} --force-slug {slug}")


if __name__ == "__main__":
    main()

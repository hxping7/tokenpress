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
    upload_local_file,
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
# 作者署名 + 智能免责声明
# ============================================================

# 金融/投资关键词（命中 ≥2 个触发金融免责声明）
FINANCE_KEYWORDS = [
    "股票", "股市", "A股", "港股", "美股", "基金", "投资", "理财",
    "收益", "涨跌", "涨停", "跌停", "大盘", "基金", "债券", "期货",
    "杠杆", "融资", "融券", "牛市", "熊市", "利率", "汇率",
    "通胀", "通缩", "分红", "股息", "市值", "市盈率", "PE",
    "ROI", "年化", "持仓", "仓位", "止盈", "止损", "回撤",
]

# 医疗/健康关键词（命中 ≥2 个触发医疗免责声明）
MEDICAL_KEYWORDS = [
    "治疗", "诊断", "症状", "药物", "处方", "手术", "疗效",
    "临床", "患者", "痊愈", "康复", "副作用", "禁忌", "剂量",
    "抗生素", "疫苗", "感染", "慢性病", "急性", "肿瘤", "癌症",
    "血压", "血糖", "心率", "失眠", "抑郁", "焦虑",
]


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


def _count_keyword_hits(text: str, keywords: list[str]) -> int:
    """统计文本中命中的关键词数量"""
    text_lower = text.lower()
    count = 0
    for kw in keywords:
        if kw.lower() in text_lower:
            count += 1
    return count


def append_disclaimer(content: str, title: str = "", tags: list[str] = None) -> str:
    """
    智能免责声明：当文章涉及金融/医疗领域时，自动追加对应的免责声明。

    触发条件：标题+正文+标签 合并文本中，某类关键词命中 ≥2 个
    防重复机制：HTML 标记 / 正则检测已存在声明 / 去重
    """
    # 防重复 1：作者手动标记跳过
    if "<!--token00-disclaimer-->" in content:
        return content

    # 防重复 2：已存在免责声明/风险提示
    if re.search(r">\s*\*{1,2}(免责声明|风险提示)\*{1,2}[：:]", content):
        return content

    # 合并检测文本
    check_text = title
    if tags:
        check_text += " " + " ".join(tags)
    # 正文只取前 2000 字符做检测（避免全文扫描开销）
    check_text += " " + content[:2000]

    finance_hits = _count_keyword_hits(check_text, FINANCE_KEYWORDS)
    medical_hits = _count_keyword_hits(check_text, MEDICAL_KEYWORDS)

    disclaimer = None
    if finance_hits >= 2:
        disclaimer = "\n> ⚠️ **风险提示**：本文由 AI 基于公开信息收集整理，仅供参考学习，不构成任何投资建议。股市有风险，投资需谨慎。"
    elif medical_hits >= 2:
        disclaimer = "\n> ⚠️ **免责声明**：本文由 AI 基于公开资料整理，仅供参考，不构成医疗建议。请咨询专业医疗机构。"

    if disclaimer:
        content = content.rstrip()
        # 如果末尾已有作者署名，插在署名之前
        sig_match = re.search(r"\n---\n\n> 本文由\s*\*{1,2}.+?\*{1,2}\s*发布\s*$", content)
        if sig_match:
            content = content[:sig_match.start()] + disclaimer + content[sig_match.start():]
        else:
            content += disclaimer

    return content


# ============================================================
# 发布
# ============================================================


def process_cover_image(
    cover_value: str,
    md_dir: str,
    token: str,
    api_base: str,
    section: str = "blog",
) -> str:
    """
    处理 coverImageUrl frontmatter 字段：
    - 若是本地文件路径，自动上传并替换为远程 URL
    - 若是 http(s) 或 data URI，原样返回
    """
    if not cover_value:
        return cover_value

    s = cover_value.strip()

    # 远程 URL 或 data URI，直接返回
    if s.startswith("http://") or s.startswith("https://") or s.startswith("data:"):
        return s

    # 解析本地路径（支持 ./  ../  绝对路径）
    if os.path.isabs(s):
        local_path = os.path.normpath(s)
    else:
        local_path = os.path.normpath(os.path.join(md_dir, s))

    if not os.path.isfile(local_path):
        print(f"    [WARN] coverImage not found: {local_path}")
        return s

    print(f"    [COVER] uploading {os.path.basename(local_path)}...")
    result = upload_local_file(local_path, token, api_base, section)

    if result.get("success"):
        remote_url = result.get("data", {}).get("url", "")
        if remote_url:
            print(f"    [COVER] uploaded -> {remote_url}")
            return remote_url
        else:
            print(f"    [WARN] coverImage upload returned no URL, keeping original")
            return s
    else:
        print(f"    [WARN] coverImage upload failed: {result.get('error', 'Unknown')}, keeping original")
        return s


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

    # --- 封面图处理（本地路径自动上传） ---
    if "coverImageUrl" in payload and payload["coverImageUrl"]:
        new_cover = process_cover_image(
            payload["coverImageUrl"], md_dir, token, api_base, payload.get("section", "blog")
        )
        payload["coverImageUrl"] = new_cover

    # --- 作者署名 ---
    if author:
        payload["content"] = append_author_signature(payload["content"], author)

    # --- 智能免责声明（金融/医疗关键词自动触发） ---
    tags = payload.get("tags", [])
    payload["content"] = append_disclaimer(
        payload["content"],
        title=payload.get("title", ""),
        tags=tags if isinstance(tags, list) else [],
    )

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
        if media_stats.get("documents"):
            parts.append(f"{media_stats['documents']} documents")
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
            detail = result.get("detail", "")
            hint = result.get("hint", "")
            if detail:
                print(f"  Detail:   {detail}")
            if hint:
                print(f"  Hint:     {hint}")

        print("-" * 60)

    print(f"\nDone: {success_count} succeeded, {fail_count} failed out of {len(files)} total")
    sys.exit(1 if fail_count > 0 else 0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Token00 发布备份模块

发布成功后自动在本地留存备份：
  - published/            备份目录
    ├── YYYY-MM-DD_slug.md     带 frontmatter 的完整 Markdown 备份
    └── manifest.json           发布记录索引

manifest.json 格式:
  [
    {
      "id": 4,
      "slug": "article-slug",
      "title": "文章标题",
      "url": "https://www.token00.com/blog/article-slug",
      "section": "blog",
      "category": "ai-tools",
      "tags": ["AI", "测试"],
      "author": "HXP",
      "status": "published",
      "action": "created",
      "publishedAt": "2026-06-06T08:30:00Z",
      "backupFile": "2026-06-06_article-slug.md",
      "sourceFile": "posts/article.md"
    }
  ]
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from util import parse_frontmatter


def get_backup_dir(source_file: str = None) -> Path:
    """获取备份目录路径"""
    if source_file:
        source_dir = Path(source_file).parent
        cwd = Path.cwd()
        for directory in [source_dir, cwd] + list(cwd.parents):
            candidate = directory / "published"
            if candidate.is_dir():
                return candidate
        return source_dir / "published"
    return Path.cwd() / "published"


def save_backup(
    source_file: str,
    result_data: dict,
    payload: dict,
    author: str = "",
) -> str | None:
    """发布成功后保存备份，返回备份文件路径"""
    backup_dir = get_backup_dir(source_file)
    backup_dir.mkdir(parents=True, exist_ok=True)

    slug = result_data.get("slug", "unknown")
    now = datetime.now(timezone.utc)
    date_prefix = now.strftime("%Y-%m-%d")

    # 读取原始源文件
    with open(source_file, "r", encoding="utf-8") as f:
        raw_content = f.read()

    meta, body = parse_frontmatter(raw_content)

    # 补全/覆盖 frontmatter 为实际发布数据
    backup_meta = {}
    for k, v in meta.items():
        if k not in ("section", "category", "status", "slug"):
            backup_meta[k] = v

    backup_meta["title"] = payload.get("title", meta.get("title", ""))
    backup_meta["slug"] = slug
    backup_meta["section"] = payload.get("section", meta.get("section", ""))
    if payload.get("category"):
        backup_meta["category"] = payload["category"]
    backup_meta["status"] = result_data.get("status", payload.get("status", "published"))
    backup_meta["publishedAt"] = result_data.get("publishedAt", now.isoformat())
    if payload.get("tags"):
        backup_meta["tags"] = payload["tags"]
    if "coverImageUrl" in payload:
        backup_meta["coverImageUrl"] = payload["coverImageUrl"]

    # 重建 Markdown
    fm_lines = ["---"]
    for key, value in backup_meta.items():
        if key == "tags" and isinstance(value, list):
            fm_lines.append("tags:")
            for tag in value:
                fm_lines.append(f"  - {tag}")
        else:
            fm_lines.append(f"{key}: {value}")
    fm_lines.append("---")

    backup_content = "\n".join(fm_lines) + "\n\n" + payload.get("content", body)

    backup_filename = f"{date_prefix}_{slug}.md"
    backup_path = backup_dir / backup_filename

    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(backup_content)

    _update_manifest(backup_dir, {
        "id": result_data.get("id"),
        "slug": slug,
        "title": payload.get("title", ""),
        "url": result_data.get("url", ""),
        "section": payload.get("section", ""),
        "category": payload.get("category", ""),
        "tags": payload.get("tags", []),
        "author": author,
        "status": result_data.get("status", ""),
        "action": result_data.get("action", ""),
        "publishedAt": result_data.get("publishedAt", now.isoformat()),
        "backupFile": backup_filename,
        "sourceFile": os.path.relpath(source_file, backup_dir.parent) if backup_dir.parent else source_file,
    })

    return str(backup_path)


def _update_manifest(backup_dir: Path, record: dict) -> None:
    manifest_path = backup_dir / "manifest.json"

    records = []
    if manifest_path.is_file():
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                records = json.loads(f.read())
        except (json.JSONDecodeError, IOError):
            records = []

    slug = record.get("slug")
    found = False
    for i, r in enumerate(records):
        if r.get("slug") == slug:
            records[i] = record
            found = True
            break
    if not found:
        records.append(record)

    records.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

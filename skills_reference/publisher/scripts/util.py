#!/usr/bin/env python3
"""
Token00 共享工具模块

提供所有脚本通用的工具函数，消除代码重复。
"""

import base64
import json
import os
import re
import sys
from pathlib import Path

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass


# ============================================================
# 常量
# ============================================================

SUPPORTED_TYPES = {
    # 图片
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".bmp": "image/bmp", ".ico": "image/x-icon",
    # 视频
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
    # 音频
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".m4a": "audio/mp4", ".flac": "audio/flac", ".wma": "audio/x-ms-wma",
    ".aac": "audio/aac",
}

# Markdown 图片/媒体引用：![alt](path)
MD_MEDIA_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")

# HTML 媒体标签：<video src="path">, <audio src="path">, <source src="path">
HTML_SRC_RE = re.compile(r'<(video|audio|source|img)\b[^>]*\bsrc="([^"]+)"', re.IGNORECASE)


# ============================================================
# API 请求
# ============================================================


def api_request(method: str, url: str, token: str = None, data: dict = None) -> dict:
    """发送 HTTP 请求到 Token00 API，返回解析后的 JSON 字典"""
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data, ensure_ascii=False).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        try:
            return json.loads(error_body)
        except json.JSONDecodeError:
            return {"success": False, "error": error_body, "statusCode": e.code}
    except urllib.error.URLError as e:
        return {"success": False, "error": str(e.reason)}


# ============================================================
# Frontmatter 解析（支持 YAML 列表格式）
# ============================================================


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """
    解析 Markdown frontmatter，返回 (metadata, body)。

    支持格式:
      ---
      title: My Title
      tags: [AI, 编程]           # 行内数组
      tags: AI, 编程              # 逗号分隔
      tags:                       # YAML 列表
        - AI
        - 编程
      ---
    """
    match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$", content)
    if not match:
        return {}, content

    raw = match.group(1)
    body = match.group(2).strip()
    metadata = {}
    lines = raw.split("\n")

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line or ":" not in line:
            continue

        key = line[: line.index(":")].strip()
        value = line[line.index(":") + 1 :].strip()

        if key == "tags":
            arr_match = re.match(r"\[([\s\S]*)\]", value)
            if arr_match:
                metadata["tags"] = [
                    t.strip().lstrip("- ")
                    for t in arr_match.group(1).split(",")
                    if t.strip().lstrip("- ")
                ]
            elif value == "" or value == "[":
                tag_list = []
                while i < len(lines):
                    next_line = lines[i].strip()
                    if next_line.startswith("- "):
                        tag_list.append(next_line[2:].strip().strip('"').strip("'"))
                        i += 1
                    else:
                        break
                metadata["tags"] = tag_list
            else:
                metadata["tags"] = [t.strip() for t in value.split(",") if t.strip()]
        else:
            metadata[key] = value

    return metadata, body


# ============================================================
# 本地媒体上传
# ============================================================


def upload_local_file(
    file_path: str, token: str, api_base: str, section: str = "blog"
) -> dict:
    """上传任意本地媒体文件（图片/视频/音频），返回 API 响应"""
    filename = os.path.basename(file_path)
    ext = Path(filename).suffix.lower()
    mime = SUPPORTED_TYPES.get(ext, "application/octet-stream")

    with open(file_path, "rb") as f:
        file_data = base64.b64encode(f.read()).decode("ascii")

    payload = {
        "file": file_data,
        "filename": filename,
        "mimeType": mime,
        "section": section,
    }
    return api_request("POST", f"{api_base}/media/ai", token, payload)


# ============================================================
# 内容媒体处理（统一图片/视频/音频）
# ============================================================


def process_media_in_content(
    content: str,
    md_file_dir: str,
    token: str,
    api_base: str,
    section: str = "blog",
) -> tuple[str, dict]:
    """
    扫描 Markdown 全文中的媒体引用（图片/视频/音频），
    自动上传本地文件并替换为远程 URL。

    支持的引用方式:
      - Markdown:  ![alt](./images/photo.png)
      - Markdown:  ![视频演示](./videos/demo.mp4)
      - HTML:      <video src="./videos/demo.mp4" controls></video>
      - HTML:      <audio src="./music/intro.mp3" autoplay></audio>
      - HTML:      <source src="./media/clip.webm" type="video/webm">

    返回: (替换后的 content, 统计信息 dict)
      stats = {
          "ok": 总成功数,
          "fail": 总失败数,
          "images": 图片上传数,
          "videos": 视频上传数,
          "audio": 音频上传数,
          "by_type": {"image": 3, "video": 1, "audio": 0}
      }
    """
    stats = {
        "ok": 0, "fail": 0,
        "images": 0, "videos": 0, "audio": 0,
        "by_type": {},
    }
    uploaded_urls = {}  # 文件绝对路径 -> 远程 URL（避免重复上传）

    def _media_type(ext: str) -> str:
        mime = SUPPORTED_TYPES.get(ext.lower(), "")
        if mime.startswith("image/"):
            return "image"
        if mime.startswith("video/"):
            return "video"
        if mime.startswith("audio/"):
            return "audio"
        return "other"

    def _upload_and_replace(local_path: str, media_type_hint: str = None) -> str | None:
        """上传本地文件，返回远程 URL；失败返回 None"""
        nonlocal stats

        if not os.path.isfile(local_path):
            return None

        key = os.path.normcase(os.path.normpath(local_path))
        if key in uploaded_urls:
            return uploaded_urls[key]  # 已上传过

        ext = Path(local_path).suffix.lower()
        mtype = _media_type(ext)

        print(f"    [UPLOAD] {mtype} {os.path.basename(local_path)}")
        result = upload_local_file(local_path, token, api_base, section)

        if result.get("success"):
            uploaded_url = result.get("data", {}).get("url", "")
            if uploaded_url:
                uploaded_urls[key] = uploaded_url
                stats["ok"] += 1
                if mtype == "image":
                    stats["images"] += 1
                elif mtype == "video":
                    stats["videos"] += 1
                elif mtype == "audio":
                    stats["audio"] += 1
                stats["by_type"][mtype] = stats["by_type"].get(mtype, 0) + 1
                return uploaded_url
            else:
                stats["fail"] += 1
                print(f"    [WARN] Upload returned no URL for {local_path}")
                return None
        else:
            stats["fail"] += 1
            mime_name = SUPPORTED_TYPES.get(ext, "unknown")
            err = result.get('error', 'Unknown')
            print(f"    [SKIP] {mime_name}: {err}")
            return None

    def _resolve_local_path(src_path: str) -> str | None:
        """将 Markdown/HTML 中的路径解析为绝对路径"""
        if not src_path:
            return None
        if src_path.startswith("data:"):
            return None
        if src_path.startswith("http://") or src_path.startswith("https://"):
            return None

        clean = src_path.lstrip("./")
        abs_path = os.path.normpath(os.path.join(md_file_dir, clean))
        if os.path.isfile(abs_path):
            return abs_path
        return None

    # --- 第1步：处理 Markdown 媒体引用 ![alt](path) ---
    def replace_md_mark(m):
        alt_text = m.group(1)
        src_path = m.group(2).strip()

        # 跳过远程/data URI
        if src_path.startswith("data:") or src_path.startswith("http://") or src_path.startswith("https://"):
            return m.group(0)
        # 跳过已上传的
        if src_path in uploaded_urls:
            return f'![{alt_text}]({uploaded_urls[src_path]})'

        local = _resolve_local_path(src_path)
        if not local:
            return m.group(0)

        # 检查是否已上传过（同一文件不同相对路径）
        norm_key = os.path.normcase(local)
        if norm_key in uploaded_urls:
            return f'![{alt_text}]({uploaded_urls[norm_key]})'

        remote_url = _upload_and_replace(local)
        if remote_url:
            return f'![{alt_text}]({remote_url})'
        return m.group(0)

    content = MD_MEDIA_RE.sub(replace_md_mark, content)

    # --- 第2步：处理 HTML 标签 <video src>, <audio src>, <source src>, <img src> ---
    def replace_html_src(m):
        tag_name = m.group(1)
        src_path = m.group(2).strip()

        if src_path.startswith("data:") or src_path.startswith("http://") or src_path.startswith("https://"):
            return m.group(0)

        local = _resolve_local_path(src_path)
        if not local:
            return m.group(0)

        norm_key = os.path.normcase(local)
        if norm_key in uploaded_urls:
            return m.group(0).replace(f'src="{src_path}"', f'src="{uploaded_urls[norm_key]}"', 1)

        remote_url = _upload_and_replace(local, tag_name)
        if remote_url:
            return m.group(0).replace(f'src="{src_path}"', f'src="{remote_url}"', 1)
        return m.group(0)

    content = HTML_SRC_RE.sub(replace_html_src, content)

    return content, stats


# ============================================================
# URL 辅助
# ============================================================


def derive_site_url(api_base: str) -> str:
    """从 API base URL 推导站点根 URL"""
    # https://www.token00.com/api/v1 → https://www.token00.com
    if api_base.endswith("/api/v1"):
        return api_base[:-7]
    if api_base.endswith("/api"):
        return api_base[:-4]
    return api_base.rstrip("/")

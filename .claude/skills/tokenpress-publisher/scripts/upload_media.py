#!/usr/bin/env python3
"""
Token00 媒体上传脚本

上传本地图片/视频文件，或通过 URL 引用外部文件到媒体库。

用法:
  python upload_media.py path/to/image.png --section blog
  python upload_media.py --url https://example.com/img.png --filename img.png
  python upload_media.py --url https://example.com/img.png --token t00_sk_xxx --api-base https://x.com/api/v1
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import resolve_config
from util import api_request, upload_local_image, SUPPORTED_TYPES


def upload_url(url: str, filename: str, token: str, api_base: str, mime: str = None) -> dict:
    if not mime:
        ext = Path(filename).suffix.lower()
        mime = SUPPORTED_TYPES.get(ext, "image/png")
    payload = {"url": url, "filename": filename, "mimeType": mime}
    return api_request("POST", f"{api_base}/media/ai", token, payload)


def main():
    parser = argparse.ArgumentParser(description="Upload media via AI Publish API")
    parser.add_argument("file", nargs="?", help="Local file path to upload")
    parser.add_argument("--url", default=None, help="Remote URL to reference")
    parser.add_argument("--filename", default=None, help="Filename for URL upload")
    parser.add_argument("--mime", default=None, help="MIME type override")
    parser.add_argument("--section", default=None, help="Storage section (e.g., blog, ai_works)")
    parser.add_argument("--token", default=None, help="API token (direct)")
    parser.add_argument("--token-file", default=None, help="Path to API token file")
    parser.add_argument("--api-base", default=None, help="API base URL")

    args = parser.parse_args()

    if not args.file and not args.url:
        parser.error("Provide either a file path or --url")

    api_base, token, conf = resolve_config(
        api_base=args.api_base,
        token=args.token,
        token_file=args.token_file,
    )

    print(f"AI Media Uploader")
    print(f"API: {api_base}")
    print("=" * 50)

    if args.file:
        result = upload_local_image(args.file, token, api_base, args.section)
    else:
        if not args.filename:
            args.filename = args.url.split("/")[-1].split("?")[0] or "unknown"
        result = upload_url(args.url, args.filename, token, api_base, args.mime)

    print(json.dumps(result, indent=2, ensure_ascii=False))

    if result.get("success"):
        data = result.get("data", {})
        print(f"\nUploaded: {data.get('url', '-')}")
        sys.exit(0)
    else:
        print(f"\nError: {result.get('error', 'Unknown')}")
        sys.exit(1)


if __name__ == "__main__":
    main()

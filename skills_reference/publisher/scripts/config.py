#!/usr/bin/env python3
"""
Token00 配置解析模块

配置优先级（从高到低）:
  1. CLI 参数 (--api-base, --token-file, --token, --author)
  2. 环境变量 (TOKEN00_API_BASE, TOKEN00_API_TOKEN, TOKEN00_TOKEN_FILE)
  3. 配置文件 (.token00.conf 在当前工作目录或项目根目录)
  4. 默认 Token 文件 (pub_token.txt 在当前工作目录)

配置文件字段:
  api_base          - API 基础 URL
  token             - API Token（直接值）
  token_file        - API Token（文件路径）
  author            - 作者署名（发布时自动追加到文章末尾）
  default_section   - 默认板块 slug（Markdown 未指定 section 时使用）
  section_map       - 关键词→板块映射（用于根据内容自动匹配板块）
"""

import json
import os
import sys
from pathlib import Path


def find_config_file() -> Path | None:
    """查找 .token00.conf 配置文件

    查找策略：
    1. 当前工作目录及其父目录
    2. 脚本所在目录及其父目录（适用于 WorkBuddy 等非项目工作目录场景）
    """
    search_dirs = []

    # 策略 1：从 cwd 向上查找
    cwd = Path.cwd()
    search_dirs.extend([cwd] + list(cwd.parents))

    # 策略 2：从脚本所在目录向上查找
    script_dir = Path(__file__).resolve().parent
    # 避免重复添加（如果脚本在 cwd 下的子目录中）
    if script_dir not in search_dirs:
        search_dirs.append(script_dir)
        for parent in script_dir.parents:
            if parent not in search_dirs:
                search_dirs.append(parent)

    for directory in search_dirs:
        conf = directory / ".token00.conf"
        if conf.is_file():
            return conf
    return None


def load_config_file(path: Path) -> dict:
    """解析 .token00.conf 文件（JSON 格式）"""
    with open(path, "r", encoding="utf-8") as f:
        return json.loads(f.read())


def _load_conf() -> tuple[dict, Path | None]:
    """读取配置文件"""
    conf_path = find_config_file()
    conf = {}
    if conf_path:
        try:
            conf = load_config_file(conf_path)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Failed to read config {conf_path}: {e}", file=sys.stderr)
    return conf, conf_path


def resolve_config(
    api_base: str = None,
    token: str = None,
    token_file: str = None,
    author: str = None,
) -> tuple[str, str, dict]:
    """
    解析最终的 API Base URL、Token 和配置字典。

    返回: (api_base, token, full_conf)
    """
    conf, conf_path = _load_conf()

    # --- API Base URL ---
    if api_base:
        final_api_base = api_base
    elif os.environ.get("TOKEN00_API_BASE"):
        final_api_base = os.environ["TOKEN00_API_BASE"]
    elif conf.get("api_base"):
        final_api_base = conf["api_base"]
    else:
        final_api_base = None

    # --- Token ---
    final_token = None

    if token:
        final_token = token
    elif token_file:
        tf_path = Path(token_file)
        if tf_path.is_file():
            final_token = tf_path.read_text(encoding="utf-8").strip()
    elif os.environ.get("TOKEN00_API_TOKEN"):
        final_token = os.environ["TOKEN00_API_TOKEN"].strip()
    elif os.environ.get("TOKEN00_TOKEN_FILE"):
        tf_path = Path(os.environ["TOKEN00_TOKEN_FILE"])
        if tf_path.is_file():
            final_token = tf_path.read_text(encoding="utf-8").strip()
    elif conf.get("token"):
        final_token = conf["token"].strip()
    elif conf.get("token_file"):
        tf_path = Path(conf["token_file"])
        if tf_path.is_file():
            final_token = tf_path.read_text(encoding="utf-8").strip()

    if not final_token:
        cwd_token = Path.cwd() / "pub_token.txt"
        if cwd_token.is_file():
            final_token = cwd_token.read_text(encoding="utf-8").strip()

    # --- Author (CLI > 配置文件) ---
    final_author = author or conf.get("author", "")

    # 校验
    if not final_api_base:
        print(
            "Error: API base URL not configured. "
            "Set via --api-base, TOKEN00_API_BASE env, or .token00.conf",
            file=sys.stderr,
        )
        sys.exit(1)

    if not final_token:
        print(
            "Error: API token not configured. "
            "Set via --token / --token-file, TOKEN00_API_TOKEN / TOKEN00_TOKEN_FILE env, "
            "or .token00.conf / pub_token.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    return final_api_base.rstrip("/"), final_token, conf

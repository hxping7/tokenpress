---
name: token00-publisher
description: 发布博客文章到 Token00 网站 (www.token00.com)。通过 AI Publish API 远程创建、更新、删除文章，上传媒体文件，管理板块/分类/标签。当用户需要发布文章、管理 Token00 博客内容、或提到"发布到 token00"、"发博客"时触发。
agent_created: true
---

# Token00 Publisher

通过 AI Publish API 远程发布和管理博客文章。支持 Markdown 文件发布、图片自动上传、智能板块/分类匹配、作者署名、智能免责声明。域名和 Token 完全解耦，支持多站点复用。

## 配置（`.token00.conf`）

在项目根目录创建 `.token00.conf`（JSON 格式，建议加入 `.gitignore`）：

```json
{
  "api_base": "https://www.token00.com/api/v1",
  "token": "t00_sk_xxxxx",
  "author": "HXP",
  "default_section": "blog",
  "section_map": {
    "编程": "ai_coding",
    "代码": "ai_coding",
    "AI作品": "ai_works",
    "作品": "ai_works",
    "Token计划": "token_plan",
    "区块链": "token_plan"
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `api_base` | Y | API 基础 URL |
| `token` 或 `token_file` | Y* | API Token（直接值或文件路径） |
| `author` | N | 作者署名，自动追加到文章末尾 |
| `default_section` | N | 默认板块，frontmatter 未指定时使用 |
| `section_map` | N | 关键词→板块 slug 映射，用于智能匹配 |

配置优先级：CLI 参数 > 环境变量 > `.token00.conf` > `pub_token.txt`

## 触发条件

当用户提到以下意图时触发本技能：

| 意图 | 示例 |
|------|------|
| **发布文章** | "发布文章到 token00"、"发博客"、"发布这篇" |
| **编辑更新文章** | "更新这篇文章"、"编辑 xxx 文章"、"修改博客内容" + URL/slug |
| **拉取文章** | "获取文章内容"、"下载文章"、"拉取 xxx" |
| **管理文章** | "列出文章"、"查看已发布文章" |
| **上传媒体** | "上传图片"、"上传媒体" |

## ⚠️ 发布前必检清单（每次发布前强制执行）

1. **封面图检查**：检查 frontmatter 中 `coverImageUrl` 是否为空
   - **若为空**：必须先生成封面 SVG → 写入 `coverImageUrl: ./封面文件名.svg` → 再执行发布
   - **`ai-info` 板块文章（AI资讯日报等）强制要求有封面图**，不允许空封面发布
2. **slug 检查**：确认 slug 是否符合预期（更新文章时 slug 必须保持不变）
3. **section 检查**：确认板块是否正确匹配（AI资讯类 → `ai-info`）
4. 执行 `python scripts/publish.py <文件>` 发布

**封面图生成规则：**
- 文件名格式：`<slug>-cover.svg`（如 `ai-daily-2026-06-11-cover.svg`），放在 `posts/` 目录下
- SVG 尺寸：1200×630（标准 OG Image 尺寸）
- 设计风格：深色背景 + 渐变色装饰 + 文章标题 + 日期 + 关键词
- 生成后直接写入 frontmatter：`coverImageUrl: ./<文件名>.svg`

## 核心功能

### 1. 发布文章（含全媒体自动上传）

使用 `scripts/publish.py`，自动处理：
- **全媒体上传**：Markdown 正文中的图片/视频/音频文件自动上传并替换 URL
- **封面自动上传**：frontmatter 中的 `coverImageUrl` 若为本地路径，自动上传并替换为完整远程 URL
- 板块/分类智能匹配：根据 frontmatter → 内容关键词 → 默认配置 三级匹配
- 作者署名：自动在末尾追加 `> 本文由 **作者名** 发布`
- 智能免责声明：金融/医疗关键词检测，自动追加风险提示或免责声明

**标题风格规范（严格执行）：**
- 禁止「归档式」标题：如 `AI资讯日报 | 2026年6月11日`（无任何信息量，像目录名）
- 必须**有料、有叙述感**：用「：」连接主题与副题，体现当日核心亮点
- 参考范例：
  - `139K Stars 的「AI 泄密档案」：Cursor、Claude Code、Devin 的系统提示词被完整公开，这意味着什么？`
  - `WWDC 2026 全程回顾：Siri AI 完全重构、iOS 27 登场，苹果 AI 战略全面加速`
  - `AI 资讯日报：Claude Fable 5 登场、Siri AI 重构，算力与具身智能双线突破`
- AI 资讯日报类文章：标题必须概括当日 2-3 个最核心事件，不能只有日期

**Markdown frontmatter 格式：**

```markdown
---
title: 文章标题
section: blog
category: ai-tools
tags:
  - AI
  - 教程
coverImageUrl: ./cover-image.svg          # 本地路径 → 自动上传，支持 SVG/PNG/JPG/GIF/WebP
slug: custom-slug
status: published
---

# 正文

文章中引用本地图片会自动上传：

![示例图片](./images/demo.png)

![外部图片](https://example.com/img.png)  <!-- 外部 URL 直接保留 -->
```

**必填：** `title`、`section`（不指定则自动匹配）
**选填：** `category`、`tags`、`slug`、`status`
**⚠️ coverImageUrl（强烈建议必填）：** AI 资讯类（`ai-info` 板块）文章**必须填写**，本地 SVG/PNG 路径或远程 URL 均可，本地路径发布时自动上传

**命令：**

```bash
# 发布单篇（自动读取 .token00.conf）
python scripts/publish.py article.md

# 批量发布目录
python scripts/publish.py posts/

# 草稿模式
python scripts/publish.py article.md --status draft

# 覆盖作者和板块
  python scripts/publish.py article.md --author "Name" --section ai_coding --category tools

  # 强制更新到指定 slug（即使文件内改了 slug 也能更新原文章）
  python scripts/publish.py article.md --force-slug my-article

  # 多站点切换
  python scripts/publish.py article.md --api-base https://other.com/api/v1 --token t00_sk_xxx
```

**CLI 参数一览：**

| 参数 | 作用 | 优先级 |
|------|------|--------|
| `--status draft/published` | 强制状态 | > 高于 frontmatter |
| `--section <slug>` | 强制板块 | > 高于 frontmatter |
| `--category <slug>` | 强制分类 | > 高于 frontmatter |
| `--force-slug <slug>` | 强制 URL slug | > 高于 frontmatter（用于更新） |
| `--author <name>` | 强制作者署名 | > 高于 `.token00.conf` |
| `--api-base <url>` | API 地址 | > 高于 `.token00.conf` |
| `--token <token>` | API Token | > 高于 `.token00.conf` |

### 2. 编辑/更新文章（核心工作流）

当用户要求更新某个已发布文章时，执行以下三步工作流：

**第 1 步：拉取文章到本地**

```bash
# 通过 URL 拉取
python scripts/fetch_article.py "https://www.token00.com/token-plan/china-coding-plan-comparison-2026"

# 通过 slug 拉取
python scripts/fetch_article.py china-coding-plan-comparison-2026

# 指定输出路径
python scripts/fetch_article.py my-article --output posts/my-article.md
```

拉取后生成带完整 frontmatter 的 Markdown 文件，包含 title/section/category/tags/slug/status 等元数据。

**第 2 步：编辑 Markdown 文件**

根据用户的修改指令，直接编辑拉取到的 `.md` 文件：
- 修改正文内容（增删改段落、更新数据）
- 修改 frontmatter（标题、标签、分类等）
- **保持 `slug` 不变**，确保更新到同一篇文章
- 可修改 `status` 字段（draft/published）

**第 3 步：重新发布（自动更新）**

```bash
python scripts/publish.py posts/my-article.md
```

由于 slug 不变，API 会自动识别为**更新**操作（而非新建），返回 `action: "updated"`。

**完整更新流程示例（AI agent 操作）：**
1. `python scripts/fetch_article.py <URL或slug> --output <path>`
2. 读取并理解文章内容
3. 根据用户指令修改 Markdown 内容
4. `python scripts/publish.py <path>` 发布更新（slug 不变自动覆盖）
5. 同 slug 更新自动覆盖备份

> 如果修改了 frontmatter 中的 slug，会创建新文章而非更新。要强制更新到原文章，使用 `--force-slug`：
> ```bash
> python scripts/publish.py <path> --force-slug origin-slug
> ```

### 3. 列出已发布文章

```bash
python scripts/fetch_article.py --list
```

### 4. 全媒体处理规则

包含两阶段自动上传：

**阶段一：正文媒体** — 扫描 Markdown 正文中的媒体引用并自动上传

支持三种引用方式：

| 引用方式 | 示例 | 支持类型 |
|----------|------|----------|
| Markdown 链接 | `![图片](./img/photo.png)` | 图片/视频/音频 |
| HTML 标签 | `<video src="./vids/demo.mp4">` | video/audio/source/img |
| HTML 标签 | `<audio src="./music/intro.mp3">` | video/audio/source/img |

**阶段二：封面图片** — 扫描 `coverImageUrl` 字段，若是本地路径则自动上传

**支持的媒体类型（与服务端 API 对齐）：**

| 类别 | 格式 | 大小限制 |
|------|------|----------|
| 图片 (6) | jpg, jpeg, png, gif, webp, svg | ≤ 10 MB |
| 视频 (4) | mp4, webm, ogv, mov | ≤ 200 MB |
| 音频 (6) | mp3, wav, ogg, m4a, flac | ≤ 50 MB |
| 文档 (9) | pdf, md, txt, log, xlsx, doc, docx, ppt, pptx | ≤ 50 MB |

**处理规则：**
- 本地路径自动上传并替换为完整远程 URL（`coverImageUrl` 也会转为完整 `https://` 链接）
- **⚠️ 封面图路径陷阱**：`coverImageUrl` 相对路径是**以 .md 文件所在目录为基准**解析的（`md_dir` = `.md` 文件所在目录）。例如：
  - 若 `.md` 文件在 `posts/article.md`，封面在 `posts/cover.svg` → 应写 `coverImageUrl: ./cover.svg` **而非** `./posts/cover.svg`
  - 若 `.md` 文件在项目根目录，封面在 `posts/cover.svg` → 应写 `coverImageUrl: ./posts/cover.svg`
- 远程 URL 和 data URI 保持原样
- 同一文件不重复上传（正文和封面引用同一文件也不会重复上传）
- 上传失败保留原始引用并打印警告

### 5. 板块+分类智能匹配

匹配优先级：
1. **Frontmatter** 中明确指定的 `section` / `category`
2. **标题关键词** 匹配 `.token00.conf` 中的 `section_map`
3. **正文关键词** 匹配 `section_map`
4. **API 分类列表** 匹配分类名/描述
5. **默认值** `default_section`

### 6. 作者署名 + 智能免责声明

**作者署名：**
配置 `author` 后，发布时自动在文章末尾追加：

```
---

> 本文由 **HXP** 发布
```

如果文章中已包含相同作者署名则不重复追加。

**智能免责声明（自动触发）：**
当文章内容涉及 **金融/股市/投资** 或 **医疗/健康** 领域时，在作者署名之前自动追加对应的免责声明：

| 领域 | 触发条件 | 免责声明内容 |
|------|---------|-------------|
| **金融/投资** | 标题/正文/标签命中金融关键词 ≥2个 | ⚠️ 风险提示：本文由 AI 基于公开信息收集整理，仅供参考学习，不构成任何投资建议。股市有风险，投资需谨慎。 |
| **医疗/健康** | 标题/正文/标签命中医疗关键词 ≥2个 | ⚠️ 免责声明：本文由 AI 基于公开资料整理，仅供参考，不构成医疗建议。请咨询专业医疗机构。 |

**防重复机制（三重保障）：**
1. **HTML 标记**：正文中包含 `<!--token00-disclaimer-->` 时跳过自动追加（作者完全控制）
2. **正则检测**：内容末尾已存在 `> **免责声明**：` 或 `> **风险提示**：` 格式文本时跳过
3. **自动去重**：两阶段检查确保无论哪种方式都不会追加重复声明

### 7. 上传媒体文件

```bash
# 上传本地文件
python scripts/upload_media.py path/to/image.png --section blog

# 通过 URL 引用上传
python scripts/upload_media.py --url https://example.com/img.png --filename img.png
```

### 8. 本地备份

发布成功后自动在源文件同级的 `published/` 目录留存备份。

**备份内容：**
- `published/2026-06-06_article-slug.md` — 带 frontmatter 的完整 Markdown（图片 URL 已替换为远程地址、含署名）
- `published/manifest.json` — 所有发布记录索引，按时间倒序

**manifest.json 记录字段：**

| 字段 | 说明 |
|------|------|
| `id` | 文章 ID |
| `slug` | URL slug |
| `title` | 标题 |
| `url` | 文章完整 URL |
| `section` | 板块 |
| `category` | 分类 |
| `tags` | 标签 |
| `author` | 作者 |
| `status` | 状态 |
| `action` | created / updated |
| `publishedAt` | 发布时间 |
| `backupFile` | 备份文件名 |
| `sourceFile` | 原始源文件路径 |

同 slug 更新发布时自动覆盖备份和 manifest 记录。

## API 参考

详细文档见 `references/api-reference.md`。

## 注意事项

1. **编码**：Windows 下必须用 Python 发送请求，curl 会导致中文乱码
2. **slug 冲突**：相同 slug 会更新而非创建新文章
3. **限流**：10 次/分钟
4. **标题格式化**：支持 `<strong>`、`<span style="color:#60c0ff">`
5. **可配置颜色**：`#60c0ff`(蓝) `#7c3aed`(紫) `#10b981`(绿) `#f59e0b`(橙) `#ef4444`(红) `#ec4899`(粉)
6. **`upload_media.py` 上传本地文件**：调用的是 `util.upload_local_file()` 函数，不要写成 `upload_local_image()`（该函数名不存在，已修复）
7. **封面图路径**：务必确认 `coverImageUrl` 的路径是否正确。`.md` 文件和封面图同在 `posts/` 目录时用 `./cover.svg`，不是在文件名前加 `posts/`
8. **媒体类型限制**：客户端 SUPPORTED_TYPES 已与服务端 `UPLOAD_LIMITS` 对齐，不在列表中的格式会被 API 拒绝

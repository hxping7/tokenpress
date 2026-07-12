# TokenPress AI 发布 API 文档

> 面向 AI Agent / LLM 的发布接口文档。所有接口返回 JSON，统一错误格式。

---

## Agent Quick Reference

| 操作 | 方法 | URL 路径 | 必需权限 |
|------|------|---------|----------|
| 发布文章 | `POST` | `/api/v1/ai/publish` | `article:write` |
| 上传媒体 | `POST` | `/api/v1/media/ai` | `media:upload` |
| 文章列表 | `GET` | `/api/v1/ai/articles` | 需 Token（无特定权限） |
| 删除文章 | `DELETE` | `/api/v1/ai/articles/:slug` | `content:delete` |
| 板块列表 | `GET` | `/api/v1/sections` | — |
| 分类列表 | `GET` | `/api/v1/categories` | — |
| 板块分类 | `GET` | `/api/v1/sections/:id/categories` | — |
| 标签列表 | `GET` | `/api/v1/tags` | — |
| 系统设置 | `GET` / `PUT` | `/api/v1/site-settings` | 需 Token / PUT 需 `settings:write` |
| 设置/取消置顶 | `POST` | `/api/v1/ai/articles/:slug/pin` | `article:write` |
| 静态页（读取） | `GET` | `/api/v1/statichtml/tree`、`/api/v1/statichtml/list` | `statichtml:read` |
| 静态页（文件夹） | `POST`/`DELETE`/`PATCH` | `/api/v1/statichtml/folder` | `statichtml:write` |
| 静态页（文件） | `POST`/`PUT`/`DELETE`/`PATCH` | `/api/v1/statichtml/file` | `statichtml:write` |
| 静态页直访 | `GET` | `/statichtml/<path>` | 公开（无需 Token） |

**Base URL:** `{API_BASE}/api/v1`
**Auth Header:** `Authorization: Bearer {TOKEN}`（Token 格式：`t00_sk_` 开头）
**限流:** 10次/分钟（AI 发布端点）、100次/分钟（全局）
**内容类型:** 所有 POST/PUT 请求 `Content-Type: application/json; charset=utf-8`

---

## 认证

所有 API 请求需要在 Header 中携带 API Token：

```
Authorization: Bearer t00_sk_xxxxx
```

API Token 在管理后台「Token 管理」中创建。创建时需授予对应权限。

---

## 统一响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功描述"
}
```

### 错误响应（所有接口统一）

```json
{
  "success": false,
  "error": "<机器可读的错误码字符串>",
  "detail": "<人类可读的详细原因>",   // 仅开发环境 (NODE_ENV=development) 返回
  "hint": "<修复建议>"                // 部分接口提供
}
```

**错误码速查表：**

| error 值 | HTTP | 触发条件 | Agent 应对策略 |
|----------|------|---------|---------------|
| `Required fields: xxx` | 400 | 缺少必填参数 | 补全参数后重试 |
| `File type xxx is not allowed` | 400 | MIME 不在白名单 | 检查文件扩展名 → MIME 映射表 |
| `File too large. Max xxMB` | 400 | 文件超限 | 图片≤10MB 视频≤200MB 音频/文档≤50MB |
| `Invalid base64 data` | 400 | Base64 解码失败 | 检查是否包含 `data:image/...;base64,` 前缀（应去掉） |
| `No file provided` | 400 | 缺少 file/url 字段 | 必须提供 file（base64）或 url 二选一 |
| `Missing API token` / `Invalid API token format` | 401 | 未认证或 Token 格式错误 | 检查 Token 是否以 `t00_sk_` 开头 |
| `Missing required permission: xxx` | 403 | 权限不足 | 提示用户在后台为 Token 添加该权限 |
| `Cannot update/delete articles owned by other users` | 403 | 尝试操作他人创建的文章 | `user` 角色只能操作自己的文章；如需操作他人文章，请使用 `admin` / `superadmin` 角色的 Token |
| `Database write failed` | 500 | 数据库异常 | 检查 detail 中的 SQL 错误，稍后重试 |
| `Failed to write file to disk` | 500 | 磁盘写入失败 | 检查服务器 uploads 目录权限和空间 |
| `Upload failed` | 500 | 其他未预期错误 | 检查 detail 字段中的异常堆栈信息 |
| `Folder already exists` | 409 | 文件夹已存在 | 换名或先 `DELETE /statichtml/folder` 再重建 |

---

## 标准工作流

> **这是最常用的操作流程，Agent 应优先参考此章节。**

### 工作流 A：发布带封面图 + 正文插图的文章（最常用）

适用场景：文章包含本地图片文件（封面图、正文配图），需要先上传再引用。

```
Step 1: 上传封面图 → 获得 coverUrl
Step 2: 上传正文插图 → 获得 imgUrl_1, imgUrl_2, ...
Step 3: 发布文章（coverImageUrl 引用 coverUrl，正文中引用 imgUrl_*）
```

**完整调用序列（Python）：**

```python
import base64
import os
import mimetypes
import requests
from concurrent.futures import ThreadPoolExecutor

API_BASE = "https://your-domain.com/api/v1"
TOKEN = "t00_sk_xxxxx"


def upload_media(file_path: str, section: str = "") -> str:
    """
    上传任意格式的媒体文件到 TokenPress 媒体库
    支持图片、视频、音频、文档 — 自动识别 MIME 类型

    Args:
        file_path: 本地文件路径 (如 "./images/cover.jpg")
        section: 存储子目录 ('blog' | 'logo' | '' 等)

    Returns:
        (url, fullUrl) 元组:
          - url: 相对媒体 URL (如 "/api/v1/media/files/uploads/blog/cover-xxx.jpg")
          - fullUrl: 完整可访问 URL (如 "https://your-domain.com/api/v1/media/files/uploads/blog/cover-xxx.jpg")

    Raises:
        Exception: 上传失败时包含 error + detail 信息
    """
    # 扩展名 → MIME 映射表
    MIME_MAP = {
        # 图片
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        # 视频
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".ogv": "video/ogg", ".mov": "video/quicktime",
        # 音频
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".m4a": "audio/x-m4a",
        # 文档
        ".pdf": "application/pdf",
        ".md": "text/markdown",
        ".txt": "text/plain", ".log": "text/plain",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }

    ext = os.path.splitext(file_path)[1].lower()
    mime_type = MIME_MAP.get(ext) or mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    # 读取并编码（文本文件直接读字符串，其他用 base64）
    with open(file_path, "rb") as f:
        raw = f.read()

    is_text = ext in {".md", ".txt", ".log", ".svg"}
    file_data = raw.decode("utf-8") if is_text else base64.b64encode(raw).decode("ascii")

    print(f"[上传] {os.path.basename(file_path)} ({len(raw) / 1024:.1f}KB, {mime_type})")

    resp = requests.post(
        f"{API_BASE}/media/ai",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        json={
            "file": file_data,
            "filename": os.path.basename(file_path),
            "mimeType": mime_type,
            "section": section,
        },
        timeout=60,
    )
    result = resp.json()
    if not result["success"]:
        raise Exception(f"上传失败 [{result['error']}]: {result.get('detail', '')}")

    url = result["data"]["url"]
    full_url = result["data"].get("fullUrl", url)
    print(f"[完成] → {url}")
    return url, full_url


# ===== Step 1: 上传封面图 =====
cover_url, cover_full = upload_media("./images/cover.jpg", "")
print(f"封面图: {cover_url} (可访问: {cover_full})")

# ===== Step 2: 上传正文插图（并行上传，更快）=====
def _upload_one(p: str) -> str:
    url, _ = upload_media(p, "blog")
    return url

with ThreadPoolExecutor() as pool:
    img_url1, img_url2 = list(pool.map(
        _upload_one,
        ["./images/diagram.png", "./images/screenshot.jpg"],
    ))
print(f"插图: {img_url1}, {img_url2}")

# ===== Step 3: 发布文章（引用已上传的 URL）=====
publish_resp = requests.post(
    f"{API_BASE}/ai/publish",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={
        "title": '<strong style="color:#60c0ff">我的文章标题</strong>',
        "content": (
            "# 文章标题\n\n"
            f"![架构图]({img_url1})\n\n"
            "正文内容...\n\n"
            f"![截图]({img_url2})\n\n"
            "更多内容..."
        ),
        "section": "blog",
        "category": "ai-tools",
        "tags": ["AI", "教程"],
        "coverImageUrl": cover_url,       # ← 使用 Step 1 获得的完整 URL
        "status": "published",
        "slug": "my-article-with-images",
    },
)
result = publish_resp.json()
article_url = result['data']['url']
print(f"发布成功: {article_url}")
# → https://your-domain.com/blog/my-article-with-images

# ===== Agent 验证：确认文章可访问 =====
verify = requests.head(article_url, timeout=10, allow_redirects=True)
print(f"文章可访问: {'YES' if verify.status_code == 200 else f'NO ({verify.status_code})'}")
```

> **依赖：** `pip install requests`（标准库 `base64`, `os`, `mimetypes` 无需安装）

**Node.js 版本（备选）：**

```javascript
const fs = require('fs');
const path = require('path');
const API_BASE = 'https://your-domain.com/api/v1';
const TOKEN = 't00_sk_xxxxx';

async function uploadImage(localPath, section = 'blog') {
  const buf = fs.readFileSync(localPath);
  const res = await fetch(`${API_BASE}/media/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      file: buf.toString('base64'),
      filename: path.basename(localPath),
      mimeType: getMimeType(localPath),
      section: section
    })
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Upload failed: ${json.error} - ${json.detail}`);
  return json.data.url;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml' };
  return map[ext] || 'application/octet-stream';
}

// 使用方式与 Python 版完全相同：先上传图片获取 URL，再发布文章引用 URL
const coverUrl = await uploadImage('./images/cover.jpg', '');
const [imgUrl1, imgUrl2] = await Promise.all([
  uploadImage('./images/diagram.png', 'blog'),
  uploadImage('./images/screenshot.jpg', 'blog')
]);
// ... 然后 POST /ai/publish 引用这些 URL
```

---

### 工作流 B：使用外部 URL 作为图片（无需上传）

如果图片已经在互联网上（如 CDN、图床、其他网站），可以直接使用 URL，无需上传到媒体库。

**Python 示例：**

```python
# 外部 URL 直接使用，不需要调用 /media/ai
requests.post(
    f"{API_BASE}/ai/publish",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={
        "title": "使用外部图片的文章",
        "content": (
            "# 文章标题\n\n"
            "![外部图片](https://cdn.example.com/photo.png)\n\n"
            "![GitHub 图片](https://raw.githubusercontent.com/user/repo/main/image.svg)\n\n"
            "正文内容..."
        ),
        "section": "blog",
        "coverImageUrl": "https://cdn.example.com/cover.jpg",  # 直接用外部 URL
        "status": "published",
    },
)
```

**Node.js 版本（备选）：**

```javascript
await fetch(`${API_BASE}/ai/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
  body: JSON.stringify({
    title: '使用外部图片的文章',
    content: `
# 文章标题

![外部图片](https://cdn.example.com/photo.png)

![GitHub 图片](https://raw.githubusercontent.com/user/repo/main/image.svg)

正文内容...
    `.trim(),
    section: 'blog',
    coverImageUrl: 'https://cdn.example.com/cover.jpg',
    status: 'published'
  })
});
```

**注意事项：**

| 场景 | 处理方式 | 原因 |
|------|---------|------|
| 本地文件（`.jpg`, `.png` 等） | **必须先上传** (`POST /media/ai`) | 服务端无法访问你的本地文件系统 |
| 公网可访问的 URL | **直接引用**，无需上传 | Markdown 渲染时直接加载 |
| Base64 内联 (`data:image/png;base64,...`) | **建议改为上传后引用** | 内联 base64 会使文章体积膨胀，影响加载速度 |
| 图床/CND URL（如 imgur、smms） | **直接引用** | 已在公网，无需二次存储 |

---

### 工作流 C：更新已有文章

```
Step 1: 查询文章列表 → 找到目标 slug
Step 2: （可选）如有新图片需要上传 → POST /media/ai
Step 3: 用相同 slug 重新发布 → 自动覆盖（action: "updated"）
```

```javascript
// Step 1: 查找已有文章
const listRes = await fetch(`${API_BASE}/ai/articles?section=blog&limit=50`, {
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});
const articles = (await listRes.json()).data;
const target = articles.find(a => a.title.includes('关键词'));
if (!target) { console.log('未找到目标文章'); return; }

console.log('找到:', target.slug); // → "my-article-slug"

// Step 2: 如果需要更换图片，上传新图获取新 URL
// const newCoverUrl = await uploadImage('./new-cover.jpg');

// Step 3: 用相同 slug 发布 → 更新（而非新建）
await fetch(`${API_BASE}/ai/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
  body: JSON.stringify({
    title: target.title,           // 可修改标题
    content: updatedContent,       // 修改后的正文
    section: 'blog',
    slug: target.slug,             // ⚠️ 相同 slug = 更新操作
    status: 'published'
  })
});
// 响应: { success: true, data: { action: "updated", ... } }
```

**Python 示例：**

```python
# Step 1: 查找已有文章
list_resp = requests.get(
    f"{API_BASE}/ai/articles",
    params={"section": "blog", "limit": 50},
    headers={"Authorization": f"Bearer {TOKEN}"},
)
articles = list_resp.json()["data"]

target = next((a for a in articles if "关键词" in a["title"]), None)
if not target:
    print("未找到目标文章")
    exit()

print(f"找到: {target['slug']}")  # → "my-article-slug"

# Step 2: 如果需要更换图片，上传新图获取新 URL
# new_cover_url = upload_media("./new-cover.jpg", "")

# Step 3: 用相同 slug 发布 → 更新（而非新建）
update_resp = requests.post(
    f"{API_BASE}/ai/publish",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={
        "title": target["title"],           # 可修改标题
        "content": updated_content,          # 修改后的正文
        "section": "blog",
        "slug": target["slug"],              # ⚠️ 相同 slug = 更新操作
        "status": "published",
    },
)
result = update_resp.json()
print(f"更新结果: action={result['data']['action']}")
# → action="updated"
```

> **关键规则：** `slug` 相同 = 覆盖更新；`slug` 不同或省略 = 创建新文章。

---

### 工作流 D：纯文字文章（无图片）

最简流程，单次请求即可完成：

```bash
curl -X POST https://your-domain.com/api/v1/ai/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -d '{
    "title": "纯文字文章标题",
    "content": "# 标题\n\n这里是文章正文内容...",
    "section": "blog",
    "tags": ["标签"],
    "status": "published"
  }'
```

---

## 接口详情

### 1. 发布文章

**POST** `/api/v1/ai/publish`

创建新文章或更新已有文章（根据 slug 判断：相同 slug = 更新，不同/缺失 = 新建）。

> **所有权规则：** `superadmin` / `admin` 角色的 Token 可以更新任意文章；`user` 角色只能更新自己创建的文章（通过 `authorId` 匹配）。尝试操作他人文章将返回 403。

**请求体：**

```json
{
  "title": "文章标题",
  "content": "# Markdown 内容\n\n支持完整的 Markdown 语法...",
  "section": "blog",
  "category": "分类slug或名称",
  "tags": ["标签1", "标签2"],
  "coverImageUrl": "https://example.com/cover.jpg",
  "status": "published",
    "slug": "custom-slug",
    "publishedAt": "2024-01-15T10:00:00Z",
    "pinnedScope": "global"
  }
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 | Agent 注意事项 |
|------|------|------|------|---------------|
| title | string | ✅ | 文章标题，支持 HTML 格式化 | 见下方「标题格式化」说明 |
| content | string | ✅ | Markdown 格式的文章正文 | 图片引用使用已上传的 URL 或公网 URL |
| section | string | ✅ | 板块 slug | **必须先用 GET /sections 获取有效值** |
| category | string | ❌ | 分类 slug 或名称 | 可用 GET /categories?section=xxx 查看 |
| tags | string[] | ❌ | 标签数组（最多建议 5 个） | 不存在的标签会自动创建 |
| coverImageUrl | string | ❌ | 封面图片 URL | **必须是完整 URL**（上传所得或公网地址），不支持本地路径 |
| status | string | ❌ | `draft`、`published` 或 `archived`，默认 `draft` | ⚠️ 当提交 `published` 时，若内容审核已开启，文章将先进入 `pending_review` 状态，审核通过后才变为 `published`；建议重要文章先 draft 再改 published |
| slug | string | ❌ | 自定义 URL slug | **相同 slug 会覆盖旧文章**；不提供则自动生成 |
| publishedAt | string | ❌ | ISO 8601 时间 | 不提供则使用当前时间 |
| pinnedScope | string | ❌ | `none` / `global` / `section` | **置顶范围**：`global`=全站置顶（首页/全量列表顶部），`section`=仅所属板块列表内置顶，`none`=取消置顶；**不提供则保持文章原有置顶状态不变** |

**coverImageUrl 的三种来源方式：**

| 来源 | 示例值 | 是否需要先上传 |
|------|--------|--------------|
| 上传到媒体库 | `/api/v1/media/files/uploads/blog/cover.jpg` | 是（Step 1 调用 POST /media/ai） |
| 公网 URL | `https://cdn.example.com/cover.jpg` | 否，直接使用 |
| 站内其他媒体 | `/api/v1/media/files/uploads/logo/logo.png` | 取决于是否已上传过 |

**content 中插入图片的方式：**

```markdown
<!-- 方式一：Markdown 图片语法（推荐） -->
![图片描述](/api/v1/media/files/uploads/blog/diagram.png)

<!-- 方式二：HTML img 标签 -->
<img src="/api/v1/media/files/uploads/blog/diagram.png" alt="图片描述" />

<!-- 方式三：HTML video 标签（视频文件） -->
<video src="/api/v1/media/files/uploads/blog/demo.mp4" controls></video>

<!-- 方式四：外部 CDN 图片（无需上传） -->
![外部图片](https://cdn.example.com/image.png)
```

**成功响应：**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://your-domain.com/blog/article-slug",
    "status": "pending_review",
    "action": "created"
  },
  "message": "Article published successfully"
}
```

> **关于 `status` 字段：**
> - 提交 `draft` → 返回 `draft`
> - 提交 `published` → 若内容审核开启则返回 **`pending_review`**（审核通过后自动变为 `published`），若审核关闭则直接返回 `published`
> - 提交 `archived` → 返回 `archived`
> - Agent 可通过 GET `/api/v1/ai/articles` 查询文章当前真实状态

> **Agent 验证要点：**
> - `data.url` — **文章完整前端URL**，Agent 可直接 GET 此 URL 验证文章是否可访问
> - `data.action` — `created`（新建）或 `updated`（更新），用于判断是否需要通知用户
> - 发布后建议立即 HEAD/GET `data.url` 确认页面可访问，再报告给用户

**错误响应示例：**

```json
{
  "success": false,
  "error": "Required fields: title, content, section",
  "hint": "section must be a valid section slug (e.g., blog, ai_coding, token_plan)"
}
```

---

### 2. 上传媒体文件

**POST** `/api/v1/media/ai`

上传图片、视频、音频或文档文件到媒体库。**需要 `media:upload` 权限。**

> 这是发布带图片文章的前置步骤。上传成功后获得 URL，用于 `coverImageUrl` 参数和 `content` 正文中的图片引用。

#### 方式一：Base64 上传（本地文件 → 媒体库）

将本地文件读取为 Base64 字符串发送给服务端。

**请求体：**

```json
{
  "file": "<纯 base64 字符串，不含 data:image 前缀>",
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "section": "blog"
}
```

**Agent 关键注意：**
- `file` 字段是 **纯 base64 编码的字符串**，不要包含 `data:image/jpeg;base64,` 这样的前缀
- 文件大小限制见下方表格，超过会返回 400 错误
- `filename` 用于生成存储文件名（服务端会加随机后缀防冲突）
- `section` 是存储子目录，建议与文章所在板块一致

#### 方式二：URL 引用上传（外部 URL → 媒体库）

将公网上的文件 URL 提交给服务端，服务端下载并保存到媒体库。

**请求体：**

```json
{
  "url": "https://example.com/image.png",
  "filename": "saved-name.png",
  "mimeType": "image/png"
}
```

**适用场景：** 想把外部图片永久保存到自己媒体库（防止原图失效）。

#### 参数汇总

| 参数 | 类型 | 必填 | 说明 | Agent 注意事项 |
|------|------|------|------|---------------|
| file | string | ❌* | Base64 编码的文件内容（**纯 base64，无前缀**） | 与 url 二选一 |
| url | string | ❌* | 外部文件 URL（服务端下载保存） | 与 file 二选一 |
| filename | string | ✅ | 原始文件名 | 用于确定扩展名和显示名 |
| mimeType | string | ✅ | MIME 类型 | **必须与实际文件类型匹配**，见白名单 |
| section | string | ❌ | 存储子目录 | 建议：封面用空或 `logo`，正文图用板块名 |
| articleId | number | ❌ | 关联文章 ID | 可选，发布文章后也会自动回填 |

> **存储结构：** 文件按月维度存放，如 `uploads/202606/blog/photo.jpg`。Agent 无需关心目录结构，只需使用返回的 `url` 或 `fullUrl`。
>
> **自动关联：** 发布文章后，系统会自动从 `content` 和 `coverImageUrl` 中提取媒体 URL 并回填 `articleId`，无需 Agent 手动处理。

#### 支持的文件类型与大小限制

| 类别 | 允许的 MIME 类型 | 对应扩展名 | 大小限制 |
|------|-------------------|-----------|----------|
| **图片** | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml` | .jpg .png .gif .webp .svg | **10 MB** |
| **视频** | `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime` | .mp4 .webm .ogv .mov | **200 MB** |
| **音频** | `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/ogg`, `audio/flac`, `audio/x-m4a` | .mp3 .wav .ogg .flac .m4a | **50 MB** |
| **文档** | `text/markdown`, `application/pdf`, `text/plain`, 以及 Office 格式 | .md .pdf .txt .xlsx .docx .pptx | **50 MB** |

> 审计日志和内容审查调度均为异步非阻塞操作，不影响上传响应速度或成功率。

#### 成功响应（HTTP 201）

```json
{
  "success": true,
  "data": {
    "id": 42,
    "filename": "photo-mq6ite5dl0mj.jpg",
    "originalName": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 12345,
    "url": "/api/v1/media/files/uploads/blog/photo-mq6ite5dl0mj.jpg",
    "fullUrl": "https://your-domain.com/api/v1/media/files/uploads/blog/photo-mq6ite5dl0mj.jpg",
    "thumbnailUrl": null,
    "uploadedBy": 1,
    "createdAt": "2026-06-09 10:52:32"
  }
}
```

> **关键字段说明：**
> - `data.url` — **相对路径**，用于填入 `coverImageUrl` 或写入 `content` 的 `![](url)` 中
> - `data.fullUrl` — **完整URL（含域名）**，Agent 可直接用此 URL 验证文件是否可访问

#### Agent 验证上传结果

```python
# ===== 上传后立即验证可访问性 =====
def upload_and_verify(file_path: str, section: str = "") -> tuple[str, str]:
    """上传媒体并验证可访问性，返回 (引用url, 完整url)"""
    url = upload_media(file_path, section)

    # 从响应中获取 fullUrl（需要修改 upload_media 返回完整响应）
    # 或自行拼接: full_url = f"{API_BASE.replace('/api/v1', '')}{url}"
    import urllib.parse
    parsed = urllib.parse.urlparse(API_BASE)
    base = f"{parsed.scheme}://{parsed.netloc}"
    full_url = f"{base}{url}"

    # 验证可访问性
    check = requests.head(full_url, timeout=10)
    if check.status_code == 200:
        print(f"[OK] {file_path} → {full_url} ({check.headers.get('content-type', '?')})")
    else:
        print(f"[WARN] {full_url} 返回 {check.status_code}")

    return url, full_url

# 使用示例
cover_ref, cover_full = upload_and_verify("./images/cover.jpg", "")
img_ref, img_full   = upload_and_verify("./images/diagram.png", "blog")
```

#### Python 完整上传函数（可直接复制使用）

```python
import base64
import os
import mimetypes
import requests

API_BASE = "https://your-domain.com/api/v1"
TOKEN = "t00_sk_xxxxx"


def upload_media(file_path: str, section: str = "") -> tuple[str, str]:
    """
    上传本地文件到 TokenPress 媒体库
    支持图片、视频、音频、文档 — 自动识别 MIME 类型

    Args:
        file_path: 本地文件路径
        section: 存储子目录 ('blog' | 'logo' | '' 等)

    Returns:
        (url, full_url) 元组:
        - url: 相对路径，用于填入 coverImageUrl 或 content 的 ![](url)
        - full_url: 完整URL（含域名），用于验证可访问性

    Raises:
        Exception: 上传失败时包含 error + detail
    """
    MIME_MAP = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif",
        ".webp": "image/webp", ".svg": "image/svg+xml",
        ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg", ".mov": "video/quicktime",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
        ".flac": "audio/flac", ".m4a": "audio/x-m4a",
        ".pdf": "application/pdf", ".md": "text/markdown",
        ".txt": "text/plain", ".log": "text/plain",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }

    ext = os.path.splitext(file_path)[1].lower()
    mime_type = MIME_MAP.get(ext) or mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    with open(file_path, "rb") as f:
        raw = f.read()

    is_text = ext in {".md", ".txt", ".log", ".svg"}
    file_data = raw.decode("utf-8") if is_text else base64.b64encode(raw).decode("ascii")

    resp = requests.post(
        f"{API_BASE}/media/ai",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        json={"file": file_data, "filename": os.path.basename(file_path), "mimeType": mime_type, "section": section},
        timeout=60,
    )
    result = resp.json()
    if not result["success"]:
        raise Exception(f"上传失败 [{result['error']}]: {result.get('detail', '')}")
    return result["data"]["url"], result["data"].get("fullUrl", "")


# ===== 使用示例 =====
try:
    url, full_url = upload_media("./images/cover.jpg", section="blog")
    print(f"引用URL: {url}")       # → /api/v1/media/files/uploads/blog/cover-xxx.jpg
    print(f"完整URL: {full_url}")   # → https://your-domain.com/api/v1/media/files/uploads/blog/cover-xxx.jpg

    # Agent 可立即验证可访问性
    if full_url:
        check = requests.head(full_url, timeout=10)
        print(f"可访问: {'YES' if check.status_code == 200 else f'NO ({check.status_code})'}")
except Exception as e:
    print(f"失败: {e}")
```

> **依赖：** `pip install requests`（`base64`, `os`, `mimetypes` 为标准库无需安装）

**Node.js 版本（备选）：**

```javascript
const fs = require('fs');
const path = require('path');

async function uploadMedia(localPath, { apiBase, token, section = '' } = {}) {
  const extMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf', '.md': 'text/markdown'
  };
  const ext = path.extname(localPath).toLowerCase();
  const mimeType = extMap[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(localPath);
  const base64 = buffer.toString('base64');
  const res = await fetch(`${apiBase}/media/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ file: base64, filename: path.basename(localPath), mimeType, section })
  });
  const result = await res.json();
  if (!result.success) throw new Error(`Upload [${result.error}]: ${result.detail || 'no detail'}`);
  return result.data.url;
}
```

#### 各图片格式上传详解

所有图片格式使用**同一个 API 端点** `POST /media/ai`，**同一种 Base64 上传方式**。唯一区别是 `mimeType` 参数值。

##### 格式总览

| 格式 | 扩展名 | mimeType 值 | 文件本质 | 编码方式 | 大小限制 |
|------|--------|------------|---------|----------|---------|
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | 二进制图片 | `base64.b64encode()` | 10 MB |
| PNG | `.png` | `image/png` | 二进制图片 | `base64.b64encode()` | 10 MB |
| GIF | `.gif` | `image/gif` | 二进制图片 | `base64.b64encode()` | 10 MB |
| WebP | `.webp` | `image/webp` | 二进制图片 | `base64.b64encode()` | 10 MB |
| **SVG** | `.svg` | `image/svg+xml` | **XML 文本** | 直接读字符串或 base64 | 10 MB |

> **结论：5 种图片格式上传方法完全一致**，代码无需区分格式。上面的 `upload_media()` 函数自动根据扩展名选择正确的 mimeType。

##### 各格式具体示例（Python）

**示例 1：上传 JPEG 封面图**

```python
# 本地文件: ./images/cover.jpg
cover_url, cover_full = upload_media("./images/cover.jpg", section="")
# cover_url  → "/api/v1/media/files/uploads/cover-xxx.jpg"     (用于 coverImageUrl)
# cover_full → "https://your-domain.com/api/v1/media/files/uploads/cover-xxx.jpg" (用于验证)
```

**示例 2：上传 PNG 正文插图**

```python
img_url, img_full = upload_media("./images/diagram.png", section="blog")
# img_url  → "/api/v1/media/files/uploads/blog/diagram-xxx.png"   (用于 content 引用)
# img_full → "https://.../diagram-xxx.png"                        (用于验证可访问性)
```

**示例 3：上传 GIF 动图**

```python
gif_url, _ = upload_media("./images/demo.gif", section="blog")
# 用法: content 中写 f"![动画演示]({gif_url})"
```

**示例 4：上传 WebP 图片（现代格式，体积更小）**

```python
webp_url, _ = upload_media("./images/photo.webp", section="blog")
# WebP 在现代浏览器中原生支持，Markdown 中正常显示
```

**示例 5：上传 SVG（矢量图，特殊处理）**

SVG 是 **XML 文本文件**，`upload_media()` 会自动检测并以文本方式发送：

```python
logo_url, logo_full = upload_media("./images/logo.svg", section="logo")
# 函数内部自动用 raw.decode("utf-8") 而非 base64

# 手动方式也行（如果需要自定义）：
with open("./images/logo.svg", "r", encoding="utf-8") as f:
    svg_content = f.read()   # <svg xmlns="..."><circle .../></svg>

resp = requests.post(f"{API_BASE}/media/ai",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={
        "file": svg_content,            # SVG 文本内容（非 base64）
        "filename": "logo.svg",
        "mimeType": "image/svg+xml",
        "section": "logo",
    },
)
```

> **SVG 注意事项：**
> - SVG 是文本格式，直接读字符串即可（`upload_media()` 自动处理）
> - SVG 通常用于 Logo、图标、简单图形，建议 `section` 设为 `'logo'` 或空
> - SVG 支持在 `<img>` 标签中缩放不失真

##### 一键调用（所有格式同一函数）

上面的 `upload_media()` 已覆盖全部格式，**一行代码即可上传任何文件**：

```python
# 图片 — 一行调用
cover_url, _    = upload_media("./cover.jpg")                    # JPEG 封面
diagram_url, _  = upload_media("./images/diagram.png", "blog")   # PNG 插图
gif_url, _      = upload_media("./images/demo.gif", "blog")      # GIF 动图
webp_url, _     = upload_media("./images/photo.webp", "blog")    # WebP 图片
logo_url, logo_full = upload_media("./images/logo.svg", "logo")  # SVG Logo

# 视频 / 音频
video_url, _    = upload_media("./videos/tutorial.mp4", "blog")  # MP4 视频
audio_url, _    = upload_media("./audio/podcast.mp3", "blog")    # MP3 音频

# 文档附件
pdf_url, _      = upload_media("./docs/report.pdf", "blog")       # PDF 报告
xlsx_url, _     = upload_media("./data/sales.xlsx", "blog")       # Excel 表格
doc_url, _      = upload_media("./docs/proposal.docx", "blog")    # Word 文档
log_url, _      = upload_media("./logs/error.log", "blog")        # 日志文本

# 并行上传多张图片（推荐，更快）
from concurrent.futures import ThreadPoolExecutor

def _up(p: str) -> str:
    u, _ = upload_media(p, "blog")
    return u

with ThreadPoolExecutor(max_workers=4) as pool:
    urls = list(pool.map(_up, [
        "./fig1.png", "./fig2.jpg", "./fig3.webp", "./fig4.gif"
    ]))
# urls[0], urls[1], urls[2], urls[3] → 各自的引用URL（相对路径）
```

##### 上传后如何引用

上传成功后返回两个字段：

| 字段 | 值示例 | 用途 |
|------|--------|------|
| `data.url` | `/api/v1/media/files/uploads/xxx.jpg` | **填入** `coverImageUrl` 或 content 的 `![](url)` |
| `data.fullUrl` | `https://your-domain.com/api/v1/media/files/uploads/xxx.jpg` | **验证可访问性**（HEAD/GET 请求） |

**位置一：封面图 (`coverImageUrl`)**

```json
{
  "title": "文章标题",
  "coverImageUrl": "/api/v1/media/files/uploads/cover-xxx.jpg",   // ← 上传返回的 data.url
  ...
}
```

**位置二：正文插图 (`content` Markdown 中)**

```markdown
# 文章标题

<!-- 方式一：Markdown 语法（最常用） -->
![架构图](/api/v1/media/files/uploads/blog/diagram-xxx.png)

<!-- 方式二：HTML img 标签（可控制尺寸） -->
<img src="/api/v1/media/files/uploads/blog/photo-xxx.jpg" alt="照片" width="600" />

<!-- 方式三：SVG 作为 Logo 引用 -->
<img src="/api/v1/media/files/uploads/logo/logo-xxx.svg" alt="Logo" width="120" />

正文内容继续...
```

**发布时组合使用：**

```javascript
// Step 1: 上传所有图片
const coverUrl = await uploadImage('./cover.jpg', { apiBase, token });
const imgUrls = await Promise.all([
  uploadImage('./fig1.png', { apiBase, token, section: 'blog' }),
  uploadImage('./fig2.jpg', { apiBase, token, section: 'blog' }),
  uploadImage('./logo.svg', { apiBase, token, section: 'logo' }),
]);

// Step 2: 发布文章（引用上传后的 URL）
await fetch(`${apiBase}/ai/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    title: '完整图文教程',
    content: `
# 教程标题

![Figure 1: 架构图](${imgUrls[0]})

### 静态页面 statichtml（需 `statichtml:read` / `statichtml:write`）

文件存于后端 `data/statichtml/`，由 `express.static('/statichtml')` 经 nginx 反代直访：`{site_url}/statichtml/<relpath>`（如 `/statichtml/item1/test1.html`）。可作板块 `externalUrl` / Hero slide `linkUrl` / Hero CTA `href` 的跳转目标——发布文章时如需配套独立落地页（活动页、说明页、协议页），先调本接口上传，再把 URL 填入导航/CTA 即可。

**读取（`statichtml:read`）**

- `GET /api/v1/statichtml/tree` — 树形（folders+files，含 `relPath`/`url`/`size`/`ext`/`mtime`），适合后台文件树。
- `GET /api/v1/statichtml/list` — 扁平文件列表（选择器用，字段 `relPath`/`url`/`name`/`ext`）。

**写入（`statichtml:write`）**

- `POST /api/v1/statichtml/folder` — `{ "path": "item1" }` 建文件夹（支持多级 `item1/sub`；已存在返回 409）。
- `DELETE /api/v1/statichtml/folder` — `{ "path": "item1" }` 递归删文件夹。
- `PATCH /api/v1/statichtml/folder` — `{ "path": "item1", "newName": "item2" }` 重命名文件夹。
- `POST /api/v1/statichtml/file` — `{ folder?, filename, content? | file?(base64), mimeType? }` 上传/新建文件。
  - 文本类（html/css/js/json/svg/txt/md/xml…）传 `content` 字符串；二进制（图片/字体/pdf）传 `file` base64。
  - 扩展名白名单校验（非白名单 400），10MB 上限（超限 400）；`folder` 缺省存根目录。返回 `{ relPath, url, size }`。
- `PUT /api/v1/statichtml/file` — `{ relPath, content? | file?, mimeType? }` 替换已有文件内容。
- `DELETE /api/v1/statichtml/file` — `{ "relPath": "item1/test1.html" }` 删除文件。
- `PATCH /api/v1/statichtml/file` — `{ "relPath": "item1/test1.html", "newName": "new.html" }` 重命名文件（扩展名变更命中非白名单仍返回 400）。

**静态直访（公开，无需 Token）**

`GET /statichtml/<relpath>` 由 nginx / Express 静态服务直接返回文件，可用于 `<a href>`、`<img src>`、iframe 等。

**安全：** 路径解析严格限制在 `data/statichtml` 内（防 `../` 穿越）；`filename` 只保留原名与扩展名（不追加随机后缀，保证 URL 可预测）。

**上传示例：**

```json
// 文本（HTML）
POST /api/v1/statichtml/file
{ "folder": "item1", "filename": "test1.html", "content": "<h1>Hello Static</h1>", "mimeType": "text/html" }

// 二进制（图片，base64）
POST /api/v1/statichtml/file
{ "folder": "item1", "filename": "cover.png", "file": "<纯base64，不含data:前缀>", "mimeType": "image/png" }
```

---

## 第一章

文字说明...

![Figure 2: 截图](${imgUrls[1]})

## 总结

本文由以下团队发布：<img src="${imgUrls[2]}" alt="Logo" height="24" />
    `.trim(),
    section: 'blog',
    coverImageUrl: coverUrl,       // 封面图
    status: 'published',
    slug: 'complete-image-guide'
  })
});
```

#### 音频 / 视频 / 文档上传与引用

除了图片，API 还支持上传**视频、音频、文档附件**，方法与图片完全相同（同一个 `POST /media/ai` 端点），只是 `mimeType` 和大小限制不同。

##### 全格式支持总表

| 类别 | 格式 | 扩展名 | mimeType 值 | 大小限制 | 浏览器行为 |
|------|------|--------|------------|---------|-----------|
| **图片** | JPEG | `.jpg`, `.jpeg` | `image/jpeg` | 10 MB | 直接显示 |
| | PNG | `.png` | `image/png` | 10 MB | 直接显示 |
| | GIF | `.gif` | `image/gif` | 10 MB | 动画显示 |
| | WebP | `.webp` | `image/webp` | 10 MB | 直接显示 |
| | SVG | `.svg` | `image/svg+xml` | 10 MB | 矢量显示 |
| **视频** | MP4 | `.mp4` | `video/mp4` | **200 MB** | 内嵌播放器 |
| | WebM | `.webm` | `video/webm` | 200 MB | 内嵌播放器 |
| | OGG Video | `.ogv` / `.ogg` | `video/ogg` | 200 MB | 内嵌播放器 |
| | QuickTime | `.mov` | `video/quicktime` | 200 MB | 内嵌播放器 |
| **音频** | MP3 | `.mp3` | `audio/mpeg` (或 `audio/mp3`) | **50 MB** | 音频播放器 |
| | WAV | `.wav` | `audio/wav` | 50 MB | 音频播放器 |
| | OGG Audio | `.ogg` | `audio/ogg` | 50 MB | 音频播放器 |
| | FLAC | `.flac` | `audio/flac` | 50 MB | 音频播放器 |
| | M4A | `.m4a` | `audio/x-m4a` | 50 MB | 音频播放器 |
| **文档** | PDF | `.pdf` | `application/pdf` | **50 MB** | 浏览器内预览/下载 |
| | Markdown | `.md` | `text/markdown` | 50 MB | 作为文本下载 |
| | 纯文本 | `.txt`, `.log` | `text/plain` | 50 MB | 作为文本下载 |
| | Excel 新版 | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 50 MB | 下载打开 |
| | Word 旧版 | `.doc` | `application/msword` | 50 MB | 下载打开 |
| | Word 新版 | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 50 MB | 下载打开 |
| | PPT 旧版 | `.ppt` | `application/vnd.ms-powerpoint` | 50 MB | 下载打开 |
| | PPT 新版 | `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | 50 MB | 下载打开 |

> **关键点：所有格式使用同一个 API、同一种 Base64 上传方式、同一个引用 URL。**

##### 视频上传与引用

```python
# 上传 MP4 视频文件（一行代码，与图片完全相同）
video_url = upload_media("./videos/demo.mp4", section="blog")
# 返回: "/api/v1/media/files/uploads/blog/demo-xxx.mp4"
```

**在文章中引用视频（HTML `<video>` 标签）：**

```markdown
# 教程文章

## 视频演示

<video src="/api/v1/media/files/uploads/blog/demo-xxx.mp4" controls width="640" height="360" preload="metadata">
  您的浏览器不支持视频播放。
</video>

> 点击上方播放按钮观看操作演示。
```

**支持的 HTML video 属性：**

| 属性 | 说明 | 推荐值 |
|------|------|--------|
| `controls` | 显示播放控制条 | 必须加 |
| `width` / `height` | 播放器尺寸 | 如 `640x360` 或 `800x450` |
| `preload` | 预加载策略 | `metadata`（只加载元信息，省流量）或 `auto` |
| `poster` | 封面图 URL | 可用已上传的图片 URL |
| `loop` | 循环播放 | 短 GIF 替代品可用 |
| `autoplay` | 自动播放 | 注意：大多数浏览器会阻止带声音的自动播放 |

**带封面图的视频示例：**

```html
<video src="/api/v1/media/files/uploads/blog/tutorial.mp4"
       controls width="800" height="450"
       poster="/api/v1/media/files/uploads/blog/video-cover.jpg"
       preload="metadata">
</video>
```

---

##### 音频上传与引用

```python
# 上传 MP3 音频文件（一行代码）
audio_url = upload_media("./audio/podcast.mp3", section="blog")
# 返回: "/api/v1/media/files/uploads/blog/podcast-ep01-xxx.mp3"
```

**在文章中引用音频（HTML `<audio>` 标签）：**

```markdown
## 播客收听

<audio src="/api/v1/media/files/uploads/blog/podcast-ep01-xxx.mp3" controls preload="metadata">
  您的浏览器不支持音频播放。
</audio>

**本期节目时长:** 25 分钟 | **文件大小:** 12MB
```

**音频格式选择建议：**

| 场景 | 推荐格式 | 理由 |
|------|---------|------|
| 播客 / 背景音乐 | `.mp3` (`audio/mpeg`) | 兼容性最好，体积适中 |
| 无损音质 | `.flac` (`audio/flac`) | 高保真，但文件大 |
| 网页音效 | `.wav` (`audio/wav`) | 无压缩，短音效适用 |
| 开源偏好 | `.ogg` (`audio/ogg`) | 免专利，Firefox 偏好 |
| Apple 设备优化 | `.m4a` (`audio/x-m4a`) | AAC 编码，iOS 兼容好 |

---

##### 文档附件上传与引用

文档类文件（PDF、Word、Excel、TXT 等）上传后，浏览器通常会提供**内嵌预览**或**下载**功能。

```python
# ===== 所有文档格式，一行代码即可 =====
pdf_url,  pdf_full  = upload_media("./docs/report.pdf",       "blog")   # PDF 报告
xlsx_url, xlsx_full = upload_media("./data/sales.xlsx",        "blog")   # Excel 表格
doc_url,  doc_full  = upload_media("./docs/proposal.docx",     "blog")   # Word 文档
log_url,  log_full  = upload_media("./logs/debug.log",         "blog")   # 日志文本
md_url,   md_full   = upload_media("./notes/README.md",        "blog")   # Markdown 文件
ppt_url,  ppt_full  = upload_media("./slides/presentation.pptx","blog")   # PPT 幻灯片

# 并行上传多个文档
from concurrent.futures import ThreadPoolExecutor

def _up_doc(p: str) -> str:
    u, _ = upload_media(p, "blog")
    return u

with ThreadPoolExecutor() as pool:
    urls = list(pool.map(_up_doc, [
        "./docs/report.pdf",
        "./data/sales.xlsx",
        "./docs/proposal.docx",
    ]))
pdf_url, xlsx_url, doc_url = urls
```

**在文章中引用文档附件：**

```markdown
## 附件下载

### 季度报告 (PDF)

📄 [**下载 Q1 财务报告 (PDF, 2.3MB)**](/api/v1/media/files/uploads/blog/q1-report-xxx.pdf)

> 点击链接在新标签页中打开或下载 PDF 文件。

### 销售数据 (Excel)

📊 [**查看销售数据表 (XLSX, 156KB)**](/api/v1/media/files/uploads/blog/sales-2026-xxx.xlsx)

### 项目提案 (Word)

📝 [**下载完整提案 (DOCX, 890KB)**](/api/v1/media/files/uploads/blog/proposal-v2-xxx.docx)

### 运行日志 (文本)

📋 [**查看调试日志 (TXT, 45KB)**](/api/v1/media/files/uploads/blog/debug-xxx.log)
```

**文档引用的最佳实践：**

| 做法 | 示例 | 效果 |
|------|------|------|
| Markdown 链接 + 图标 | `[下载报告](url)` | 最简洁，浏览器自动决定预览还是下载 |
| 明确标注文件大小 | `(PDF, 2.3MB)` | 让用户知道下载量 |
| 使用 emoji 前缀 | `📄` `📊` `📝` `📋` | 直观区分文件类型 |
| 新标签页打开 | 在 `<a>` 加 `target="_blank"` | 不离开当前页面 |

**用 HTML `<a>` 标签精确控制（新窗口打开）：**

```html
<a href="/api/v1/media/files/uploads/blog/report.pdf"
   target="_blank"
   download="Q1-财务报告.pdf">
   📄 下载 Q1 财务报告 (PDF, 2.3MB)
</a>
```

---

##### 多媒体混合发布（完整示例）

一篇文章同时包含图片、视频、音频、文档附件：

```python
import base64, os, requests
from concurrent.futures import ThreadPoolExecutor

API_BASE = "https://your-domain.com/api/v1"
TOKEN = "t00_sk_xxxxx"

# ===== 并行上传所有媒体资源 =====
files_to_upload = [
    ("./cover.jpg", ""),              # 图片 - 封面（存根目录）
    ("./images/arch.png", "blog"),     # 图片 - 正文插图
    ("./videos/demo.mp4", "blog"),    # 视频 - 演示
    ("./audio/intro.mp3", "blog"),    # 音频 - 播客
    ("./docs/report.pdf", "blog"),     # 文档 - 报告附件
    ("./data/stats.xlsx", "blog"),    # 文档 - 数据表格
]

with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(lambda args: upload_media(args[0], args[1]), files_to_upload))

# results 是 (url, fullUrl) 元组列表，解包取引用URL
cover_url, fig1_url, video_url, audio_url, pdf_url, xlsx_url = [r[0] for r in results]
full_urls = [r[1] for r in results]  # 完整URL，可用于验证

# ===== 可选：批量验证所有媒体文件可访问性 =====
for i, fu in enumerate(full_urls):
    if fu:
        check = requests.head(fu, timeout=10)
        status = "OK" if check.status_code == 200 else f"FAIL({check.status_code})"
        print(f"  [{status}] {files_to_upload[i][0]} → {fu}")

# ===== 发布包含所有媒体类型的文章 =====
requests.post(f"{API_BASE}/ai/publish",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={
        "title": '<span style="color:#60c0ff">2026 年度技术总结</span>',
        "content": (
            "# 2026 年度技术总结\n\n"
            f"![项目架构图]({fig1_url})\n\n"
            "## 视频演示\n\n"
            f'<video src="{video_url}" controls width="720" height="405"'
            f' poster="{fig1_url}" preload="metadata"></video>\n\n'
            "> 以上是本年度核心功能的演示视频。\n\n"
            "## 播客解读\n\n"
            f'<audio src="{audio_url}" controls preload="metadata"></audio>\n\n'
            "**本期播客深度解读了架构选型的考量。**\n\n"
            "## 详细数据\n\n"
            f"📊 [**下载完整数据表 (XLSX)**]({xlsx_url})\n\n"
            "## 附录\n\n"
            f"📄 [**下载完整报告 (PDF)**]({pdf_url})"
        ),
        "section": "blog",
        "coverImageUrl": cover_url,
        "tags": ["年度总结", "视频", "播客"],
        "status": "published",
        "slug": "2026-tech-summary-multimedia",
    },
)
```

---

### 3. 获取文章列表

**GET** `/api/v1/ai/articles`

查询已发布文章，用于检查重复或查找要更新的文章。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大 50） |
| section | string | - | 按板块 slug 筛选 |

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "文章标题",
      "slug": "article-slug",
      "sectionId": 1,
      "publishedAt": "2024-01-15T10:00:00Z",
      "section": { "id": 1, "name": "博客", "slug": "blog", "path": "/blog" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

---

### 4. 删除文章

**DELETE** `/api/v1/ai/articles/:slug?deleteMedia=true`

根据 slug 删除文章。需要 `content:delete` 权限。

> **所有权规则：** 与发布接口相同，`superadmin` / `admin` 可删除任意文章，`user` 只能删除自己创建的文章。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| deleteMedia | boolean | `false` | 设为 `true` 时同时删除关联的媒体文件（物理文件 + 数据库记录） |

**成功响应：**

```json
{
  "success": true,
  "message": "Article deleted successfully",
  "data": { "mediaDeleted": true }
}
```

> **媒体清理说明：**
> - 仅删除通过 `articleId` 关联到该文章的媒体文件
> - 未关联的媒体（如手动上传未在文章中引用）不会被删除
> - 物理文件删除失败（如文件不存在）不会导致操作失败
> - **注意：** 此功能需要 `content:delete` 权限，与删除文章本身共享同一权限

---

### 5. 获取板块列表

**GET** `/api/v1/sections`

获取所有活跃板块。**发布前必调**，用于确认有效的 `section` 值。无需认证。

**常见板块参考：**

| slug | 名称 | 路径 |
|------|------|------|
| `blog` | 博客 | /blog |
| `ai_coding` | AI 编程 | /ai-coding |
| `ai_works` | AI 作品 | /ai-works |
| `token_plan` | Token 计划 | /token-plan |

> 完整列表请通过此接口实时获取，以上仅供参考可能过期。

**响应字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 板块 ID（用于查分类） |
| name | string | 板块名称 |
| slug | string | **发布文章时 `section` 参数使用此值** |
| path | string | 板块 URL 路径 |
| isActive | number | 1=启用 0=禁用（只使用 isActive=1 的） |

---

### 6. 获取分类

**GET** `/api/v1/categories?section=blog`

或 **GET** `/api/v1/sections/:id/categories`

获取分类列表。发布文章时 `category` 参数使用分类的 slug。无需认证。

**推荐用法：** 先通过 GET /sections 获取板块 id，再用 GET /sections/:id/categories 获取该板块下的分类。

**响应字段：**

| 字段 | 说明 |
|------|------|
| slug | **发布文章时 `category` 参数使用此值** |
| name | 分类名称 |
| articleCount | 该分类下已发布的文章数 |

---

### 7. 获取热门标签

**GET** `/api/v1/tags?limit=20`

获取有文章关联的标签，按文章数降序。无需认证。

---

### 8. 系统设置

**GET** `/api/v1/site-settings` — 获取所有设置（需 API Token 认证）

**PUT** `/api/v1/site-settings` — 批量更新设置（需 `settings:write` 权限）

**PUT 请求体：**

```json
{
  "settings": {
    "site_name": "新站点名称",
    "default_theme": "cyber",
    "frontend_locale": "en"
  }
}
```

**可设置的键名：**

| 键名 | 类型 | 说明 |
|------|------|------|
| site_name | string | 网站名称 |
| site_description | string | 网站描述 |
| default_theme | string | `night` \| `cyber` \| `lava` \| `light` \| `space` |
| frontend_locale | string | `zh` \| `en` |
| header_logo | string | 顶部 Logo URL |
| footer_logo | string | 底部 Logo URL |

---

### 9. 设置 / 取消置顶（远程专属）

**POST** `/api/v1/ai/articles/:slug/pin`

显式控制某篇文章的置顶状态，无需重新发布整篇文章。需要 `article:write` 权限。
与 `POST /ai/publish` 中的 `pinnedScope` 参数等效，但此接口只改置顶字段、不动标题/正文/状态，适合「已发布文章想临时置顶/取消」的场景。

> **所有权规则：** 与发布接口一致，`superadmin` / `admin` 角色可操作任意文章，`user` 角色只能操作自己创建的文章。

**请求体：**

```json
{
  "pinnedScope": "global"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 取值 | 效果 |
|------|------|------|------|------|
| pinnedScope | string | ✅ | `global` | **全站置顶**：在首页「最新文章」与全量文章列表（`/blog`）顶部展示 |
| pinnedScope | string | ✅ | `section` | **板块内置顶**：仅在文章所属板块列表顶部展示 |
| pinnedScope | string | ✅ | `none` | **取消置顶** |

**成功响应：**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "pinnedScope": "global",
    "pinnedAt": "2026-07-12T10:00:00.000Z"
  },
  "message": "Article pinned (global)"
}
```

**取消置顶响应：**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "pinnedScope": null,
    "pinnedAt": null
  },
  "message": "Article unpinned"
}
```

**错误响应：**

```json
{
  "success": false,
  "error": "Invalid pinnedScope",
  "hint": "pinnedScope must be one of: none, global, section"
}
```

**Python 示例：**

```python
import requests

API_BASE = "https://your-domain.com/api/v1"
TOKEN = "t00_sk_xxxxx"

# 将某篇文章设为全站置顶
resp = requests.post(
    f"{API_BASE}/ai/articles/my-article-slug/pin",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={"pinnedScope": "global"},
)
print(resp.json())
# → {'success': True, 'data': {'id': 123, 'slug': 'my-article-slug', ...}, 'message': 'Article pinned (global)'}

# 取消置顶
requests.post(
    f"{API_BASE}/ai/articles/my-article-slug/pin",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
    json={"pinnedScope": "none"},
)
```

---

## 标题格式化

标题支持 HTML 标签实现视觉增强效果：

```json
{ "title": "<strong>加粗标题</strong>" }
{ "title": "<span style=\"color:#7c3aed\">紫色标题</span>" }
{ "title": "<strong><span style=\"color:#60c0ff\">加粗蓝色</span></strong>" }
```

**可用颜色：** `#60c0ff`(蓝) `#7c3aed`(紫) `#10b981`(绿) `#f59e0b`(橙) `#ef4444`(红) `#ec4899`(粉)

---

## 权限矩阵

| 权限标识 | 允许的操作 | 发布场景是否需要 |
|----------|-----------|----------------|
| `article:write` | 发布/更新文章 | **必需** |
| `media:upload` | 上传媒体文件 | 有图片时 **必需** |
| `work:write` | 发布 AI 作品 | 一般不需要 |
| `content:delete` | 删除文章 | 删除时需要 |
| `settings:write` | 修改系统设置 | 一般不需要 |
| `statichtml:read` | 读取静态页面树/列表 | 一般不需要 |
| `statichtml:write` | 创建/更新/删除/重命名静态页面文件与文件夹 | 发布配套静态资源时需要 |

> **角色与所有权：** 即使拥有对应权限，`user` 角色的 Token 只能操作自己创建的文章（更新/删除）。`admin` / `superadmin` 角色可操作所有文章。
>
> **推荐 Token 配置：** 发布文章场景勾选 `article:write` + `media:upload` 即可。

---

## 最佳实践（Agent 版）

1. **发布顺序**：有图片时必须 **先上传（/media/ai）→ 后发布（/ai/publish）**，不能反过来
2. **去重检查**：发布前调用 GET /articles?section=xxx 检查是否有重复标题
3. **草稿优先**：重要文章先 `status: "draft"`，确认无误后再改 `published`
4. **slug 稳定性**：更新文章时保持 slug 不变；修改 slug 会创建新文章
5. **外部 URL 直引**：公网可访问的图片 URL 无需上传，直接写在 content 和 coverImageUrl 中
6. **Windows 环境**：使用 Node.js `fetch` 发送请求，避免 curl 中文乱码
7. **错误恢复**：上传失败检查 `error` + `detail` 字段；400 类错误修正参数即可重试，500 类错误稍后重试
8. **批量上传**：多张图片使用 `Promise.all` 并行上传，再统一发布文章

# TokenPress AI Publish API Reference

## Agent Quick Reference

| 操作 | 方法 | URL 路径 | 必需权限 |
|------|------|---------|----------|
| 发布文章 | `POST` | `/api/v1/ai/publish` | `article:write` |
| 上传媒体 | `POST` | `/api/v1/media/ai` | `media:upload` |
| 文章列表 | `GET` | `/api/v1/ai/articles` | 需 Token（无特定权限） |
| 删除文章 | `DELETE` | `/api/v1/ai/articles/:slug` | `content:delete` |
| 板块列表 | `GET` | `/api/v1/sections` | — |
| 分类列表 | `GET` | `/api/v1/categories` | — |
| 标签列表 | `GET` | `/api/v1/tags` | — |
| 系统设置 | `GET` / `PUT` | `/api/v1/site-settings` | 需 Token / PUT 需 `settings:write` |

**Base URL:** `{API_BASE}/api/v1`
**Auth Header:** `Authorization: Bearer {TOKEN}`（Token 格式：`t00_sk_` 开头）
**限流:** 10次/分钟（AI 发布端点）、100次/分钟（全局）
**Content-Type:** 所有 POST/PUT 请求 `application/json; charset=utf-8`

---

## 统一响应格式

### 成功响应

```json
{ "success": true, "data": { ... }, "message": "操作成功描述" }
```

### 错误响应（所有接口统一）

```json
{
  "success": false,
  "error": "<机器可读的错误码字符串>",
  "detail": "<人类可读的详细原因>",
  "hint": "<修复建议>"
}
```

---

## 发布文章

**POST** `/api/v1/ai/publish`

创建新文章或更新已有文章（根据 slug 判断：相同 slug = 更新，不同/缺失 = 新建）。

**请求体：**

```json
{
  "title": "文章标题（支持 <strong>HTML</strong>）",
  "content": "# Markdown 内容",
  "section": "blog",
  "category": "分类slug或名称",
  "tags": ["标签1", "标签2"],
  "coverImageUrl": "https://example.com/cover.jpg",
  "status": "published",
  "slug": "custom-slug",
  "publishedAt": "2024-01-15T10:00:00Z"
}
```

**必须参数：** `title`、`content`、`section`
**常用板块 slug：** `blog`、`ai_coding`、`ai_works`、`token_plan`、`claw`

**关于 `status` 字段：**

- `draft` — 草稿
- `published` — 发布（如果网站开启了内容审查，会先进入 `pending_review`，审核通过后自动变为 `published`）
- `archived` — 归档

响应中的 `data.status` 反映实际存储状态，可能与提交值不同。

**成功响应（创建）：**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://your-domain.com/blog/article-slug",
    "status": "published",
    "action": "created"
  }
}
```

> `data.action` — `created`（新建）或 `updated`（更新）
> `data.status` — 实际存储状态。若网站开启了内容审查且提交 `published`，可能返回 `pending_review`

---

## 上传媒体

**POST** `/api/v1/media/ai`  需 `media:upload` 权限。

### Base64 上传（本地文件）

```json
{
  "file": "<纯 base64 字符串，无 data:xxx;base64, 前缀>",
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "section": "blog"
}
```

### URL 引用上传（外部文件 → 媒体库）

```json
{
  "url": "https://example.com/image.png",
  "filename": "saved-name.png",
  "mimeType": "image/png"
}
```

**注意：** SVG/MD/TXT/LOG 文件以文本方式发送（非 base64），其余用 base64。

### 成功响应（HTTP 201）

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
    "thumbnailUrl": null
  }
}
```

> `data.url` 用于填入 `coverImageUrl` 或 `content` 的 `![](url)`
> `data.fullUrl` 用于验证可访问性

### 支持的文件类型与大小限制

| 类别 | 扩展名 | 大小限制 |
|------|--------|----------|
| 图片 | jpg, jpeg, png, gif, webp, svg | **10 MB** |
| 视频 | mp4, webm, ogv, mov | **200 MB** |
| 音频 | mp3, wav, ogg, flac, m4a | **50 MB** |
| 文档 | pdf, md, txt, log, xlsx, doc, docx, ppt, pptx | **50 MB** |

---

## 获取文章列表

**GET** `/api/v1/ai/articles?page=1&limit=20&section=blog`

> 仅返回 `status = published` 的文章。`pending_review` / `draft` 状态的文章不在此列表中。

---

## 删除文章

**DELETE** `/api/v1/ai/articles/:slug?deleteMedia=true`

`deleteMedia=true` 时同时删除关联的媒体文件。

---

## 权限

| 权限 | 说明 |
|------|------|
| `article:write` | 发布/更新文章（必需） |
| `media:upload` | 上传媒体文件（有图片时必需） |
| `content:delete` | 删除文章 |
| `settings:write` | 修改系统设置 |

---

## 健康检查

**GET** `/api/v1/health`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## 错误码速查

| error 值 | HTTP | Agent 应对 |
|----------|------|-----------|
| `Required fields: xxx` | 400 | 补全参数后重试 |
| `Invalid section "xxx"` | 400 | 确认 section 有效值：`token_plan`/`ai_coding`/`ai_works`/`blog`/`claw` |
| `Invalid status "xxx"` | 400 | status 只能为 `draft`/`published`/`archived` |
| `File type xxx is not allowed` | 400 | 检查扩展名→MIME映射 |
| `File too large. Max xxMB` | 400 | 图片≤10MB 视频≤200MB 文档≤50MB |
| `Invalid base64 data` | 400 | 检查是否包含 `data:...;base64,` 前缀（应去掉） |
| `Missing API token` / `Invalid API token format` | 401 | 检查 Token 是否以 `t00_sk_` 开头 |
| `API token not found` | 401 | Token 不存在，检查是否复制完整 |
| `API token has been revoked` | 401 | Token 已被撤销，需重新创建 |
| `API token has expired` | 401 | Token 已过期，需重新创建 |
| `Missing required permission: xxx` | 403 | 提示用户为 Token 添加该权限 |
| `Cannot update/delete articles owned by other users` | 403 | user 角色只能操作自己的文章 |
| `Article not found` | 404 | slug 对应的文章不存在 |
| `Too many publish requests` | 429 | 限流 10次/分钟，稍后重试 |
| `Database write failed` | 500 | 稍后重试 |

---

## 标题 HTML 格式化

支持 HTML 标签实现视觉增强：

```json
{ "title": "<strong>加粗标题</strong>" }
{ "title": "<span style=\"color:#60c0ff\">蓝色标题</span>" }
```

**可用颜色：** `#60c0ff`(蓝) `#7c3aed`(紫) `#10b981`(绿) `#f59e0b`(橙) `#ef4444`(红) `#ec4899`(粉)

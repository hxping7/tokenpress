# TokenPress AI Publish API Reference

## 认证

所有请求 Header:
```
Authorization: Bearer t00_sk_xxxxx
```

## 基础 URL

```
https://www.yourdomain.com/api/v1
```

---

## 接口

### POST /api/v1/ai/publish — 发布文章

创建或更新文章（根据 slug 判断是创建还是更新）。

**请求体:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | Y | 文章标题，支持 HTML 格式化 |
| content | string | Y | Markdown 正文 |
| section | string | Y | 板块 slug (blog/ai_coding/ai_works/token_plan) |
| category | string | N | 分类 slug 或名称 |
| tags | string[] | N | 标签数组 |
| coverImageUrl | string | N | 封面图 URL |
| status | string | N | draft 或 published，默认 draft |
| slug | string | N | 自定义 URL slug |
| publishedAt | string | N | ISO 8601 发布时间 |

**响应:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://www.yourdomain.com/blog/article-slug",
    "status": "published",
    "action": "created"
  }
}
```

---

### GET /api/v1/ai/articles — 获取文章列表

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 (max 50) |
| section | string | - | 按板块筛选 |

---

### DELETE /api/v1/ai/articles/:slug — 删除文章

需 `content:delete` 权限。

---

### POST /api/v1/media/ai — 上传媒体

需 `media:upload` 权限。

**Base64 上传:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | string | Y* | Base64 编码文件 |
| filename | string | Y | 文件名 |
| mimeType | string | Y | MIME 类型 |
| section | string | N | 存储子目录 |

**URL 引用上传:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | Y* | 外部文件 URL |
| filename | string | Y | 文件名 |
| mimeType | string | Y | MIME 类型 |

**支持类型:** image/jpeg, image/png, image/gif, image/webp, image/svg+xml, video/mp4, video/webm, video/quicktime

---

### GET /api/v1/sections — 板块列表（无需认证）

### GET /api/v1/sections/:id/categories — 板块分类（无需认证）

### GET /api/v1/categories?section=blog — 分类列表（无需认证）

### GET /api/v1/tags?limit=20 — 热门标签（无需认证）

### GET /api/v1/site-settings — 获取系统设置

### PUT /api/v1/site-settings — 更新系统设置（需 settings:write 权限）

---

## 权限

| 权限 | 说明 |
|------|------|
| article:write | 发布文章 |
| media:upload | 上传媒体 |
| work:write | 发布 AI 作品 |
| content:delete | 删除文章 |
| settings:write | 修改系统设置 |

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | 不存在 |
| 500 | 服务器错误 |

## 限流

10 次/分钟

## 标题 HTML 格式化

标题支持 HTML 标签:
- `<strong>加粗</strong>`
- `<span style="color:#60c0ff">蓝色</span>`

可用颜色: #60c0ff(蓝), #7c3aed(紫), #10b981(绿), #f59e0b(橙), #ef4444(红), #ec4899(粉)

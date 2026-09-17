# TokenPress AI Publish API Reference

> 端点契约以 `apps/server/src/routes/ai-publish.ts` 为准；此文档与之同步维护。

## 认证

所有请求 Header:

```
Authorization: Bearer t00_sk_xxxxx
Content-Type: application/json
```

> ⚠️ **同时要带 `User-Agent`**（如 `Mozilla/5.0`）。缺 UA 会被反爬中间件拦下。

## 基础 URL

```
https://<你的域名>/api/v1
```

## 挂载与限流

`/api/v1/ai` 整体挂载了限流器：窗口 60s，上限取 `site_settings.rate_limit_ai_publish`，
**默认 30 次/分钟**（可在后台「系统设置」调整）。列表/详情/删除也都算在这个额度里。

---

## 接口

### POST /api/v1/ai/publish — 发布文章

创建或更新文章（**按 slug 判断**：slug 已存在则更新，返回 `action: "updated"`；否则新建，`action: "created"`）。

**请求体:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | Y | 文章标题，支持 HTML 格式化 |
| content | string | Y | Markdown 正文 |
| section | string | Y | **板块 slug，且该板块必须已存在**（此接口不建板块） |
| category | string | N | 分类 slug 或名称（不存在时会按需创建） |
| tags | string[] | N | 标签数组（不存在的标签会创建） |
| coverImageUrl | string | N | 封面图 URL 或本地路径 |
| status | string | N | draft 或 published，默认 draft |
| slug | string | N | 自定义 URL slug |
| publishedAt | string | N | ISO 8601 发布时间 |
| pinnedScope | string | N | 置顶范围：none / global / section |

**响应:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://<SITE_URL>/<section.path>/article-slug",
    "status": "published",
    "action": "created"
  }
}
```

> ⚠️ `data.url` 用的是**后端进程的 `SITE_URL`**，不是你请求的 `api_base`。给本地站/测试站发布时该字段会显示生产域名，**不要拿它当验证依据** —— 用 `api_base` 自行推导，或直接访问前台。

**校验失败的报错（板块不存在）:**

```json
{ "success": false,
  "error": "Invalid section \"xxx\". Section not found.",
  "hint": "section must be a valid section slug ..." }
```

---

### GET /api/v1/ai/articles — 获取文章列表

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 (max 50) |
| section | string | - | 按板块筛选 |

返回结构：`data` 是**数组**，`pagination` 在**顶层**；文章字段用驼峰（`coverImage` 而非 `cover_image`）。

---

### DELETE /api/v1/ai/articles/:slug — 删除文章

需 `content:delete` 权限。

> 注意：删除文章**不会**回收该文章引入的标签（`tags` 表里的行会留下）与已上传的媒体文件。

---

### POST /api/v1/ai/articles/:slug/pin — 置顶 / 取消置顶

需 `article:write` 权限。

**请求体:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pinnedScope | string | Y | `none`（取消置顶）/ `global`（全局置顶）/ `section`（板块内置顶） |

```json
{ "success": true,
  "data": { "id": 1, "slug": "...", "pinnedScope": "global", "pinnedAt": "..." },
  "message": "Article pinned (global)" }
```

> 所有权校验：`superadmin` / `admin` 可操作任意文章；普通用户 token 只能操作自己发布的文章（否则 403）。

---

### POST /api/v1/ai/categories — 新建分类

需 `article:write` 权限。body：`{ name, sectionId, slug?, description? }`。

### PUT /api/v1/ai/categories/:id — 更新分类

需 `article:write` 权限。

> **板块（section）没有 AI 接口**。建板块要用管理类接口 `POST /api/v1/sections`
> （需 `sections:write`，body：`{ name, path, slug?, template?, sortOrder? }`），
> 或直接在后台「板块管理」创建。**发布前务必先确认板块存在**，
> 否则 `/ai/publish` 直接 400。

---

### POST /api/v1/media/ai — 上传媒体

需 `media:upload` 权限。

**Base64 上传:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | string | Y* | Base64 编码文件 |
| filename | string | Y | 文件名 |
| mimeType | string | Y | MIME 类型 |
| section | string | N | 存储子目录（**只是目录名，不校验板块是否存在**） |

**URL 引用上传:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | Y* | 外部文件 URL |
| filename | string | Y | 文件名 |
| mimeType | string | Y | MIME 类型 |

> ⚠️ **URL 模式只登记引用，不下载文件**：记录里 `url` 就是该外链、`size = 0`，
> 外链失效即图裂。需要真正落盘就用 Base64 模式（`publish.py` / `upload_media.py`
> 传本地文件走的就是 Base64）。

**支持类型:** image/jpeg, image/png, image/gif, image/webp, image/svg+xml, video/mp4, video/webm, video/quicktime

---

### GET /api/v1/sections — 板块列表（无需认证）

### GET /api/v1/sections/all — 全部板块（含未启用，需 `sections:write`）

### GET /api/v1/sections/:id/categories — 板块分类（无需认证）

### GET /api/v1/categories?section=blog — 分类列表（无需认证）

### GET /api/v1/tags?limit=20 — 热门标签（无需认证）

### GET /api/v1/site-settings — 获取系统设置

### PUT /api/v1/site-settings — 更新系统设置（需 `settings:write` 权限）

body 两种写法：`{"settings":{k:v}}` 或 `[{"key":..., "value":...}]`

---

## 权限

以 `packages/shared/src/constants/index.ts` 的 `API_PERMISSION_CATALOG` 为唯一来源。

| 权限 | 说明 |
|------|------|
| article:write | 发布/更新文章、建改分类、置顶 |
| media:upload | 上传媒体 |
| content:delete | 删除文章 |
| settings:write | 修改系统设置 |
| sections:write | 建/改板块（管理类接口，非 `/ai`） |

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 / 201 | 成功 |
| 400 | 参数错误（含板块不存在） |
| 401 | 未授权（token 缺失/失效） |
| 403 | 权限不足 |
| 404 | 不存在 |
| 429 | 触发限流 |
| 500 | 服务器错误 |

## 标题 HTML 格式化

标题支持 HTML 标签:
- `<strong>加粗</strong>`
- `<span style="color:#60c0ff">蓝色</span>`

可用颜色: #60c0ff(蓝), #7c3aed(紫), #10b981(绿), #f59e0b(橙), #ef4444(红), #ec4899(粉)

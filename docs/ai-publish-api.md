# TokenPress AI 发布 API 文档

## 概述

TokenPress 提供 AI 发布 API，允许外部 AI 代理（如 Claude、ChatGPT、自定义机器人等）通过 API Token 远程发布文章。

## 认证

所有 API 请求需要在 Header 中携带 API Token：

```
Authorization: Bearer t00_sk_xxxxx
```

API Token 需要在管理后台的「Token 管理」中创建，并授予相应权限。

## 基础 URL

```
https://your-domain.com/api/v1/ai
```

---

## 接口列表

### 1. 发布文章

**POST** `/api/v1/ai/publish`

创建新文章或更新已有文章（根据 slug 判断）。

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
  "publishedAt": "2024-01-15T10:00:00Z"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | ✅ | 文章标题，支持 HTML 格式化（如 `<strong>加粗</strong>`、`<span style="color:#7c3aed">紫色</span>`） |
| content | string | ✅ | Markdown 格式的文章内容 |
| section | string | ✅ | 板块 slug，如 `blog`、`ai_coding`、`ai_works`、`token_plan` |
| category | string | ❌ | 分类 slug 或名称 |
| tags | string[] | ❌ | 标签数组 |
| coverImageUrl | string | ❌ | 封面图片 URL |
| status | string | ❌ | 文章状态：`draft`（草稿）、`published`（已发布），默认 `draft` |
| slug | string | ❌ | 自定义 URL slug，不提供则自动生成 |
| publishedAt | string | ❌ | 发布时间（ISO 8601 格式），不提供则使用当前时间 |

**成功响应：**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://your-domain.com/blog/article-slug",
    "status": "published",
    "action": "created"
  },
  "message": "Article published successfully"
}
```

**错误响应：**

```json
{
  "success": false,
  "error": "Required fields: title, content, section",
  "hint": "section must be a valid section slug (e.g., blog, ai_coding, token_plan)"
}
```

---

### 2. 获取文章列表

**GET** `/api/v1/ai/articles`

获取已发布文章列表，用于检查已有内容。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大 50） |
| section | string | - | 按板块筛选 |

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
      "section": {
        "id": 1,
        "name": "博客",
        "slug": "blog",
        "path": "/blog"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

---

### 3. 删除文章

**DELETE** `/api/v1/ai/articles/:slug`

根据 slug 删除文章。需要 `content:delete` 权限。

**成功响应：**

```json
{
  "success": true,
  "message": "Article deleted successfully"
}
```

---

### 7. 获取板块列表

**GET** `/api/v1/sections`

获取所有活跃板块列表，无需认证。发布文章前可先调用此接口获取有效的板块 slug。

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "博客",
      "slug": "blog",
      "path": "/blog",
      "description": "博客文章",
      "externalUrl": null,
      "sortOrder": 4,
      "isActive": 1,
      "createdAt": "2024-01-01 00:00:00",
      "updatedAt": "2024-01-01 00:00:00"
    }
  ]
}
```

**数据字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 板块 ID |
| name | string | 板块名称 |
| slug | string | 板块 slug（发布文章时 `section` 参数使用此值） |
| path | string | 板块 URL 路径 |
| description | string\|null | 板块描述 |
| externalUrl | string\|null | 外部链接 URL（如有则点击菜单直接跳转） |
| sortOrder | number | 排序权重 |
| isActive | number | 是否启用（1=启用，0=禁用） |

**代码示例：**

```bash
curl https://your-domain.com/api/v1/sections
```

---

### 8. 获取板块下的分类

**GET** `/api/v1/sections/:id/categories`

获取指定板块下的所有分类，无需认证。发布文章时 `category` 参数应使用分类的 slug。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | ✅ | 板块 ID（从获取板块列表接口获取） |

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "AI 工具",
      "slug": "ai-tools",
      "sectionId": 1,
      "description": "AI 工具相关文章",
      "sortOrder": 0
    }
  ]
}
```

**数据字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 分类 ID |
| name | string | 分类名称 |
| slug | string | 分类 slug（发布文章时 `category` 参数使用此值） |
| sectionId | number | 所属板块 ID |
| description | string\|null | 分类描述 |
| sortOrder | number | 排序权重 |

**代码示例：**

```bash
curl https://your-domain.com/api/v1/sections/1/categories
```

---

### 9. 获取分类列表

**GET** `/api/v1/categories`

获取所有分类列表，无需认证。支持按板块 slug 筛选，返回结果包含所属板块信息和文章数量。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| section | string | - | 按板块 slug 筛选分类 |

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "AI 工具",
      "slug": "ai-tools",
      "sectionId": 1,
      "description": "AI 工具相关文章",
      "sortOrder": 0,
      "articleCount": 12,
      "section": {
        "id": 1,
        "name": "博客",
        "slug": "blog",
        "path": "/blog"
      }
    }
  ]
}
```

**数据字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 分类 ID |
| name | string | 分类名称 |
| slug | string | 分类 slug（发布文章时 `category` 参数使用此值） |
| sectionId | number | 所属板块 ID |
| description | string\|null | 分类描述 |
| sortOrder | number | 排序权重 |
| articleCount | number | 已发布文章数量 |
| section | object | 所属板块信息 |
| section.id | number | 板块 ID |
| section.name | string | 板块名称 |
| section.slug | string | 板块 slug |
| section.path | string | 板块 URL 路径 |

**代码示例：**

```bash
# 获取所有分类
curl https://your-domain.com/api/v1/categories

# 按板块筛选分类
curl https://your-domain.com/api/v1/categories?section=blog
```

---

### 10. 获取热门标签

**GET** `/api/v1/tags`

获取热门标签列表，无需认证。返回有文章关联的标签，按文章数量降序排列。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| limit | number | 20 | 返回数量（最大 100） |

**成功响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "AI",
      "article_count": 15
    },
    {
      "id": 2,
      "name": "教程",
      "article_count": 8
    }
  ]
}
```

**代码示例：**

```bash
curl https://your-domain.com/api/v1/tags?limit=10
```

---

## 常见板块参考

以下为常见板块，完整列表请通过 GET `/api/v1/sections` 实时获取：

| slug | 名称 | 路径 |
|------|------|------|
| blog | 博客 | /blog |
| ai_coding | AI 编程 | /ai-coding |
| ai_works | AI 作品 | /ai-works |
| token_plan | Token 计划 | /token-plan |

---

## 标题格式化

标题支持 HTML 格式化，可实现加粗和颜色效果：

```json
{
  "title": "<strong>加粗标题</strong>",
  "title": "<span style=\"color:#7c3aed\">紫色标题</span>",
  "title": "<strong><span style=\"color:#60c0ff\">加粗蓝色标题</span></strong>"
}
```

**可用颜色：**
- `#60c0ff` - 蓝色
- `#7c3aed` - 紫色
- `#10b981` - 绿色
- `#f59e0b` - 橙色
- `#ef4444` - 红色
- `#ec4899` - 粉色

---

## 代码示例

### cURL

```bash
curl -X POST https://your-domain.com/api/v1/ai/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -d '{
    "title": "我的第一篇AI文章",
    "content": "# 标题\n\n这是文章内容...",
    "section": "blog",
    "tags": ["AI", "测试"],
    "status": "published"
  }'
```

### JavaScript / Node.js

```javascript
const response = await fetch('https://your-domain.com/api/v1/ai/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer t00_sk_xxxxx'
  },
  body: JSON.stringify({
    title: '我的第一篇AI文章',
    content: '# 标题\n\n这是文章内容...',
    section: 'blog',
    tags: ['AI', '测试'],
    status: 'published'
  })
});

const result = await response.json();
console.log(result.data.url);
```

### Python

```python
import requests

response = requests.post(
    'https://your-domain.com/api/v1/ai/publish',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer t00_sk_xxxxx'
    },
    json={
        'title': '我的第一篇AI文章',
        'content': '# 标题\n\n这是文章内容...',
        'section': 'blog',
        'tags': ['AI', '测试'],
        'status': 'published'
    }
)

result = response.json()
print(result['data']['url'])
```

---

### 4. 上传媒体文件

**POST** `/api/v1/media/ai`

上传图片或视频文件。需要 `media:upload` 权限。

**请求体（Base64 上传）：**

```json
{
  "file": "base64编码的文件内容",
  "filename": "image.png",
  "mimeType": "image/png",
  "section": "blog"
}
```

**请求体（URL 引用）：**

```json
{
  "url": "https://example.com/image.png",
  "filename": "image.png",
  "mimeType": "image/png"
}
```

**参数说明：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | string | ❌* | Base64 编码的文件内容 |
| url | string | ❌* | 外部文件 URL（与 file 二选一） |
| filename | string | ✅ | 原始文件名 |
| mimeType | string | ✅ | MIME 类型，如 `image/png`、`image/jpeg`、`video/mp4` |
| section | string | ❌ | 存储子目录，如 `blog`、`logo` |

**支持的文件类型：**
- 图片：`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- 视频：`video/mp4`, `video/webm`, `video/quicktime`

**成功响应：**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "image.png",
    "originalName": "image.png",
    "mimeType": "image/png",
    "size": 12345,
    "url": "https://your-domain.com/api/v1/media/files/uploads/blog/image.png"
  }
}
```

**代码示例：**

```bash
# Base64 上传
curl -X POST https://your-domain.com/api/v1/media/ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -d '{
    "file": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "filename": "pixel.png",
    "mimeType": "image/png"
  }'

# URL 引用
curl -X POST https://your-domain.com/api/v1/media/ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -d '{
    "url": "https://example.com/image.png",
    "filename": "external-image.png",
    "mimeType": "image/png"
  }'
```

---

### 5. 获取系统设置

**GET** `/api/v1/site-settings`

获取所有系统设置。

**成功响应：**

```json
{
  "success": true,
  "data": {
    "site_name": "Token∞",
    "site_description": "Token 力量无限放大",
    "header_logo": "https://...",
    "footer_logo": "https://...",
    "footer_nav": "[{\"name\":\"博客\",\"url\":\"/blog\"}]",
    "hero_slides": "[{\"id\":\"1\",\"imageUrl\":\"https://...\",\"linkUrl\":\"/blog\",\"linkTarget\":\"_self\"}]",
    "hero_effect": "fade",
    "friend_links_columns": "2",
    "default_theme": "night",
    "frontend_locale": "zh",
    "backend_locale": "zh"
  }
}
```

---

### 6. 更新系统设置

**PUT** `/api/v1/site-settings`

更新系统设置。需要 `settings:write` 权限。

**请求体：**

```json
{
  "settings": {
    "site_name": "新站点名称",
    "site_description": "新站点描述",
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
| header_logo | string | 顶部 Logo URL |
| footer_logo | string | 底部 Logo URL |
| footer_nav | string (JSON) | 底部导航，JSON 数组格式 |
| hero_slides | string (JSON) | 首页轮播图，JSON 数组格式 |
| hero_effect | string | 轮播效果：`fade`、`slide`、`zoom`、`flip` |
| friend_links_columns | string | 友链列数：`1`、`2`、`3`、`4` |
| default_theme | string | 默认主题：`night`、`cyber`、`lava`、`light`、`space` |
| frontend_locale | string | 前台语言：`zh`、`en` |
| backend_locale | string | 后台语言：`zh`、`en` |

**成功响应：**

```json
{
  "success": true,
  "data": {
    "site_name": "新站点名称",
    "site_description": "新站点描述",
    ...
  }
}
```

**代码示例：**

```bash
curl -X PUT https://your-domain.com/api/v1/site-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -d '{
    "settings": {
      "site_name": "My New Site",
      "default_theme": "cyber"
    }
  }'
```

---

## 权限说明

创建 API Token 时需要设置权限：

| 权限 | 说明 |
|------|------|
| `article:write` | 发布文章（创建和更新） |
| `media:upload` | 上传媒体文件 |
| `work:write` | 发布 AI 作品 |
| `content:delete` | 删除文章 |
| `settings:write` | 修改系统设置 |

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（Token 无效或缺失） |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 最佳实践

1. **先检查后发布**：使用列表接口检查是否已存在相似文章，避免重复发布
2. **使用草稿模式**：重要文章先以 `draft` 状态发布，人工审核后再上线
3. **设置合适标签**：便于文章分类和检索
4. **自定义 slug**：使用有意义的 slug 提高可读性和 SEO
5. **错误处理**：检查响应中的 `success` 字段，处理可能的错误情况

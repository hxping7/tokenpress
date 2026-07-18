# Token00 文章发布 API 技能

## 概述

本技能允许 AI 智能体通过 API Token 远程发布文章到 Token00 内容管理平台。

## 认证方式

所有 API 请求需要通过 Bearer Token 认证：

```
Authorization: Bearer t00_sk_xxxxx
```

- Token 格式：以 `t00_sk_` 开头的字符串
- Token 需要在管理后台创建并分配相应权限

## API 端点

### 1. 发布文章

**请求**
```
POST /api/v1/ai/publish
Content-Type: application/json
Authorization: Bearer t00_sk_xxxxx
```

**请求体**
```json
{
  "title": "文章标题",
  "content": "# Markdown 内容\n\n正文...",
  "section": "blog",
  "category": "分类slug或名称",
  "tags": ["标签1", "标签2"],
  "coverImageUrl": "https://example.com/cover.jpg",
  "status": "published",
  "slug": "自定义slug（可选）",
  "publishedAt": "2024-01-01T00:00:00Z（可选）"
}
```

**必填字段**
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题 |
| content | string | Markdown 格式的文章内容 |
| section | string | 内容分区 |

**可选字段**
| 字段 | 类型 | 说明 |
|------|------|------|
| category | string | 分类标识（支持 slug 或名称，详见下方说明） |
| tags | string[] | 标签数组（详见下方说明） |

**分类指定方式**

`category` 字段支持以下两种方式：

1. **分类 Slug（推荐）**：使用分类的 URL 标识符
   - 会结合 `section` 进行精确匹配
   - 示例：`"category": "ai-tools"` 匹配 section 下的 `ai-tools` 分类

2. **分类名称**：使用分类的显示名称
   - 当 slug 匹配不到时，会尝试按名称匹配
   - 示例：`"category": "AI工具"` 会匹配名称为 "AI工具" 的分类

**匹配优先级**：slug + section > 名称

> 如果指定的分类不存在，文章将不属于任何分类（不报错）。

**标签指定方式**

`tags` 字段为字符串数组，用于给文章添加标签：

- **自动创建**：如果标签不存在，系统会自动创建
- **示例**：`"tags": ["AI", "教程", "自动化"]`
- **更新行为**：更新文章时会替换原有标签
| coverImageUrl | string | 封面图片 URL |
| status | string | 状态：`draft`（默认）、`published`、`archived` |
| slug | string | 自定义 URL slug，不填则根据标题自动生成 |
| publishedAt | string | 发布时间（ISO 8601 格式） |

**Section 可选值**
| 值 | 说明 |
|------|------|
| token_plan | Token 规划 |
| ai_coding | AI 编程 |
| ai_works | AI 作品 |
| blog | 博客 |
| claw | Claw |

**成功响应（创建）**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://site.com/blog/article-slug",
    "status": "published",
    "action": "created"
  },
  "message": "Article published successfully"
}
```

**成功响应（更新）**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "slug": "article-slug",
    "url": "https://site.com/blog/article-slug",
    "status": "published",
    "action": "updated"
  },
  "message": "Article updated successfully"
}
```

> 注意：如果提供的 slug 已存在，将更新该文章；否则创建新文章。

### 2. 获取文章列表

**请求**
```
GET /api/v1/ai/articles?page=1&limit=20&section=blog
Authorization: Bearer t00_sk_xxxxx
```

**查询参数**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量（最大 50） |
| section | string | - | 按分区筛选 |

**成功响应**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "文章标题",
      "slug": "article-slug",
      "section": "blog",
      "publishedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### 3. 删除文章

**请求**
```
DELETE /api/v1/ai/articles/:slug
Authorization: Bearer t00_sk_xxxxx
```

> 需要权限：`site:write`

**成功响应**
```json
{
  "success": true,
  "message": "Article deleted successfully"
}
```

## 错误响应

### 认证错误（401）
```json
{
  "success": false,
  "error": "Missing API token"
}
```

```json
{
  "success": false,
  "error": "Invalid API token format"
}
```

```json
{
  "success": false,
  "error": "API token not found"
}
```

```json
{
  "success": false,
  "error": "API token has been revoked"
}
```

```json
{
  "success": false,
  "error": "API token has expired"
}
```

### 权限错误（403）
```json
{
  "success": false,
  "error": "Missing required permission: site:write"
}
```

### 请求错误（400）
```json
{
  "success": false,
  "error": "Required fields: title, content, section",
  "hint": "section must be one of: token_plan, ai_coding, ai_works, blog, claw"
}
```

```json
{
  "success": false,
  "error": "Invalid section \"invalid_section\". Must be one of: token_plan, ai_coding, ai_works, blog, claw"
}
```

### 资源不存在（404）
```json
{
  "success": false,
  "error": "Article not found"
}
```

## 权限说明

| 权限 | 说明 |
|------|------|
| site:write | 发布/更新文章 |
| site:write | 删除文章 |
| site:write | 上传媒体文件 |

## 使用示例

### cURL
```bash
curl -X POST https://api.example.com/api/v1/ai/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer t00_sk_your_token_here" \
  -d '{
    "title": "我的第一篇AI文章",
    "content": "# 欢迎\n\n这是由AI智能体发布的文章。",
    "section": "blog",
    "category": "ai-tools",
    "tags": ["AI", "自动化"],
    "status": "published"
  }'
```

### 指定分类示例
```json
{
  "title": "AI编程技巧",
  "content": "# 内容...",
  "section": "ai_coding",
  "category": "tutorials",
  "status": "published"
}
```

> `category` 可以是分类的 slug（如 `tutorials`）或名称（如 `教程`），推荐使用 slug。

### JavaScript (Fetch)
```javascript
const response = await fetch('https://api.example.com/api/v1/ai/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer t00_sk_your_token_here'
  },
  body: JSON.stringify({
    title: '我的第一篇AI文章',
    content: '# 欢迎\n\n这是由AI智能体发布的文章。',
    section: 'blog',
    tags: ['AI', '自动化'],
    status: 'published'
  })
});

const result = await response.json();
console.log(result);
```

### Python (requests)
```python
import requests

response = requests.post(
    'https://api.example.com/api/v1/ai/publish',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer t00_sk_your_token_here'
    },
    json={
        'title': '我的第一篇AI文章',
        'content': '# 欢迎\n\n这是由AI智能体发布的文章。',
        'section': 'blog',
        'tags': ['AI', '自动化'],
        'status': 'published'
    }
)

result = response.json()
print(result)
```

## AI 智能体集成指南

### 系统提示词示例

```
你是一个内容发布助手。当用户要求发布文章时：

1. 收集必要信息：标题、内容、分区(section)
2. 可选信息：分类、标签、封面图片、发布状态
3. 调用 POST /api/v1/ai/publish 接口
4. 返回发布结果，包括文章 URL

可用分区：token_plan, ai_coding, ai_works, blog, claw
```

### 工作流程

1. **确认发布意图** - 用户请求发布文章
2. **收集内容** - 确保标题、内容、分区三个必填字段
3. **调用 API** - 发送 POST 请求到 `/api/v1/ai/publish`
4. **处理响应** - 向用户展示发布结果或错误信息
5. **提供链接** - 成功后返回文章访问 URL

### 限流说明

- 发布接口限制：每分钟最多 10 次请求
- 超限响应：
```json
{
  "success": false,
  "error": "Too many publish requests"
}
```

## 完整 API 基础 URL

- 开发环境：`http://localhost:4001/api/v1`
- 生产环境：根据实际部署配置

## 健康检查

```
GET /api/v1/health
```

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

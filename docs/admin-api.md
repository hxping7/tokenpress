# TokenPress 远程后台管理 API 文档（合并版）

> 面向 AI Agent / LLM 的**全站后台远程管理**接口文档（由原「后台管理」与「设置控制」两份文档合并为单一文档）。
> 覆盖全部可经 access token 远程控制的后台项：**系统设置、友链、顶部导航、分类、用户、备份、广告、敏感词、内容审核、统计、日志、静态页面（statichtml）**。
> 所有接口返回 JSON，统一错误格式。
>
> **权限模型**：通过后台 `/admin/tokens` 为不同 Agent 创建不同权限的 access Token 来实现权限隔离（最小权限原则）。
> 文章发布 / 删除 / 置顶走独立的 `ai-publish-api.md`（权限 `article:write` / `content:delete`），本文不重复覆盖。

---

## Agent Quick Reference

| 资源 | 操作 | 方法 | URL 路径 | 必需权限 |
|------|------|------|---------|----------|
| 系统设置 | 读取全部 | `GET` | `/api/v1/site-settings` | 公开 |
| 系统设置 | 按 key 读取 | `GET` | `/api/v1/site-settings/keys/{k1,k2}` | 公开 |
| 系统设置 | 修改（单条/批量） | `PUT` | `/api/v1/site-settings` | `settings:write` |
| 友链 | 列表 | `GET` | `/api/v1/friend-links` | 公开 |
| 友链 | 新增/更新/删除/排序 | `POST`/`PUT`/`DELETE`/`PATCH` | `/api/v1/friend-links(/:id)` | `friendlinks:write` |
| 顶部导航 | 列表 | `GET` | `/api/v1/sections` | 公开 |
| 顶部导航 | 新增/更新/删除/排序 | `POST`/`PUT`/`DELETE`/`PATCH` | `/api/v1/sections(/:id)` | `sections:write` |
| 分类 | 列表 | `GET` | `/api/v1/categories` | 公开 |
| 分类 | 新增/更新/删除 | `POST`/`PUT`/`DELETE` | `/api/v1/categories(/:id)` | `categories:write` |
| 用户 | 创建/更新/重置密码/删除 | `POST`/`PUT`/`PATCH`/`DELETE` | `/api/v1/users(/:id)` | `users:write`（仅 superadmin 签发） |
| 数据统计 | 读取 | `GET` | `/api/v1/stats` | `stats:read` |
| 日志 | API 日志 / 系统事件 | `GET` | `/api/v1/logs/api`、`/api/v1/logs/system` | `logs:read` |
| 备份 | 设置/创建/列表/还原/删除 | `GET`/`PUT`/`POST`/`DELETE` | `/api/v1/backup(/:id)` | `backup:write` |
| 内容审核 | 列表/通过/拒绝/重试 | `GET`/`POST` | `/api/v1/admin/reviews(/:id/...)` | `reviews:write` |
| 敏感词 | 列表/增删/批量 | `GET`/`POST`/`PUT`/`DELETE` | `/api/v1/admin/sensitive-keywords(/:id)` | `keywords:write` |
| 广告 | 列表/创建/审核 | `GET`/`POST` | `/api/v1/admin/ads(/:id/...)` | `ads:write` |
| 静态页 | 树形/扁平列表 | `GET` | `/api/v1/statichtml/tree`、`/api/v1/statichtml/list` | `statichtml:read` |
| 静态页 | 建/删/重命名文件夹、上传/替换/删/重命名文件 | `POST`/`PUT`/`DELETE`/`PATCH` | `/api/v1/statichtml/folder`、`/api/v1/statichtml/file` | `statichtml:write` |

**Base URL:** `{API_BASE}/api/v1`（本地预览 `http://localhost:8081/api/v1`，生产 `https://www.token00.com/api/v1`）
**Auth Header:** `Authorization: Bearer {TOKEN}`（Token 格式：`t00_sk_` 开头）
**内容类型:** 所有 POST/PUT 请求 `Content-Type: application/json; charset=utf-8`

---

## 认证与权限模型

### 如何获取 access Token（后台 `/admin/tokens`）

1. 用管理员账号登录后台，进入 **`/admin/tokens`**（API Token 管理页）。
2. 点击「新建 Token」，填写名称，并在权限清单中勾选该 Token 需要的权限（如 `settings:write`、`statichtml:write`、`stats:read` 等）。
3. 提交后生成 `t00_sk_xxxx` 格式的 Token，**立即复制保存**（仅显示一次）。
4. **不同 Agent / 不同用途使用不同 Token**，遵循最小权限：
   - 内容机器人 → 只给 `article:write`（见 `ai-publish-api.md`），绝不给 `settings:write`。
   - 配置机器人 → 给 `settings:write` 但不必给 `sections:write`。
   - 统计看板 → 只给 `stats:read`。
5. Token 可随时在 `/admin/tokens` 吊销或调整（调整后重新下发）。

> 本地开发预览地址示例：`http://localhost:8081/admin/tokens`；生产：`https://www.token00.com/admin/tokens`。

### 鉴权方式（access token）

所有**写**接口采用 **API Token（指定权限）鉴权**：请求头携带 `Authorization: Bearer t00_sk_xxxxx`，Token 需持有对应权限（如 `settings:write`）方可调用。

- **Token 命中且持有指定权限** → 注入合成 admin 身份放行 + 记录 API 用量日志（`api_logs`），便于审计。
- 写请求都需带 `Authorization: Bearer t00_sk_xxxxx`。

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
| `Missing API token` / `Invalid API token format` | 401 | 未认证或 Token 格式错误 | 检查 Token 是否以 `t00_sk_` 开头 |
| `API token not found` / `has been revoked` / `has expired` / `Invalid API token` | 401 | Token 失效 | 到 `/admin/tokens` 重新签发 |
| `Missing required permission: xxx` | 403 | 权限不足 | 提示用户在 `/admin/tokens` 为该 Token 添加该权限 |
| `Required fields: xxx` | 400 | 缺少必填参数 | 补全参数后重试 |
| `Settings object is required` | 400 | PUT /site-settings 缺 `settings` 体 | 补全请求体 |
| `Name and URL are required` | 400 | 友链缺 name/url | 补全 |
| `Name and path are required` | 400 | 导航缺 name/path | 补全 |
| `File type xxx is not allowed` | 400 | 静态页扩展名不在白名单 | 检查扩展名白名单 |
| `File too large. Max 10MB` | 400 | 静态页文件超限 | 单文件 ≤10MB |
| `Folder already exists` | 409 | 静态页文件夹已存在 | 换名或先删除 |
| `Section with this slug already exists` | 409 | 导航板块 slug 冲突 | 换 slug |
| `Cannot update/delete users` | 403 | 尝试操作他人/高权用户 | 用 superadmin Token 操作 |
| `Database write failed` | 500 | 数据库异常 | 检查 detail，稍后重试 |

---

## 权限矩阵（access token 实现权限隔离）

> 本地预览中创建 Token：`http://localhost:8081/admin/tokens`；生产：`https://www.token00.com/admin/tokens`。

| 权限 | 资源 | 读端点 (GET) | 写端点 | 默认角色可签发 |
|---|---|---|---|---|
| `settings:write` | 系统设置 | `/site-settings`、`/site-settings/keys/{...}` | `PUT /site-settings` | admin / superadmin |
| `friendlinks:write` | 友链 | `/friend-links` | `POST` / `PUT` / `DELETE` / `PATCH /:id/reorder` | admin / superadmin |
| `sections:write` | 顶部导航 | `/sections`、`/sections/:id`、`/sections/:id/categories` | `POST` / `PUT` / `PATCH /:id/reorder` / `DELETE` | admin / superadmin |
| `categories:write` | 分类 | `/categories`（公开）、`/categories/:id` | `POST` / `PUT` / `DELETE` | admin / superadmin |
| `users:write` | 用户管理 | — | `POST` / `PUT` / `PATCH /:id/reset-password` / `DELETE` | **仅 superadmin** |
| `stats:read` | 数据统计 | `GET /stats` | — | admin / superadmin |
| `logs:read` | 日志 | `GET /logs/api`、`GET /logs/system` | — | admin / superadmin |
| `backup:write` | 备份/还原 | `GET /backup`、`/backup/settings`、`/backup/:id/download` | `PUT /backup/settings`、`POST /backup`、`POST /backup/restore`、`POST /backup/:id/restore`、`DELETE /backup/:id` | admin / superadmin |
| `reviews:write` | 内容审核 | `GET /admin/reviews`、`/pending`、`/stats` | `POST /admin/reviews/:id/approve\|reject\|retry` | admin / superadmin |
| `keywords:write` | 敏感词 | `GET /admin/sensitive-keywords` | `POST` / `PUT` / `DELETE /:id` / `POST /batch` | admin / superadmin |
| `ads:write` | 广告 | `GET /admin/ads`、`/pending`、`/:id` | `POST` / `:id/approve` / `:id/reject` / `:id/toggle` | admin / superadmin |
| `statichtml:read` | 静态页面 | `GET /statichtml/tree`、`GET /statichtml/list` | — | admin / superadmin |
| `statichtml:write` | 静态页面 | — | `POST`/`DELETE`/`PATCH /statichtml/folder`、`POST`/`PUT`/`DELETE`/`PATCH /statichtml/file` | admin / superadmin |

> **角色可签发的权限**：`superadmin` 全部（含 `users:write`）；`admin` 除 `users:write` 外全部；`user` 仅 `article:write`、`media:upload`（见 `ai-publish-api.md`）。

---

## 接口详情

### 1. 系统设置 site-settings

`GET /api/v1/site-settings` — 获取全部设置 KV 数组（公开，无需 Token）
`GET /api/v1/site-settings/keys/site_name,default_theme` — 仅获取指定 key
`PUT /api/v1/site-settings` — 批量更新设置（需 `settings:write`）

**PUT 请求体（两种形式均支持）：**

```json
// 形式 A：对象（前端/脚本常用）
{
  "settings": {
    "site_name": "新站点名称",
    "default_theme": "cyber",
    "home_banner_enabled": "true"
  }
}
// 形式 B：数组（API 契约原始形态）
[
  { "key": "site_name", "value": "新站点名称" },
  { "key": "default_theme", "value": "cyber" }
]
```

**规则：**
- `value` **一律为字符串**。JSON 结构类设置（如 `hero_cta_buttons`、`home_banner_cta`、`footer_nav`、`share_config`）请传入 **JSON 文本字符串**（先 `JSON.stringify` 再传）。
- 非字符串 value 服务端自动 JSON 序列化。
- 修改后自动 `revalidatePath('/')`，首页 ISR 缓存约 60s 内生效；修改 `review_*` 前缀会重新加载内容审核 provider。

#### 设置项完整契约（Settings Schema）

所有 KV 设置存于 `site_settings` 表（`key` TEXT + `value` TEXT），`value` **一律为字符串**；JSON 结构类设置请传入 JSON 文本（脚本原样存储）。

**① 基础设置（basic）— `settings:write`**

| key | 类型 | 说明 / 取值 |
|-----|------|------------|
| `site_name` | text | 站点名称，如 `TokenPress` |
| `site_description` | text | 站点描述（写入 `<meta description>` 与标题） |
| `header_logo` | url | 页头 logo 图片 URL，空则用默认 SVG |
| `footer_logo` | url | 页脚 logo 图片 URL |

**② UI 设置（ui）— `settings:write`**

| key | 类型 | 取值 |
|-----|------|------|
| `default_theme` | enum | `night` / `cyber` / `lava` / `light` / `space` |
| `frontend_locale` | enum | `zh` / `en` |
| `backend_locale` | enum | `zh` / `en` |
| `content_max_width` | text | CSS max-width，预设 `80rem`/`96rem`/`120rem`/`100%`，或 `数字px` |

**③ Logo 设置（logo）— `settings:write`**

复用 `header_logo` / `footer_logo`（见 ①）。

**④ 首页 · Hero（hero）— `settings:write`**

| key | 类型 | 说明 |
|-----|------|------|
| `hero_slides` | json(数组) | `[{"id":"1","imageUrl":"/uploads/x.svg","linkUrl":"/token-plan","linkTarget":"_self"}]` |
| `hero_size` | enum | `default` / `fullscreen` / `wide` |
| `hero_carousel_use_articles` | bool | `true`/`false`（用文章封面做轮播） |
| `hero_carousel_article_source` | text | 文章来源标识（如 `latest`） |
| `hero_carousel_max_items` | int | 轮播最大条数，如 `5` |
| `hero_carousel_interval` | int | 自动切换间隔（秒），如 `5` |
| `hero_cta_buttons` | json(数组) | `[{"label":"Token 套餐","href":"/token-plan","target":"_self","variant":"primary"}]`（`variant`: `primary`/`secondary`/`ghost`） |

> `hero_effect` 为历史遗留未接线项，写入无效，不建议设置。

**⑤ 首页 · Banner（banner）— `settings:write`**

统一由 `HomeBanner` 组件消费。

| key | 类型 | 结构 / 取值 |
|-----|------|------------|
| `home_banner_enabled` | bool | 总开关 `true`/`false` |
| `home_banner_type` | enum | `cta` / `cards` / `image` / `notice` |
| `home_banner_position` | enum | `after_hero` / `after_articles` |
| `home_banner_cta` | json(对象) | `{"title":"","subtitle":"","buttonText":"","buttonLink":"","buttonTarget":"_self","bgImage":"","gradient":"","align":"center"}`（`align`: `left`/`center`） |
| `home_banner_cards` | json(数组) | `[{"icon":"📝","title":"","desc":"","link":"","target":"_self"}]`（最多 4 张） |
| `home_banner_image` | json(对象) | `{"url":"","link":"","target":"_self","alt":""}` |
| `home_banner_notice` | json(对象) | `{"text":"","link":"","target":"_self","marquee":false}` |

**⑥ 导航设置（nav，实为页脚导航）— `settings:write`**

| key | 类型 | 结构 |
|-----|------|------|
| `footer_nav` | json(数组,分组式) | `[{"title":"技术内容","links":[{"name":"Token 计划","url":"/token-plan"}]}, {"title":"关于","html":"<p>...</p>"}]` |
| `footer_nav_columns` | int | 网格列数 `1`–`6`，默认 `4` |

> 顶部主导航来自 `sections` 表（见下方「顶部导航」接口），非本 KV。

**⑦ 链接设置（links）— `settings:write`**

| key | 类型 | 说明 |
|-----|------|------|
| `friend_links_columns` | int | 友链编辑网格列数（仅后台用；公开页经 `/friend-links` 接口读 `friend_links` 表） |

**⑧ 页脚设置（footer）— `settings:write`**

| key | 类型 | 说明 |
|-----|------|------|
| `copyright_text` | text | 版权信息，如 `© 2026 TokenPress. All rights reserved.` |
| `icp_number` | text | ICP 备案号 |
| `icp_url` | url | 备案查询链接，默认 `https://beian.miit.gov.cn/` |
| `powered_by` | text | 技术支持署名 |

**⑨ 备份（backup）— `settings:write`**

| key | 类型 | 默认 |
|-----|------|------|
| `backup_auto_enabled` | bool | `false` |
| `backup_interval_hours` | int | `24` |
| `backup_retention_days` | int | `30` |
| `backup_include_uploads` | bool | `true` |

**⑩ 分析（analytics）— `settings:write`**

| key | 类型 | 说明 |
|-----|------|------|
| `analytics_code` | text | `<script>` 统计代码片段（仅 `<script>` 标签会被注入，防 XSS） |

**⑪ 安全（security）— `settings:write`**

| key | 类型 | 取值 |
|-----|------|------|
| `anti_scraping_enabled` | bool | 默认 `true`（UA 黑名单拦截） |
| `content_review_enabled` | bool | `false`（发布前是否走内容审核） |
| `review_cloud_provider` | enum | `none` / `tencent` / `aliyun` / `baidu` / `builtin` |
| `review_tencent_secret_id` | text | 腾讯云密钥 ID |
| `review_tencent_secret_key` | text | 腾讯云密钥 Key |
| `review_tencent_region` | text | 如 `ap-guangzhou` |
| `review_aliyun_access_key_id` | text | 阿里云 |
| `review_aliyun_access_key_secret` | text | 阿里云 |
| `review_aliyun_region` | text | 如 `cn-shanghai` |
| `review_baidu_app_id` | text | 百度 |
| `review_baidu_api_key` | text | 百度 |
| `review_baidu_secret_key` | text | 百度 |
| `review_builtin_ai_api_url` | text | 内置 AI 审核地址 |
| `review_builtin_ai_api_key` | text | 内置 AI 审核 Key |

> 任何 `review_*` key 变更会自动重新加载审核 provider 配置。

**⑫ 文章分享（share）— `settings:write`**

| key | 类型 | 结构 |
|-----|------|------|
| `share_config` | json(对象) | `{"enabled":true,"platforms":["wechat","moments"],"positions":["article_top"],"likeEnabled":true,"likePositions":["article_top"]}` |

**读取/修改示例：**

```jsonc
// 读取全部设置
GET /api/v1/site-settings
// → { "success": true, "data": { "site_name": "TokenPress", "default_theme": "night", ... } }

// 修改设置（对象形式）
PUT /api/v1/site-settings
{
  "settings": {
    "site_name": "TokenPress",
    "default_theme": "cyber",
    "home_banner_enabled": "true",
    "home_banner_cta": "{\"title\":\"欢迎\",\"buttonText\":\"逛博客\",\"buttonLink\":\"/blog\",\"buttonTarget\":\"_self\",\"align\":\"center\"}"
  }
}
// → { "success": true, "data": { "site_name": "TokenPress", "default_theme": "cyber", "...": "..." } }
```

---

### 2. 友链 friend-links

`GET /api/v1/friend-links` — 列表（公开）
`POST /api/v1/friend-links` — 新增（需 `friendlinks:write`）
`PUT /api/v1/friend-links/:id` — 部分更新
`DELETE /api/v1/friend-links/:id` — 删除
`PATCH /api/v1/friend-links/:id/reorder` — 排序 `{ orderedIds: number[] }`

**新增请求体：**

```json
{ "name": "示例站", "url": "https://example.com", "description": "朋友站", "sortOrder": 0, "isActive": true }
```

**错误响应：** `400 {"success":false,"error":"Name and URL are required"}`

---

### 3. 顶部导航 sections

`GET /api/v1/sections` — 列表（公开）
`GET /api/v1/sections/:id` — 单条
`GET /api/v1/sections/:id/categories` — 该板块下分类
`POST /api/v1/sections` — 新增（需 `sections:write`）
`PUT /api/v1/sections/:id` — 更新
`PATCH /api/v1/sections/:id/reorder` — 排序 `{ orderedIds: number[] }`
`DELETE /api/v1/sections/:id` — 删除

**新增请求体：**

```json
{ "name": "新板块", "path": "/new", "slug": "new", "description": "描述", "externalUrl": "", "sortOrder": 0, "isActive": true }
```

- `path` 会自动补前缀 `/`；`slug` 缺省由 name 生成。
- `externalUrl` 非空时，`path` 可重复（外链板块，如指向 `/statichtml/...` 静态页）。
- **错误响应：** `400 {"success":false,"error":"Name and path are required"}`；`409 {"success":false,"error":"Section with this slug already exists"}`

---

### 4. 分类 categories

`GET /api/v1/categories` — 列表（公开，`?section=slug` 过滤）
`GET /api/v1/categories/:id` — 单条
`POST /api/v1/categories` — 新增（需 `categories:write`）
`PUT /api/v1/categories/:id` — 更新
`DELETE /api/v1/categories/:id` — 删除

> **远程（AI Token）路径：** 发布流程内创建/修改分类走 `POST /api/v1/ai/categories` 与 `PUT /api/v1/ai/categories/:id`（`article:write` 隐含分类管理，字段受限），详见 `docs/ai-publish-api.md`「远程创建/修改分类」。

**新增请求体：**

```json
{ "name": "AI作品", "sectionId": 2, "slug": "ai-works", "description": "", "sortOrder": 0 }
```

---

### 5. 用户 users（需 `users:write`，仅 superadmin 签发）

> 以下写接口需持有 `users:write` 权限的 Token（该权限仅 superadmin 可签发）。

`POST /api/v1/users` — 创建
`PUT /api/v1/users/:id` — 更新
`PATCH /api/v1/users/:id/reset-password` — 重置密码（返回新随机密码）
`DELETE /api/v1/users/:id` — 删除

**创建请求体：**

```json
{ "username": "newuser", "password": "StrongPass123", "displayName": "新用户", "role": "user" }
```

- Token 合成身份为 `admin`，**无法创建 `admin` / `superadmin`**（防止权限提升）；`role` 仅可取 `user`。
- 重置密码响应返回新随机密码，需妥善转交用户。

---

### 6. 备份 backup（需 `backup:write`）

`GET /api/v1/backup/settings` — 备份设置 `{ autoBackup, intervalHours, retentionDays, includeUploads }`
`PUT /api/v1/backup/settings` — 修改同上（改后重启定时任务）
`POST /api/v1/backup` — 手动备份 `{ includeUploads?: boolean }`
`GET /api/v1/backup` — 备份列表
`POST /api/v1/backup/:id/restore` — 从已有备份还原
`POST /api/v1/backup/restore` — 上传还原 `{ fileData(base64), filename }`
`GET /api/v1/backup/:id/download` — 下载备份
`DELETE /api/v1/backup/:id` — 删除备份

> 备份/还原为高危操作，需持有 `backup:write` 权限的 Token。

---

### 7. 广告 admin/ads（需 `ads:write`）

`GET /api/v1/admin/ads` / `/pending` / `/:id`
`POST /api/v1/admin/ads` — 创建（进入审核）`{ position, title, code, targetSections?, targetCategories?, ... }`
`POST /api/v1/admin/ads/:id/approve` — 通过
`POST /api/v1/admin/ads/:id/reject` — 拒绝 `{ note? }`
`POST /api/v1/admin/ads/:id/toggle` — 启停 `{ isActive }`

---

### 8. 敏感词 admin/sensitive-keywords（需 `keywords:write`）

`GET /api/v1/admin/sensitive-keywords`
`POST /api/v1/admin/sensitive-keywords` — `{ keyword, category?, severity?, action?, scope? }`
`PUT /api/v1/admin/sensitive-keywords/:id`
`DELETE /api/v1/admin/sensitive-keywords/:id`
`POST /api/v1/admin/sensitive-keywords/batch` — `{ keywords: [{ keyword, ... }] }`

---

### 9. 内容审核 admin/reviews（需 `reviews:write`）

`GET /api/v1/admin/reviews` / `/pending` / `/stats`
`POST /api/v1/admin/reviews/:id/approve` — `{ note? }`
`POST /api/v1/admin/reviews/:id/reject` — `{ note? }`
`POST /api/v1/admin/reviews/:id/retry`

---

### 10. 统计 stats（需 `stats:read`）

`GET /api/v1/stats` →

```json
{
  "success": true,
  "data": {
    "overview": { "...": "..." },
    "topEndpoints": [ { "path": "...", "count": 0 } ],
    "recentLogs": [ { "...": "..." } ],
    "dailyCalls": [ { "date": "2026-07-12", "count": 0 } ],
    "articlesBySection": [ { "section": "...", "count": 0 } ]
  }
}
```

---

### 11. 日志 logs（需 `logs:read`）

`GET /api/v1/logs/api` — API 调用日志（支持 `page` / `limit` / 过滤参数）
`GET /api/v1/logs/system` — 系统事件日志

---

### 12. 静态页面 statichtml（需 `statichtml:read` / `statichtml:write`）

文件存于后端 `data/statichtml/`，由 `express.static('/statichtml')` 经 nginx 直访：`{site_url}/statichtml/<relpath>`（如 `/statichtml/item1/test1.html`）。可作板块 `externalUrl` / Hero slide `linkUrl` / Hero CTA `href` 的跳转目标。

`GET /api/v1/statichtml/tree`（`statichtml:read`）— 树形（folders+files 含 `relPath`/`url`/`size`/`ext`/`mtime`）
`GET /api/v1/statichtml/list`（`statichtml:read`）— 扁平文件列表（选择器用，字段 `relPath`/`url`/`name`/`ext`）
`POST /api/v1/statichtml/folder`（`statichtml:write`）— `{ path: "item1" }`（支持多级 `item1/sub`，已存在返回 409）
`DELETE /api/v1/statichtml/folder`（`statichtml:write`）— `{ path: "item1" }` 递归删文件夹
`PATCH /api/v1/statichtml/folder`（`statichtml:write`）— `{ path: "item1", newName: "item2" }` 重命名文件夹（仅改最后一级，已存在 409）
`POST /api/v1/statichtml/file`（`statichtml:write`）— `{ folder?, filename, content? | file?(base64), mimeType? }`
- 文本类（html/css/js/json/svg/txt/md/xml…）传 `content` 字符串；二进制（图片/字体/pdf）传 `file` base64。
- 扩展名白名单校验（非白名单 400），10MB 上限（超限 400）；`folder` 缺省存根目录。
- 返回 `{ relPath, url, size }`。

`PUT /api/v1/statichtml/file`（`statichtml:write`）— `{ relPath, content? | file?, mimeType? }` 替换已有文件内容
`DELETE /api/v1/statichtml/file`（`statichtml:write`）— `{ relPath }`
`PATCH /api/v1/statichtml/file`（`statichtml:write`）— `{ relPath: "item1/test1.html", newName: "new.html" }` 重命名文件（仅改文件名，扩展名受白名单约束，非法 400）

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

## 客户端校验规则（token00-settings 脚本内置）

- **enum**：非法值直接拒绝并提示可取值（如 `default_theme` ∉ 枚举）。
- **bool**：接受 `true/false/1/0/yes/no/on/off`。
- **int**：非整数拒绝。
- **json**：`json.loads` 失败拒绝。
- **unknown key**：仍尝试写入，仅打印 warning（便于未来扩展）。

---

## 使用示例（Python）

```python
import urllib.request, json

TOKEN = "t00_sk_xxxxx"   # 从后台 /admin/tokens 创建，按所需权限勾选
BASE = "https://www.token00.com/api/v1"   # 本地预览用 http://localhost:8081/api/v1

def call(method, path, body=None):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

# 读取全部设置
print(call("GET", "/site-settings"))

# 修改单个设置（value 一律为字符串；JSON 结构传 JSON 文本）
call("PUT", "/site-settings", {"settings": {"default_theme": "cyber"}})

# 新增友链
call("POST", "/friend-links", {"name": "示例", "url": "https://example.com"})

# 新增顶部导航板块
call("POST", "/sections", {"name": "新板块", "path": "/new"})

# 上传静态页
call("POST", "/statichtml/file", {
    "folder": "item1", "filename": "test1.html",
    "content": "<h1>Hello Static</h1>", "mimeType": "text/html"
})
```

---

## 安全说明

- 所有写接口均以 API Token（指定权限）鉴权。
- Token 命中时注入合成 admin 身份并记录 API 用量日志（`api_logs`），便于审计。
- 备份/还原为高危操作，需持有 `backup:write` 权限的 Token。
- 客户端在写入时对已知枚举/JSON 结构做基础校验，避免脏数据写入（见上方「客户端校验规则」）。

## 最佳实践（Agent 版）

1. **最小权限（核心）**：在 `/admin/tokens` 为每个 Agent 单独建 Token、只给最小权限。内容机器人只给 `article:write`，绝不给 `settings:write`；配置机器人给 `settings:write` 但不给 `sections:write`；看板只给 `stats:read`。
2. **改前备份**：改重要设置前先 `GET /site-settings` 导出当前值；改备份策略前先读 `/backup/settings`。
3. **缓存生效**：首页 ISR 缓存约 60s，改完设置最多等约 1 分钟或强刷才能看到效果。
4. **静态页 URL 可预测**：`statichtml` 上传文件名即 URL 文件名（无随机后缀），可作导航/CTA 固定跳转目标。
5. **用户操作需 superadmin**：`users:write` 仅 superadmin 可签发；创建用户 `role` 只能取 `user`。
6. **value 一律字符串**：KV 表的 value 是字符串；JSON 结构设置请直接传 JSON 文本（脚本原样存储）。
7. **未知 key 谨慎**：`PUT /site-settings` 会原样 upsert 任意 key，仅做 JSON 合法性提示；写入未知 key 前先确认命名。

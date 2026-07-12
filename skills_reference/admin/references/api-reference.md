# Token00 远程后台管理 — API 契约

基础：`{api_base}/api/v1`，鉴权头 `Authorization: Bearer t00_sk_xxx`。
成功响应统一 `{ success: true, data: ... }`；失败 `{ success: false, error: "..." }`。

## 1. 系统设置 site-settings
- `GET /site-settings` → 全部设置 KV 数组
- `GET /site-settings/keys/site_name,default_theme` → 指定 key
- `PUT /site-settings`
  - 单条：`{ "key": "site_name", "value": "新站名" }`（value 为字符串；JSON 结构请先 `JSON.stringify` 后再传字符串，或客户端传对象由脚本处理）
  - 批量：`[ { "key": "...", "value": "..." }, ... ]`
- 常用 key：site_name / site_description / header_logo / footer_logo / default_theme(night|cyber|lava|light|space) / frontend_locale / backend_locale / content_max_width / hero_slides(JSON) / hero_size(sm|md|lg) / hero_cta_buttons(JSON) / home_banner_enabled / home_banner_type(cta|cards|image|notice) / home_banner_position(hero_bottom|article_list_bottom) / home_banner_cta(JSON) / home_banner_cards(JSON) / home_banner_image(JSON) / home_banner_notice(JSON) / footer_nav(JSON) / footer_nav_columns / copyright_text / icp_number / icp_url / powered_by / analytics_code / anti_scraping_enabled / content_review_enabled / share_config(JSON) / backup_auto_enabled / backup_interval_hours / backup_retention_days / backup_include_uploads

## 2. 友链 friend-links
- `GET /friend-links` → 列表
- `POST /friend-links` → `{ name, url, description? }`
- `PUT /friend-links/:id` → 部分字段
- `DELETE /friend-links/:id`
- `PATCH /friend-links/:id/reorder` → `{ orderedIds: number[] }`

## 3. 顶部导航 sections
- `GET /sections`
- `POST /sections` → `{ name, path, slug?, isActive?, sortOrder?, icon? }`
- `PUT /sections/:id`
- `PATCH /sections/:id/reorder` → `{ orderedIds: number[] }`
- `DELETE /sections/:id`

## 4. 分类 categories
- `GET /categories`（公开，?section=slug 过滤）
- `POST /categories` → `{ name, sectionId, slug?, description?, sortOrder? }`
- `PUT /categories/:id`
- `DELETE /categories/:id`

## 5. 用户 users（需 users:write，仅 superadmin 签发）
- `POST /users` → `{ username, password, displayName?, role? }`（token 合成身份为 admin，无法创建 admin/superadmin）
- `PUT /users/:id` → `{ displayName?, role?, isActive? }`
- `PATCH /users/:id/reset-password` → 返回新随机密码
- `DELETE /users/:id`

## 6. 备份 backup（需 backup:write）
- `GET /backup/settings` → `{ autoBackup, intervalHours, retentionDays, includeUploads }`
- `PUT /backup/settings` → 同上字段（改后重启定时任务）
- `POST /backup` → `{ includeUploads? }` 手动备份
- `GET /backup` → 备份列表
- `POST /backup/:id/restore` → 从已有备份还原
- `POST /backup/restore` → `{ fileData(base64), filename }` 上传还原
- `DELETE /backup/:id`

## 7. 广告 admin/ads（需 ads:write）
- `GET /admin/ads` `GET /admin/ads/pending` `GET /admin/ads/:id`
- `POST /admin/ads` → `{ position, title, code, targetSections?, targetCategories?, ... }` 创建后进入审核
- `POST /admin/ads/:id/approve` `POST /admin/ads/:id/reject`(`{note?}`) `POST /admin/ads/:id/toggle`(`{isActive}`)
- `POST /admin/ads/tick` → 仅 superadmin JWT

## 8. 敏感词 admin/sensitive-keywords（需 keywords:write）
- `GET /admin/sensitive-keywords`
- `POST /admin/sensitive-keywords` → `{ keyword, category?, severity?, action?, scope? }`
- `PUT /admin/sensitive-keywords/:id`
- `DELETE /admin/sensitive-keywords/:id`
- `POST /admin/sensitive-keywords/batch` → `{ keywords: [{keyword, ...}] }`

## 9. 内容审核 admin/reviews（需 reviews:write）
- `GET /admin/reviews` `GET /admin/reviews/pending` `GET /admin/reviews/stats`
- `POST /admin/reviews/:id/approve`(`{note?}`) `POST /admin/reviews/:id/reject`(`{note?}`) `POST /admin/reviews/:id/retry`

## 10. 统计 stats（需 stats:read）
- `GET /stats` → `{ overview, topEndpoints, recentLogs, dailyCalls, articlesBySection }`

## 11. 日志 logs（需 logs:read）
- `GET /logs/api` `GET /logs/system`（支持 page/limit/过滤参数）
- `/logs/audit`、`/logs/login` 仅 JWT 用户自阅，不开放 token

## 12. 静态页面 statichtml（需 statichtml:read / statichtml:write）
文件存于后端 `data/statichtml/`，由 `express.static('/statichtml')` 经 nginx 直访：`{site_url}/statichtml/<relpath>`（如 `/statichtml/item1/test1.html`）。可作板块 externalUrl / Hero slide linkUrl / Hero CTA href 的跳转目标。
- `GET /statichtml/tree`（statichtml:read）→ 树形（folders+files 含 relPath/url/size/ext/mtime）
- `GET /statichtml/list`（statichtml:read）→ 扁平文件列表（选择器用，字段 relPath/url/name/ext）
- `POST /statichtml/folder` → `{ path: "item1" }`（支持多级 `item1/sub`）建文件夹，已存在 409
- `DELETE /statichtml/folder` → `{ path: "item1" }` 递归删文件夹
- `POST /statichtml/file` → `{ folder?, filename, content?|file?(base64), mimeType? }`
  - 文本类（html/css/js/json/svg/txt/md/xml...）传 `content` 字符串；二进制（图片/字体/pdf）传 `file` base64
  - 扩展名白名单校验（非白名单 400），10MB 上限（超限 400）；`folder` 缺省存根目录
  - 返回 `{ relPath, url, size }`
- `PUT /statichtml/file` → `{ relPath, content?|file?, mimeType? }` 替换已有文件内容
- `DELETE /statichtml/file` → `{ relPath }`
- 安全：路径解析严格限制在 `data/statichtml` 内（防 `../` 穿越）；`filename` 只保留原名与扩展名（不追加随机后缀，保证 URL 可预测）


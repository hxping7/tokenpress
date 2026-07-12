# Token00 远程后台管理 — 权限矩阵与端点映射

所有写接口采用「API Token（指定权限） 或 JWT 管理员会话」二选一鉴权。
Token 鉴权头：`Authorization: Bearer t00_sk_xxxxxxxx`。
权限缺失 → 403 `Missing required permission: <perm>`；Token 无效/过期/吊销 → 401。

## 权限 → 端点 总表

| 权限 | 资源 | 读端点 (GET) | 写端点 | 备注 |
|---|---|---|---|---|
| `settings:write` | 系统设置 | `/api/v1/site-settings`<br>`/api/v1/site-settings/keys/{a,b,c}` | `PUT /api/v1/site-settings`（单条或数组） | 覆盖基础/UI/Logo/Hero/Banner/页脚导航/页脚/分析/安全/备份设置/分享等 KV |
| `friendlinks:write` | 友链 | `/api/v1/friend-links` | `POST /api/v1/friend-links`<br>`PUT /api/v1/friend-links/:id`<br>`DELETE /api/v1/friend-links/:id`<br>`PATCH /api/v1/friend-links/:id/reorder` | |
| `sections:write` | 顶部导航 | `/api/v1/sections`<br>`/api/v1/sections/:id`<br>`/api/v1/sections/:id/categories` | `POST /api/v1/sections`<br>`PUT /api/v1/sections/:id`<br>`PATCH /api/v1/sections/:id/reorder`<br>`DELETE /api/v1/sections/:id` | |
| `categories:write` | 分类 | `/api/v1/categories`（公开）<br>`/api/v1/categories/:id`（公开） | `POST /api/v1/categories`<br>`PUT /api/v1/categories/:id`<br>`DELETE /api/v1/categories/:id` | |
| `users:write` | 用户管理 | `GET /api/v1/users`（JWT 自管，token 不可用） | `POST /api/v1/users`<br>`PUT /api/v1/users/:id`<br>`PATCH /api/v1/users/:id/reset-password`<br>`DELETE /api/v1/users/:id` | **仅限 superadmin 角色签发的 Token** |
| `stats:read` | 数据统计 | `GET /api/v1/stats` | — | 只读 |
| `logs:read` | 日志 | `GET /api/v1/logs/api`<br>`GET /api/v1/logs/system` | — | `/logs/audit`、`/logs/login` 仍仅 JWT（用户自阅），不开放 token |
| `backup:write` | 备份/还原 | `GET /api/v1/backup`<br>`GET /api/v1/backup/settings`<br>`GET /api/v1/backup/:id/download` | `PUT /api/v1/backup/settings`<br>`POST /api/v1/backup`<br>`POST /api/v1/backup/restore`<br>`POST /api/v1/backup/:id/restore`<br>`DELETE /api/v1/backup/:id` | JWT 回退为 superAdminOnly |
| `reviews:write` | 内容审核 | `GET /api/v1/admin/reviews`<br>`/pending`<br>`/stats` | `POST /api/v1/admin/reviews/:id/approve\|reject\|retry` | |
| `keywords:write` | 敏感词 | `GET /api/v1/admin/sensitive-keywords` | `POST /`<br>`PUT /:id`<br>`DELETE /:id`<br>`POST /batch` | |
| `ads:write` | 广告 | `GET /api/v1/admin/ads`<br>`/pending`<br>`/:id` | `POST /`<br>`/:id/approve`<br>`/:id/reject`<br>`/:id/toggle` | `POST /tick` 仅 superadmin JWT，token 不可触发 |
| `statichtml:read` | 静态页面 | `GET /api/v1/statichtml/tree`（树形）<br>`GET /api/v1/statichtml/list`（扁平，供选择器） | — | 只读 |
| `statichtml:write` | 静态页面 | — | `POST /api/v1/statichtml/folder`（建/删文件夹）<br>`DELETE /api/v1/statichtml/folder`<br>`POST /api/v1/statichtml/file`（上传/建）<br>`PUT /api/v1/statichtml/file`（替换）<br>`DELETE /api/v1/statichtml/file` | 文件存 `data/statichtml/`，由 `express.static('/statichtml')` 经 nginx 直访 `/statichtml/<path>`；扩展名白名单 + 10MB 上限 + 路径穿越防护 |

## 角色可签发的权限（tokens 创建接口约束）
- `superadmin`：全部（含 `users:write`）
- `admin`：除 `users:write` 外的全部
- `user`：仅 `article:write`、`media:upload`（文章发布/媒体上传，见 token00-publisher）

## 刻意不开放 token 控制的接口
- `POST/PUT/PATCH/DELETE /api/v1/tokens`：API Token 自身管理，保持 JWT 会话，避免权限提升闭环。
- `GET /api/v1/users`、`POST /api/v1/users/me/change-password`：用户自管理，保持 JWT。
- `admin/articles` 管理端点：文章内容发布已由 `ai-publish` 的 `article:write` / `content:delete` 覆盖，保持 JWT。
- `media` 用户自管端点：媒体上传已由 `media:upload` 覆盖，保持 JWT。

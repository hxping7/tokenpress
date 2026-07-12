---
name: token00-admin
version: 1.0.0
description: 通过 API Token 远程控制 Token00 网站（www.token00.com）的全站后台设置与管理项——系统设置、友链、导航、分类、用户、备份、广告、敏感词、内容审核、统计、日志、静态页面（statichtml）。与 token00-publisher（文章发布）分工，本技能覆盖除文章内容发布外的所有后台可配置项，按 access token 权限隔离。
---

# Token00 远程后台管理技能（token00-admin）

## 何时使用
当用户要求「远程 / 用 token / 通过 API 控制 Token00 的设置、配置、后台管理项」时触发，例如：
- 修改站点名称、Logo、主题、首页 Hero / 中部 Banner、页脚、分析代码、安全设置等
- 增删改友链、顶部导航、分类
- 查看/创建备份、还原备份
- 管理广告、敏感词、内容审核
- 查看统计、API 日志、系统事件
- 远程创建/编辑/删除用户（需 users:write 权限）

文章发布/删除/置顶走 **token00-publisher** 技能（article:write / content:delete），本技能不覆盖。

## 配置
复用 token00 系列统一的配置文件 `.token00.conf`（位于项目根目录或 `~/.workbuddy/`），内容：
```ini
api_base=https://www.token00.com
token=t00_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
`token` 为持有相应权限的 API Token。不同权限控制不同接口（见下方权限矩阵）。

## 权限矩阵（access token 实现权限隔离）
| 权限 | 可控制的接口 | 默认角色可签发 |
|---|---|---|
| `settings:write` | 全站系统设置 site-settings | admin / superadmin |
| `friendlinks:write` | 友链 friend-links | admin / superadmin |
| `sections:write` | 顶部导航 sections | admin / superadmin |
| `categories:write` | 分类 categories | admin / superadmin |
| `users:write` | 用户管理（创建/编辑/重置密码/删除） | 仅 superadmin |
| `stats:read` | 数据统计 stats | admin / superadmin |
| `logs:read` | API 日志 / 系统事件 logs | admin / superadmin |
| `backup:write` | 备份设置/创建/还原/删除 backup | admin / superadmin |
| `reviews:write` | 内容审核（通过/拒绝/重试） | admin / superadmin |
| `keywords:write` | 敏感词库 | admin / superadmin |
| `ads:write` / `ads:read` / `ads:delete` | 广告管理 | admin / superadmin |

> 文章发布相关：`article:write`、`content:delete`、`media:upload` 见 token00-publisher。
> `tokens` 自身管理保持 JWT 管理员会话（不开放 token 自管，避免权限提升）。

## 使用方式
脚本：`scripts/admin.py`（Python 标准库实现，无需第三方依赖）

```bash
python admin.py settings get-all
python admin.py settings set --key site_name --value "新站名"
python admin.py settings set --key home_banner_cta --json '{"enabled":true,"type":"cta","cta":{"title":"逛博客","link":"/blog"}}'
python admin.py friend-links list
python admin.py friend-links create --name "示例" --url "https://example.com" --description "朋友站"
python admin.py sections list
python admin.py categories create --name "AI作品" --section-id 2
python admin.py backup settings
python admin.py backup create
python admin.py ads list
python admin.py raw --method GET --path /api/v1/stats
```

## 端点与权限速查
| 资源 | 读 | 写 | 权限 |
|---|---|---|---|
| site-settings | GET /api/v1/site-settings | PUT /api/v1/site-settings | settings:write（PUT） |
| friend-links | GET /api/v1/friend-links | POST/PUT/DELETE/PATCH /api/v1/friend-links(/:id) | friendlinks:write |
| sections | GET /api/v1/sections | POST/PUT/PATCH/DELETE /api/v1/sections(/:id) | sections:write |
| categories | GET /api/v1/categories | POST/PUT/DELETE /api/v1/categories(/:id) | categories:write |
| users | GET /（JWT 自管） | POST/PUT/PATCH/DELETE /api/v1/users(/:id) | users:write |
| stats | GET /api/v1/stats | — | stats:read |
| logs | GET /api/v1/logs/api、/system | — | logs:read |
| backup | GET /api/v1/backup、/settings | PUT /settings、POST /、POST /restore、/:id/restore、DELETE /:id | backup:write |
| reviews | GET /api/v1/admin/reviews | POST /:id/approve\|reject\|retry | reviews:write |
| keywords | GET /api/v1/admin/sensitive-keywords | POST/PUT/DELETE/batch | keywords:write |
| ads | GET /api/v1/admin/ads | POST/approve/reject/toggle | ads:write |

详见 `references/permissions.md` 与 `references/api-reference.md`。

## 安全说明
- 所有写接口同时接受「API Token（指定权限）」或「JWT 管理员会话」，二选一。
- Token 命中时注入合成 admin 身份并记录 API 用量日志（api_logs），便于审计。
- 备份/还原为高危操作，仅 superadmin 可通过 JWT 直接访问；Token 需持有 `backup:write`。
- 客户端在 `settings set` 时对已知枚举/JSON 结构做基础校验，避免脏数据写入。

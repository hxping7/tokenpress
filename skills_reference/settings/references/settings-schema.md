# Token00 设置项契约（Settings Schema）

本文件是 agent 通过 `token00-settings` 技能远程控制设置时必须对照的「key 契约」。
所有 KV 设置存于 `site_settings` 表（`key` TEXT + `value` TEXT），`value` **一律为字符串**；
JSON 结构类设置请传入 JSON 文本（脚本原样存储）。

---

## 1. 基础设置（basic）— 权限 `settings:write`

| key | 类型 | 说明 / 取值 |
|-----|------|------------|
| `site_name` | text | 站点名称，如 `TokenPress` |
| `site_description` | text | 站点描述（写入 `<meta description>` 与标题） |
| `header_logo` | url | 页头 logo 图片 URL，空则用默认 SVG |
| `footer_logo` | url | 页脚 logo 图片 URL |

## 2. UI 设置（ui）— `settings:write`

| key | 类型 | 取值 |
|-----|------|------|
| `default_theme` | enum | `night` / `cyber` / `lava` / `light` / `space` |
| `frontend_locale` | enum | `zh` / `en` |
| `backend_locale` | enum | `zh` / `en` |
| `content_max_width` | text | CSS max-width，预设 `80rem`/`96rem`/`120rem`/`100%`，或 `数字px` |

## 3. Logo 设置（logo）— `settings:write`

复用 `header_logo` / `footer_logo`（见 §1）。

## 4. 首页 · Hero（hero）— `settings:write`

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

## 5. 首页 · Banner（banner）— `settings:write`

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

## 6. 导航设置（nav，实为页脚导航）— `settings:write`

| key | 类型 | 结构 |
|-----|------|------|
| `footer_nav` | json(数组,分组式) | `[{"title":"技术内容","links":[{"name":"Token 计划","url":"/token-plan"}]}, {"title":"关于","html":"<p>...</p>"}]` |
| `footer_nav_columns` | int | 网格列数 `1`–`6`，默认 `4` |

> 顶部主导航来自 `sections` 表（见下方「顶部导航」独立接口），非本 KV。

## 7. 链接设置（links）— `settings:write`

| key | 类型 | 说明 |
|-----|------|------|
| `friend_links_columns` | int | 友链编辑网格列数（仅后台用；公开页经 `/friend-links` 接口读 `friend_links` 表） |

## 8. 页脚设置（footer）— `settings:write`

| key | 类型 | 说明 |
|-----|------|------|
| `copyright_text` | text | 版权信息，如 `© 2026 TokenPress. All rights reserved.` |
| `icp_number` | text | ICP 备案号 |
| `icp_url` | url | 备案查询链接，默认 `https://beian.miit.gov.cn/` |
| `powered_by` | text | 技术支持署名 |

## 9. 备份（backup）— `settings:write`

| key | 类型 | 默认 |
|-----|------|------|
| `backup_auto_enabled` | bool | `false` |
| `backup_interval_hours` | int | `24` |
| `backup_retention_days` | int | `30` |
| `backup_include_uploads` | bool | `true` |

## 10. 分析（analytics）— `settings:write`

| key | 类型 | 说明 |
|-----|------|------|
| `analytics_code` | text | `<script>` 统计代码片段（仅 `<script>` 标签会被注入，防 XSS） |

## 11. 安全（security）— `settings:write`

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

## 12. 文章分享（share）— `settings:write`

| key | 类型 | 结构 |
|-----|------|------|
| `share_config` | json(对象) | `{"enabled":true,"platforms":["wechat","moments"],"positions":["article_top"],"likeEnabled":true,"likePositions":["article_top"]}` |

---

## 独立接口（非 KV 表）

### 友链（friend_links 表）— 权限 `friendlinks:write`

- `GET /api/v1/friend-links`（公开）
- `POST /api/v1/friend-links`：`{name, url, description?, sortOrder?, isActive?}`
- `PUT /api/v1/friend-links/:id`：同上字段可选
- `DELETE /api/v1/friend-links/:id`

### 顶部导航（sections 表）— 权限 `sections:write`

- `GET /api/v1/sections`（公开）
- `POST /api/v1/sections`：`{name, path, slug?, description?, externalUrl?, sortOrder?, isActive?}`
- `PUT /api/v1/sections/:id`：同上字段可选
- `DELETE /api/v1/sections/:id`

> `path` 会自动补前缀 `/`；`slug` 缺省由 name 生成。`externalUrl` 非空时 `path` 可重复（外链板块）。

---

## 客户端校验规则（scripts/settings.py 内置）

- **enum**：非法值直接拒绝并提示可取值。
- **bool**：接受 `true/false/1/0/yes/no/on/off`。
- **int**：非整数拒绝。
- **json**：`json.loads` 失败拒绝。
- **unknown key**：仍尝试写入，仅打印 warning（便于未来扩展）。

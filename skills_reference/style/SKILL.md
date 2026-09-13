---
name: tokenpress-style
description: "通过 Style Pack API 远程管理 TokenPress 站点风格模板包（style.json 单文件）：读取/修改 design/hero/features/header/footer/layouts 布局与配色字段、首页组件数组、配色方案重算、新建/激活/预览/恢复模板包。风格包只管「装修」（布局/配色/结构）；站点信息（名称/版权/备案/Logo）走 site_settings（token00-settings 技能），不进包。当用户表达改模板、换风格、调首页 Hero/CTA、改导航/页脚友链/功能开关、换配色、激活某风格、给站点加风格包、style pack 等意图时触发。需 Token 勾选 styles:read / styles:write。"
agent_created: true
---

# TokenPress Style Pack Controller

通过 styles API 远程读取与修改 TokenPress 全站模板配置，与后台可视化编辑（StylePackForm）等价，AI 与人共用同一份 `style.json`。

## 配置（`.token00.conf`）

与 `token00-publisher` / `token00-settings` 共用（项目根目录，已 gitignore）：

```json
{ "api_base": "https://www.token00.com/api/v1", "token": "t00_sk_xxxxx" }
```

本地验证用 `http://localhost:8081/api/v1`（同一 token 或后台另建）。

## ⚠️ 铁律（每次操作前确认）

1. **风格包只管「装修」**：布局/配色/结构。站点信息（名称/版权/备案/页脚 Logo）属内容，唯一来源是 `site_settings`（`settings:write`，见 token00-settings 技能），**不要往包里写 `site` 键**（后端会自动剔除）。
2. **先读 schema 再改**：字段定义以 `GET /styles/:id/schema` 为准，不要凭记忆猜键名。
3. **可 PATCH 根白名单**：`design | header | footer | layouts | hero | features`；`$` 元数据（name/version/builtin…）不可经 PATCH 修改。
4. **顶层 `site` 只读**：`GET /styles/:id` 顶层 `site` 是由 `site_settings` 解析的全局站点信息（供前台渲染），不属于包、不接受回写。
5. **生产纪律**：改动先在本地 Docker（localhost:8081）验证渲染，再对生产执行；不要未经验证直接改线上包。
6. 多字段改动用 PATCH `patch[]` 数组**原子提交**（任一失败整体拒绝），不要一次一请求。
7. 改完检查 `audit_logs`（GET /logs/api）应有对应记录；首页 ISR 缓存约 60s，验证可加 `?ts=` 或稍等强刷。

## 权限

| 资源 | 权限 | 端点 |
|---|---|---|
| 读包 | `styles:read` | `GET /styles`、`/styles/active`(公开)、`/styles/:id`、`/:id/schema`、`/:id/playbook`、`/:id/diff?target=` |
| 写包 | `styles:write` | `POST /styles`、`PUT /styles/:id`、`PATCH /styles/:id`、`PATCH /:id/homepage-sections`、`POST /:id/scheme`、`/activate`、`/preview`、`/restore`、`DELETE /:id` |

## 核心操作

通用调用（curl 需带 UA 头，本地/生产均适用）：

```bash
AUTH="Authorization: Bearer $TOKEN"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
```

### 1. 读包

```bash
curl -s -H "$AUTH" -A "$UA" "$API/styles"                      # 列包 + 激活态
curl -s -A "$UA" "$API/styles/active"                           # 当前激活包完整配置（公开）
curl -s -H "$AUTH" -A "$UA" "$API/styles/blog"                  # 单包：data.style 为原始 style.json
curl -s -H "$AUTH" -A "$UA" "$API/styles/blog/schema"           # 字段级 schema（必读）
curl -s -H "$AUTH" -A "$UA" "$API/styles/blog/playbook"         # 该包 AI 设计约束
curl -s -H "$AUTH" -A "$UA" "$API/styles/blog/diff?target=design"
```

### 2. 改字段（PATCH，单/批量/删除）

```bash
# 单字段：改轮播间隔
curl -s -X PATCH -H "$AUTH" -A "$UA" -H "Content-Type: application/json" \
  -d '{"path":"hero.interval","value":5}' "$API/styles/blog"

# 批量原子：换 Hero CTA + 关阅读进度条
curl -s -X PATCH -H "$AUTH" -A "$UA" -H "Content-Type: application/json" \
  -d '{"patch":[
    {"path":"hero.ctaButtons","value":[{"label":{"zh":"查看 AI 作品","en":"View AI Works"},"href":"/ai-works","style":"primary"}]},
    {"path":"features.readingProgressBar","value":false}
  ]}' "$API/styles/blog"

# 删除某字段（回到包内默认/前端兜底）
curl -s -X PATCH ... -d '{"patch":[{"path":"features.welcomeOverlay","op":"delete"}]}' "$API/styles/blog"
```

常用路径：`hero.enabled/size/interval/autoplay/showCTA/ctaButtons`、`features.readingProgressBar/backToTop/welcomeOverlay/languageSwitcher`、`footer.friendLinks.{show,source,maxItems,columns,items}`、`layouts.section.subcategory.{enabled,position,style,showCount,columns}`、`design.tokens.--accent-blue`、`header.nav.{align,style,colors.*}`。

**`header.nav`**（顶部导航栏）：

| 字段 | 取值 | 说明 |
|---|---|---|
| `align` | `left` / `center` / `right` | 水平对齐三档。`center` 用三栏 grid `1fr auto 1fr`（品牌 / 导航 / 动作），导航相对**整行**居中；`left` 品牌与导航同组靠左、动作独占右端；`right` 品牌独占左端、导航与动作同组靠右 |
| `style` | `plain` / `pill` / `underline` | 当前项形态：`plain` 直角 / `pill` 全圆角 / `underline` 关闭填充改用 `--nav-active-text` 画底部 2px 强调线 |
| `colors.*` | CSS 值 | 注入 `--nav-*`：`text` / `hoverBg` / `hoverText` / `activeBg` / `activeText` / `barBg` / `barText`。**填充与否由 `activeBg` 决定**（设 `transparent` 即无底色），圆角由 `style` 决定 |

> 「只有强调色文字、无底色」= `activeBg: transparent` + `activeText: 强调色` + `style: plain`。`nav.dropdown` 无实现。

**`layouts.templates.<模板 id>`**：按模板给出出厂默认样式（`article-list` / `article-grid` / `article-masonry` / `magazine` / `single-page` / `link-wall` / `design-gallery`），板块可经 `template_config` 逐字段覆盖。`design-gallery`（作品集瀑布流）字段：

| 字段 | 默认 | 说明 |
|---|---|---|
| `layout` | `grid` | `grid` 等距 / `masonry` 瀑布流（CSS 多列） |
| `columns` | 3 | 列数 1–6 |
| `gap` | `1.5rem` | 列间距 |
| `aspect` | `4/3` | 封面比例；`auto` 用图片原始比例 |
| `aspectCycle` | — | 逐卡轮换的比例数组（如 `["3/4","1/1","4/5"]`）营造瀑布节奏；配置后优先于 `aspect` |
| `cardStyle` | `boxed` | `boxed` 圆角描边卡片 / `flat` 无边框无底色，直接落在页面上 |
| `numberStyle` | `badge` | `badge` 封面右上角标 / `watermark` 封面中央大字编号 |
| `showCategoryBadge` | `true` | 封面上是否显示分类角标 |
| `numberPrefix` | `N°` | 编号前缀（编号优先取 `meta.number`，否则按列表顺序派生 `01`/`02`…） |
| `showMeta` | `true` | 编号 · 日期 元信息行（卡面 + 封面右上角标） |
| `showTags` | `true` | `meta.tags` 胶囊 |
| `showExcerpt` | `true` | 摘要 |
| `showAuthor` | `true` | 作者行 |

**作品集画廊同样走 `layouts.section`**（2026-09-13 起）：`design-gallery` 模板消费板块页的 `layout`（`page-sidebar-*`）/ `hero` / `sidebar` / `subcategory`，与文章列表模板一致。侧栏分类由文章 `meta.category` **聚合**得出（作品分类不在 `categories` 表），侧栏链接 `?category=` 会驱动画廊筛选。相关字段：

- `layouts.section.hero`：`enabled` / `label`（小号大写强调色 eyebrow）/ `title` / `description` / `align`（`center`|`left`）/ `divider`（标题区下通栏细线）
- `layouts.section.sidebar`：`enabled` / `sticky` / `label` / `metaBlock{title,lines[]}` / `showSearch` / `showTags`
- `layouts.section.subcategory`：`position: sidebar` 时在侧栏渲染，`showCount` 决定分类后是否带数量

写入示例：

```bash
curl -s -X PATCH -H "$AUTH" -A "$UA" -H "Content-Type: application/json" \
  -d '{"path":"layouts.templates.design-gallery","value":{"layout":"masonry","columns":3,"aspect":"4/5","numberPrefix":"N°","showMeta":true,"showTags":true,"showExcerpt":false,"showAuthor":false}}' \
  "$API/styles/design"
```

### 3. 首页组件数组

```bash
# 在 index 2 插入命名 Banner
curl -s -X PATCH ... -d '{"op":"insert","index":2,"element":{"component":"Banner","id":"banner-1"}}' "$API/styles/blog/homepage-sections"
# 其余 op: remove(带 index) / replace(index+element) / move(index+toIndex)
```

### 4. 配色方案重算

```bash
# mode: auto|light|dark；accent/accentAlt 为强调色 hex
curl -s -X POST ... -d '{"mode":"dark","accent":"#d71920"}' "$API/styles/blog/scheme"
```

### 5. 新建自定义包（完整流程）

1. 克隆基底：`GET /styles/blog` 取 `data.style` 整个对象；
2. 改 `$`：换 `id`（`^[a-z0-9-]+$`）、`name/description`，置 `builtin:false`；
3. 按需调 design/header/layouts 等；
4. `POST /styles` 提交（**id 已存在或撞内置包 → 409**，需换 id；内置包只能 PUT 局部改，不能整包覆盖/删除）：

```bash
curl -s -X POST -H "$AUTH" -A "$UA" -H "Content-Type: application/json" \
  -d '{"style":{"$":{"id":"my-pack","name":"我的包","version":"1.0.0","builtin":false},"design":{...},"header":{...},"layouts":{...}}}' \
  "$API/styles"
```

整包替换用 `PUT /styles/:id` + `{"style":{...}}`（保留原 id 与元数据，后端自动剔除 `site` 键）；局部旧字段形式亦可（`theme/manifest/layouts/header/footer/hero/features` 平铺在 body）。

### 6. 激活 / 预览 / 恢复 / 删除

```bash
curl -s -X POST -H "$AUTH" -A "$UA" "$API/styles/blog/activate"   # 全站立即切换
curl -s -X POST -H "$AUTH" -A "$UA" -H "Content-Type: application/json" \
  -d '{"view":"home","patches":[{"path":"features.backToTop","value":false}]}' "$API/styles/blog/preview"  # 预览图（非破坏）
curl -s -X POST -H "$AUTH" -A "$UA" "$API/styles/blog/restore"    # 仅内置包：恢复出厂
curl -s -X DELETE -H "$AUTH" -A "$UA" "$API/styles/custom-pack"   # 删自定义包（内置包 403）
```

## 验证清单

- [ ] `GET /styles/:id` 确认新值落盘于 `data.style.*`，且未意外改动其他根
- [ ] 改动写入了 `audit_logs`（action=style_pack）
- [ ] 预览图或 `GET /styles/active`（激活后）+ 页面强刷无破版
- [ ] 未触碰 `$` 元数据、未删除内置包、id 合规

# 设计师作品集 · AI 设计 Playbook

## 风格定位
设计师作品集：衬线标题、超大圆角（20px）、居中 Split 导航、满屏大图 Hero、零边栏 + 瀑布流板块、沉浸式文章、极简单行页脚。艺术家气质、留白多、聚焦作品。

## 设计原则
1. 留白至上：大间距、大圆角、少装饰
2. 满屏大图 Hero（image-only），无 CTA，聚焦视觉
3. 零边栏 + 瀑布流，让作品占满空间
4. 沉浸式文章页，无目录无干扰
5. 极简页脚：仅一行版权

## 可配置维度

### 整体定位
- 明暗（light/dark）：由全局主题（activeTheme）决定，本包默认浅色，仅经 `design.tokens` 调整配色
- `design.tokens['--accent-blue']`: 主强调色（默认红 #d71920）
- `design.tokens['--radius-card']`: 卡片圆角（默认 20px，超大圆角）

### Header
- `header.variant`: sticky-glass（毛玻璃）
- `header.logo.position`: center（居中 Logo）
- `header.nav.style`: split（Split 导航，Logo 居中两侧分列）
- `header.actions[]`: 极简（仅 search + theme + language + admin）

### Hero
- `hero.enabled`: true
- `hero.size`: full（满屏大图）
- `hero.showCTA`: false（无 CTA）
- `hero.autoplay`: 自动轮播开关；`hero.interval`: 轮播间隔秒数

### 首页内容块
- 极简序列：Hero（满屏大图）→ ArticleList（瀑布流）

### 板块页
- `layouts.section.layout`: none（零边栏）
- `layouts.section.list.layout`: masonry（瀑布流）
- `layouts.section.list.columns`: 2
- `layouts.section.subcategory.position`: top（顶部标签）

### 文章页
- `layouts.article.layout`: immersive（沉浸式）
- `layouts.article.showTOC`: false（无目录）
- `layouts.article.hero`: cover（大图）

### 页脚
- `footer.variant`: minimal（极简单行）
- `footer.friendLinks.show`: false（不显示友链）
- `footer.columns`: []（空）

## Agent 操作示例
- 「作品集留白再多一点」→ 调大 `design.tokens['--radius-card']`、加大 spacing
- 「二级分类用胶囊标签放顶部」→ patch `layouts.section.subcategory.position` = "top", style = "pill"
- 「列表改用 3 列瀑布流」→ patch `layouts.section.list.columns` = 3

## Schema 引用
所有字段必须符合 style-json.schema.json（GET /api/v1/styles/design/schema）

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`（均在后台 Token 管理可授）。

- 读取当前全量：`GET /api/v1/styles/active` → `data.style`（合并后单文件）
- 单字段改：`PATCH /api/v1/styles/design` body `{ "path":"hero.interval", "value":8 }`
- 批量改：`PATCH /api/v1/styles/design` body `{ "patch":[ {path,value}, ... ] }`
- 首页组件序列增删改移：`PATCH /api/v1/styles/design/homepage-sections` body `{ op, index, element?, toIndex? }`
- 配色方案重算：`POST /api/v1/styles/design/scheme` body `{ mode?, accent?, accentAlt? }`
- 对比两个包：`GET /api/v1/styles/design/diff?target=blog`
- 切换激活：`POST /api/v1/styles/design/activate`
- 预览图：`POST /api/v1/styles/design/preview` body `{ view:"home|section", patches?, baseUrl? }`（需可选依赖 playwright-core，未装返回 501）
- 提交新包：`POST /api/v1/styles` body `{ id, style:{...} }`，`style` 为 Agent **本地** LLM 产出的完整 style.json（后端不接 LLM，仅校验落盘）。

> **架构提醒**：Agent 跑在 PC 本地，用本地 LLM 基于 `GET /:id/schema` + 本 playbook 生成/改写 style.json，再调用远程 TokenPress API 提交（POST /、PATCH /、activate 等）。

**可 patch 根**：`design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据；站点信息属内容，走 site_settings，不在本包）。design 令牌用下标键，如 `design.tokens['--radius-card']`。
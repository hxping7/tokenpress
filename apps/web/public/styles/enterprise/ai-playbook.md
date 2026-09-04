# 科技企业官网 · AI 设计 Playbook

## 风格定位
商务科技企业官网：纯黑主色、方形卡片、顶部单图 Hero + 双 CTA、左侧边栏 + 顶部标签切换二级分类、单栏文章页 + 顶部大图、四列页脚。厚重、商务、可信。

## 设计原则
1. 品牌优先：纯黑强调色，克制、专业
2. 方形卡片（4px 圆角），干净利落
3. 顶部大图 Hero + 明确 CTA（预约演示/查看产品）
4. 多列页脚体现企业结构

## 可配置维度

### 整体定位
- 明暗（light/dark）：由全局主题（activeTheme）决定，本包默认浅色，仅经 `design.tokens` 调整配色
- `design.tokens['--accent-blue']`: 主强调色（默认纯黑 #111111）
- `design.tokens['--radius-card']`: 卡片圆角（默认 4px，方形）
- `$.compatibleThemes`: `["light"]` —— 纯黑强调色与深墙纸（night/cyber/lava/space）会撞成黑字黑底不可读，故前台只开放「极简亮白」墙纸；**改包时勿扩此白名单**，除非先把 `--accent-blue` 调成在深底上可见的亮色。

### Header
- `header.logo.type`: text（用站点名文字做 logo）
- `header.nav.style`: plain（纯文字导航）
- `header.nav.align`: right（靠右）
- `header.actions[]`: 登录按钮用 primary 风格

### Hero
- `hero.enabled`: true；`hero.size`: standard
- `hero.ctaButtons[]`: 双 CTA（预约演示 primary + 查看产品 secondary）
- `hero.showCTA`: true；`hero.autoplay` / `hero.interval`: 轮播开关与间隔

### 首页内容块
- 典型序列：Hero → Features（3列能力卡）→ Banner → CTA → ArticleList（2列）

### 板块页
- `layouts.section.layout`: page-sidebar-left（左侧边栏）
- `layouts.section.subcategory.position`: top（顶部标签）
- `layouts.section.subcategory.style`: pill
- `layouts.section.list.columns`: 2（双列卡片）

### 文章页
- `layouts.article.layout`: single（单栏）
- `layouts.article.hero`: cover（顶部大图）
- `layouts.article.showAuthor`: false（不显示作者）

### 页脚
- `footer.columns[]`: 4 列（产品/解决方案/公司/支持）
- `footer.friendLinks.show`: false（企业站通常不展示友链）
- `footer.background`: #0a0a0a（深色页脚）

## Agent 操作示例
- 「企业站整体偏深色」→ 切换全局主题为 dark（如 night），并相应重算 `design.tokens` 的 bg/text 变量
- 「二级分类放到顶部做标签」→ patch `layouts.section.subcategory.position` = "top"
- 「列表改成 3 列」→ patch `layouts.section.list.columns` = 3

## Schema 引用
所有字段必须符合 style-json.schema.json（GET /api/v1/styles/enterprise/schema）

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`（均在后台 Token 管理可授）。

- 读取当前全量：`GET /api/v1/styles/active` → `data.style`（合并后单文件）
- 单字段改：`PATCH /api/v1/styles/enterprise` body `{ "path":"hero.interval", "value":8 }`
- 批量改：`PATCH /api/v1/styles/enterprise` body `{ "patch":[ {path,value}, ... ] }`
- 首页组件序列增删改移：`PATCH /api/v1/styles/enterprise/homepage-sections` body `{ op, index, element?, toIndex? }`
- 配色方案重算：`POST /api/v1/styles/enterprise/scheme` body `{ mode?, accent?, accentAlt? }`
- 对比两个包：`GET /api/v1/styles/enterprise/diff?target=blog`
- 切换激活：`POST /api/v1/styles/enterprise/activate`
- 预览图：`POST /api/v1/styles/enterprise/preview` body `{ view:"home|section", patches?, baseUrl? }`（需可选依赖 playwright-core，未装返回 501）
- 提交新包：`POST /api/v1/styles` body `{ id, style:{...} }`，`style` 为 Agent **本地** LLM 产出的完整 style.json（后端不接 LLM，仅校验落盘）。

> **架构提醒**：Agent 跑在 PC 本地，用本地 LLM 基于 `GET /:id/schema` + 本 playbook 生成/改写 style.json，再调用远程 TokenPress API 提交（POST /、PATCH /、activate 等）。

**可 patch 根**：`design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据；站点信息属内容，走 site_settings，不在本包）。design 令牌用下标键，如 `design.tokens['--accent-blue']`。
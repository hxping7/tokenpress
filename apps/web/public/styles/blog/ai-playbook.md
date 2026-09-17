# 科技博客（blog）· AI 设计 Playbook

> 本文件描述**当前生效**的博客风格包。改包后请同步更新。

## 风格定位

经典科技博客：吸顶 Header（当前项胶囊高亮）、全宽 Hero 轮播、首页文章网格 + 中部宣传横幅、板块页右侧栏 + 网格卡片、文章页双栏（左目录 / 右相关文章）。轻量、克制、阅读优先。

- 站点信息（名称/简介/版权/备案/Logo）与内容（板块/分类/文章/页脚导航/轮播图/CTA/横幅）**都不在本包内**，唯一来源是 `site_settings` 与数据库；本包只决定**长什么样、放哪儿**。
- 完整边界规范见 `docs/style-pack-design.md` §9。

## 设计原则

1. **阅读优先**：行高充足、正文最大宽度 720px、目录常驻左侧
2. **克制配色**：白底 + 天蓝强调（`#0ea5e9`）+ 靛紫辅助（`#6366f1`），全站不超过三色
3. **圆角节奏**：卡片 14px、按钮胶囊、标签胶囊 999px

## 可配置维度

### 基础配色 `design.tokens`

| 令牌 | 当前值 | 说明 |
| --- | --- | --- |
| `--bg-primary` / `--bg-secondary` / `--bg-tertiary` | `#ffffff` / `#f5f5f7` / `#e8e8ed` | 三级背景 |
| `--text-primary` / `--text-secondary` / `--text-muted` | `#1d1d1f` / `#3a3a3f` / `#8a8a8f` | 三级文字 |
| `--accent-blue` / `--accent-purple` | `#0ea5e9` / `#6366f1` | 主 / 次强调 |
| `--gradient-from` / `--gradient-via` / `--gradient-to` | 天蓝 → 浅蓝 → 靛紫 | 渐变（CTA / 进度条 / 强调线） |
| `--content-max-width` / `--reading-max-width` | `1200px` / `720px` | 内容 / 正文宽度 |
| `--radius-card` / `--shadow-card` | `14px` / `0 1px 3px rgba(0,0,0,0.06)` | 卡片圆角与投影 |
| `--brand-font` | Inter, PingFang SC, system-ui | 品牌字体（衬线/无衬线切换改这里） |

`design.theme` 是与 tokens 同步的 `:root{}` 覆盖层——**两者必须一致**，否则主题变量会互相打架。

### Header `header`

- `variant`: `sticky-solid`（当前）/ `sticky-glass` / `sticky-transparent` / `static` / `hidden`
- `background` / `borderBottom`: 背景与下边线
- `logo`: `{ type, src, srcLight, text, position, height, link }`（`src` 为包内/站点资源路径，`text` 仅兜底）
- `nav.source`: `sections`（读板块表生成导航）
- `nav.align`: `left` / `center` / `right` —— 当前 `left`
- `nav.style`: `plain` / `pill`（当前）/ `underline`
- `nav.icons`: 板块 slug → lucide 图标名映射。**配置后即停用关键词兜底**；当前 IA 为 `code/ai/token/robotics/github/about`
- `nav.colors`: `text` / `hoverBg` / `hoverText` / `activeBg` / `activeText` / `barBg` / `barText`
- `actions[]`: 右侧动作（`type` ∈ `theme` / `language` / `admin` / `login` / `logout` / `link` / `divider`，配 `icon` / `label{zh,en}` / `style` / `showWhen`）。
  **前端不展示后台入口**，进后台直接访问 `/admin`；本包只保留 `theme` + `language`。

### Hero `hero`

数据（轮播图、数量、间隔、尺寸、效果、文章封面填补）**全部来自 `site_settings`**；本包只提供开关与兜底：

- `enabled`: false 时首页不渲染 Hero
- `autoplay`: 兜底自动播放开关
- `showCTA`: false 时隐藏 CTA 按钮区
- `size` / `interval` / `ctaButtons[]`: 仅在后台**未配置**时兜底（后台优先）

### 首页区块 `layouts.homepage`

- `container`: `boxed`（当前）/ `full` / `wide`
- `sections[]`: 区块序列，可自由排序增删。当前：`Hero(carousel)` → `Banner(home_main)` → `ArticleList(grid-3, limit 9)` → `Banner(home_bottom)`
- 可用组件：`Hero` / `Features` / `ArticleList` / `CTA` / `Banner` / `CustomBlock`
- **硬约束**：序列里必须保留 `Hero`（承载首页宣传页）与 `Banner`（承载中部横幅）的占位——包改外观用 `variant`，**不许删区块**

### 板块页 / 分类页 `layouts.section` / `layouts.category`

- `layout`: `page-sidebar-right`（当前）/ `page-sidebar-left` / `landing` / `none`
- `hero`: 板块头图开关与内容来源
- `sidebar.enabled` / `sidebar.sticky`: 右侧栏
- `list.layout`（`grid` / `list` / `masonry`）+ `columns` + `showThumbnail` / `showExcerpt`
- `subcategory`: `position`（`sidebar` / `top` / `tab` / `none`）+ `style`（`pill` / `card` / `list` / `grid`）

### 文章页 `layouts.article`

- `layout`: `two-column`（当前）/ `single` / `immersive`
- `showTOC` / `showAuthor`: 目录与作者
- `sidebar`: `related`（相关文章）/ 其他
- `maxWidth`: 正文最大宽度

### 模板出厂样式 `layouts.templates.<模板id>`

板块/分类可选模板：`article-list` / `article-grid` / `article-masonry` / `magazine` / `single-page` / `link-wall` / `design-gallery`。
每个模板可配置列数、间距、缩略图比例、卡片样式等（如 `article-grid.columns=3`、`aspectRatio=16/10`）。
> 注意：文章类列表的 `cardStyle` 仅 `shadow` / `zoom` 有效；`design-gallery` 的 `cardStyle` 为 `boxed` / `flat`，两者不通用。

### 页脚 `footer`（**只放装修，不放内容**）

- `variant`: `multi-column`（当前）/ `simple` / `minimal`
- `padding` / `borderTop` / `background` / `textColor`
- `nav`: `columns`（列数）/ `gap` / `title{size,weight,marginBottom}` / `link{size,lineHeight,gap}`
- `friendLinks`: `show` / `layout` / `columns` / `gap` / `maxItems`（**列数后台 `friend_links_columns` 优先，包内为兜底**）
- `bottom`: `layout`（`columns` / `between` / `centered`）+ `size` + `showIcp`（**备案号与链接取 `site_settings.icp_number` / `icp_url`**）+ `showPoweredBy`

> 已移除的内容字段：`footer.columns[].links/html`、`friendLinks.items/source`、`bottom.copyright`、`bottom.social`、`bottom.showBackToTop`、variant `mega` —— 导航分组 / 版权 / 备案 / 站点简介一律来自 `site_settings`，友链来自 `friend_links` 表。

### 功能开关 `features`

`readingProgressBar`（顶部阅读进度条）、`backToTop`、`welcomeOverlay`、`languageSwitcher`

## 自带演示示例内容

本包携带 `demo.json` + `demo-media/`（**46 个文件**：22 篇封面 + 22 张内文插图 + 2 张页脚二维码；媒体引用已改写为 `demo-media/<rel>` 相对路径），首次安装向导 `/setup` 中勾选即装：

| 项 | 数量 | 内容 |
| --- | --- | --- |
| 板块 | 6 | 编程实战 `/code` · AI 工程 `/ai` · Token 观察 `/token` · 机器人 `/robotics` · 开源现场 `/github` · 关于 `/about` |
| 分类 | 18 | 前端/后端/工程效能/工具链 · RAG/Agent/Prompt/评测/推理 · 价格/行业观察/API 设计 · 人形机器人/ROS 2/边缘推理 · 工作流/开源观察/项目推荐 |
| 文章 | 22 | 结构化长文（小节 + 表格 + 数据 + 边界提醒），每篇配博客风 SVG 封面与示意图 |
| 标签 | 72 | 按主题聚合（React / RAG / Token / Sim2Real / GitHub Actions …） |
| 友链 | 6 | GitHub · MDN · Hacker News · 阮一峰的网络日志 · Kubernetes · ROS |
| 站点设置 | 30 | 站名「极客手记」、简介、版权、页脚导航（4 列含二维码）、轮播（3 张 + 文章封面填补）、Hero CTA（3 个）、中部横幅（2 条：`home_main` / `home_bottom`） |

演示内容**幂等安装**：板块/分类按 `slug`、标签按 `name`、文章按 `slug`、友链按 `url`、站点设置按 `key`，已存在即跳过。
包内还提供 hero 主视觉 `media/hero-cover.svg`（经 `/styles/blog/media/hero-cover.svg` 引用，不占用 uploads）。

## Agent 操作示例

- 「Hero 关掉」→ patch `hero.enabled = false`
- 「导航改成下划线样式并居中」→ patch `header.nav.style = "underline"`, `header.nav.align = "center"`
- 「首页加一个能力区」→ `POST /api/v1/styles/blog/homepage-sections` `{ op:"insert", index:1, element:{ component:"Features" } }`
- 「文章页去掉侧栏、目录保留」→ patch `layouts.article.layout = "single"`, `layouts.article.showTOC = true`
- 「页脚不要友链」→ patch `footer.friendLinks.show = false`

> 包能决定区块的**形态与位置**，但不能删掉承载后台设置的区块，也不能覆盖用户显式配置过的值 —— 详见 `docs/style-pack-design.md` §9。

## Schema 引用

所有字段必须符合 `style-json.schema.json`（`GET /api/v1/styles/blog/schema`）。

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`。

- 读取当前全量：`GET /api/v1/styles/active` → `data.style`
- 单字段改：`PATCH /api/v1/styles/blog` body `{ "path":"hero.interval", "value":8 }`
- 批量改：`PATCH /api/v1/styles/blog` body `{ "patch":[ {path,value}, ... ] }`
- 首页区块增删改移：`PATCH /api/v1/styles/blog/homepage-sections` body `{ op, index, element?, toIndex? }`
- 配色重算：`POST /api/v1/styles/blog/scheme` body `{ mode?, accent?, accentAlt? }`
- 对比两个包：`GET /api/v1/styles/blog/diff?target=enterprise`
- 切换激活：`POST /api/v1/styles/blog/activate`
- 预览图：`POST /api/v1/styles/blog/preview`
- 提交新包：`POST /api/v1/styles` body `{ id, style:{...} }`

> **架构提醒**：Agent 跑在 PC 本地，用本地 LLM 基于 `GET /:id/schema` + 本 playbook 生成/改写 style.json，再调用远程 API 提交。

**可 patch 根**：`design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据；站点信息与内容属 `site_settings` / 数据库，不在本包）。

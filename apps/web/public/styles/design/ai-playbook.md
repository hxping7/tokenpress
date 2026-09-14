# 设计师作品集（design）· AI 设计 Playbook

> 本文件描述 **当前生效** 的设计师风格包。改包后请同步更新，避免与实际 `style.json` 脱节。

## 风格定位
手办原型设计师站：暖米白底（`#f5f3ee`）+ 漆红强调（`#a8311f`）+ 衬线展示字体（Cormorant Garamond），卡片小圆角（6px）、细分隔线、大量留白。结构为 **三栏居中导航**、**左文右图首屏**、**左栏分类侧栏 + 瀑布流作品集**、**沉浸式单列文章 + 首字下沉**、**四列品牌页脚**。

## 设计原则
1. 留白与细线：靠间距和 1px 分隔线分区，不用色块和阴影堆装饰
2. 导航居中、当前项只有强调色文字、无底色（原型 `.active { color: var(--accent) }`）
3. 作品优先：板块页给分类侧栏，正文区留给瀑布流作品
4. 文章页单列、关闭目录与侧栏，首字下沉做阅读起点
5. 页脚可承载信息：品牌块 + 分组导航 + 版权条

## 可配置维度（含当前值）

### `design.tokens`（配色与全局尺度）
| token | 当前值 | 说明 |
|---|---|---|
| `--accent-blue` | `#a8311f` | 主强调色（漆红） |
| `--accent-purple` / `--accent-blue-dim` | `#7c2418` | 次强调 / 悬停态 |
| `--bg-primary` / `--bg-secondary` / `--bg-tertiary` | `#f5f3ee` / `#ffffff` / `#efeae0` | 三级背景 |
| `--text-primary` / `-secondary` / `-muted` | `#1a1a1a` / `#4a4a48` / `#8c8880` | 三级文字 |
| `--radius-card` | `6px` | 卡片圆角 |
| `--brand-font` | Cormorant Garamond… | 展示字体（标题 / 首字下沉） |
| `--content-max-width` / `--reading-max-width` | `1280px` / `760px` | 内容宽 / 阅读宽 |
| `--dropcap-size` / `-line-height` / `-margin` | `3.6em` / `0.9` / `8px 12px 0 0` | 首字下沉 |

明暗（light/dark）由全局主题 `activeTheme` 决定，本包默认浅色，只经 `design.tokens` 调配色。

### `header`
- `variant`: `sticky-glass`（毛玻璃吸顶）
- `logo.position`: `left`（**不是居中**），`logo.type`: `text`
- `nav.align`: `center` —— 三栏 grid `1fr auto 1fr`，导航相对整行居中（`left`/`right` 另两档：贴品牌 / 贴动作区）
- `nav.style`: `plain`（直角；可选 `pill` 全圆角、`underline` 关填充改底部强调线）
- `nav.colors`: `activeBg: transparent` + `activeText: #a8311f` ⇒ 当前项只有漆红文字、无底色
- `actions[]`: `search` / `theme` / `language`（**无后台入口**，进后台直接访问 `/admin`）

### `hero`（首页轮播）
- 当前 `enabled: false`，首页首屏由 `layouts.homepage` 的 CustomBlock(hero) 承担
- 可选字段：`size` / `autoplay` / `interval` / `showCTA` / `ctaButtons[]`

### 首页内容块 `layouts.homepage.sections`
1. **CustomBlock**（`size: hero`，`split: {enabled:true, ratio:'1/1.4'}`）—— 左文右图：`eyebrow`（— FIGURE DESIGNER · 手办原型师）、`title` + `titleAccent`（斜体强调）、`intro`、`stats[]`、`media`（`source:'latest'` / `aspect:'3/2'` / `fit:'contain'` / `badge`）、`cta` + `cta2`

> `media.fit`：默认 `cover`（填满并裁切）。文章封面多为 1200×630 横版，若 `aspect` 配成竖版（如 `4/5`），`cover` 会把封面上的标题文字裁掉 —— design 包因此配 `aspect:'3/2'` + `fit:'contain'`（完整显示，留白由 `--bg-tertiary` 兜底）。
2. **ArticleList** —— 作品流（`templates.design-gallery` 生效）
3. **CustomBlock**（About）—— `eyebrow`、`title`、`signature`（斜体署名 `— HXP`）

组件序列可经 `PATCH /api/v1/styles/design/homepage-sections` 增删改移。

### 板块页 `layouts.section`
- `layout`: `page-sidebar-left`（左栏侧栏；另有 `page-sidebar-right` / `none`）
- `hero`: `{ enabled:true, label:'Works · 作品', title:'全部作品', align:'left', divider:true }` —— 左对齐 eyebrow + 标题 + 分隔线
- `sidebar`: `{ enabled:true, sticky:true, label:'Category · 分类', metaBlock:{title,lines[]}, showSearch:true, showTags:true }`
- `list`: `{ layout:'masonry', columns:3, showThumbnail:true, showExcerpt:false }`
- `subcategory`: `{ enabled:true, position:'sidebar', style:'list', showCount:true }`

### 作品集画廊 `layouts.templates['design-gallery']`
| 字段 | 当前值 | 说明 |
|---|---|---|
| `layout` | `masonry` | `grid` 等距 / `masonry` 瀑布流 |
| `columns` / `gap` | `3` / `2rem` | 列数 / 间距 |
| `aspectCycle` | `["3/4","1/1","4/5"]` | 逐卡轮换比例，营造瀑布节奏（优先于 `aspect`） |
| `cardStyle` | `flat` | `flat` 无边框无底色 / `boxed` 卡片 |
| `numberStyle` | `watermark` | `watermark` 封面中央大字编号 / `badge` 右上角标 |
| `numberPrefix` / `showMeta` / `showTags` | `N°` / `true` / `true` | 编号 · 日期行、`meta.tags` 胶囊 |
| `showCategoryBadge` / `showExcerpt` / `showAuthor` | `true` / `false` / `false` | 封面分类角标、摘要、作者行 |

### 文章页 `layouts.article`
`layout: single`（单列）、`showTOC: false`（无目录）、`sidebar: none`、`maxWidth: 760`、`showAuthor: true`、`dropcap.enabled: true`（首字下沉，字体/尺寸/颜色读 `--dropcap-*` token）

### 页脚 `footer`
- `variant`: `multi-column`（另有 `simple` 单行、`minimal` 居中 Logo+版权）
- `padding` / `maxWidth` / `borderTop`: `56px 40px 40px` / `1280px` / `1px solid #e3ddd0`
- `nav`: `{ template:'1.5fr 1fr 1fr 1fr', gap:'48px', title:{size:'10px',weight:500,transform:'uppercase',letterSpacing:'0.24em',color:'#8c8880'}, link:{size:'13px',lineHeight:'2'} }`
- `brandBlock`: `{ show:true, source:'siteDescription', showLogo:true }` —— 首列品牌块，文案取自 `site_settings`
- `logo.show`: `false`（版权区不再重复 Logo，品牌块已带）
- `friendLinks.show`: `false`
- `bottom`: `{ layout:'between', size:'12px', divider:'1px solid #e3ddd0' }`

> ⚠️ 页脚**只放装修**：导航链接 / 版权 / 备案 / 站点简介来自 `site_settings`（`footer_nav`、`copyright_text`、`icp_number`、`site_description`），友链数据来自 `friend_links` 表。包内不得写这些内容。

### `features`
`readingProgressBar:false` / `backToTop:true` / `welcomeOverlay:false` / `languageSwitcher:'icon'`

## Agent 操作示例
- 「导航改成靠左」→ `patch` `header.nav.align` = `"left"`
- 「当前项改成胶囊」→ `header.nav.style` = `"pill"`，`header.nav.colors.activeBg` = `"#a8311f"`、`activeText` = `"#ffffff"`
- 「作品卡改成等高网格、关掉水印编号」→ `layouts.templates['design-gallery'].layout` = `"grid"`、`numberStyle` = `"badge"`
- 「作品卡显示摘要」→ `layouts.templates['design-gallery'].showExcerpt` = `true`
- 「板块页去掉侧栏」→ `layouts.section.layout` = `"none"`（或 `layouts.section.sidebar.enabled` = `false`）
- 「页脚改成单行」→ `footer.variant` = `"simple"`
- 「换配色」→ `POST /api/v1/styles/design/scheme { accent }`，或直接改 `design.tokens['--accent-blue']`

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`。

- 读取当前全量：`GET /api/v1/styles/active` → `data.style`
- 单字段改：`PATCH /api/v1/styles/design` body `{ "path":"header.nav.align", "value":"left" }`
- 批量改：`PATCH /api/v1/styles/design` body `{ "patch":[ {path,value}, ... ] }`
- 首页组件序列：`PATCH /api/v1/styles/design/homepage-sections` body `{ op, index, element?, toIndex? }`
- 配色重算：`POST /api/v1/styles/design/scheme` body `{ mode?, accent?, accentAlt? }`
- 对比两包：`GET /api/v1/styles/design/diff?target=blog`
- 切换激活：`POST /api/v1/styles/design/activate`
- 预览图：`POST /api/v1/styles/design/preview` body `{ view:"home|section", patches?, baseUrl? }`（依赖 playwright-core，未装返回 501）
- 提交新包：`POST /api/v1/styles` body `{ id, style:{...} }`

> **架构提醒**：Agent 跑在 PC 本地，用本地 LLM 基于 `GET /:id/schema` + 本 playbook 生成/改写 style.json，再调用远程 API 提交。

**可 patch 根**：`design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据；站点信息属内容，走 site_settings，不在本包）。design 令牌用下标键，如 `design.tokens['--radius-card']`。

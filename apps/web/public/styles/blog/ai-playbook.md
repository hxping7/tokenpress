# 科技博客风 · AI 设计 Playbook

## 风格定位
经典科技博客：毛玻璃吸顶 Header、左文右图 Hero、文章网格 + 右侧栏板块、双栏文章页。轻量、现代、注重阅读。

## 设计原则
1. 阅读优先：行高充足、字号适中、段落间距清晰
2. 克制配色：白底 + 蓝色强调色，避免多色混杂
3. 圆角节奏：卡片 14px、按钮胶囊 999px、输入框 8px

## 可配置维度

### 整体定位
- `design.color.mode`（= `design.mode`）: light | dark | auto
- `design.tokens['--radius-card']`: 卡片圆角（默认 14px）
- `design.tokens['--content-max-width']`: 内容最大宽度

### Header
- `header.variant`: sticky-solid（固定不透明）/ sticky-glass（毛玻璃）/ sticky-transparent / static / hidden
- `header.nav.style`: underline（下划线）/ pill / plain / split / minimal
- `header.nav.icons`: 菜单图标映射（lucide 名或内联 SVG，key 为板块 slug 或 name，`_default` 兜底）
- `header.nav.align`: left / center / right
- `header.actions[]`: 右侧操作按钮，可增删改顺序（theme/language/admin/login/logout/link/divider）

### Hero（首页核心视觉）
- 数据由 site_settings 的 hero_slides / hero_carousel_use_articles 提供
- `hero.variant`: carousel（轮播）/ standard / split-left / split-right / image-only / none
- `hero.position`: before-content / after-content / floating
- `hero.ctaButtons[]`: CTA 按钮卡片（label 支持 {zh,en}、href、style）
- `hero.height`: 高度 vh / px

### 首页内容块
- `layouts.homepage.container`: boxed / full / wide
- `layouts.homepage.sections[]`: 首页组件序列，可自由排序/增删（Hero/Features/ArticleList/CTA/Banner/CustomBlock）

### 板块页
- `layouts.section.layout`: page-sidebar-right / page-sidebar-left / landing / none
- `layouts.section.hero.enabled`: 是否显示板块头图
- `layouts.section.sidebar.enabled`: 侧栏开关
- `layouts.section.list.layout`: grid / list / masonry；`columns` 列数；`cardStyle` 卡片样式
- `layouts.section.subcategory.position`: sidebar（侧栏）/ top（顶部）/ tab / none
- `layouts.section.subcategory.style`: pill / card / list / grid

### 文章页
- `layouts.article.layout`: two-column（双栏）/ single / immersive
- `layouts.article.showTOC`: 是否显示目录；`showAuthor`：是否显示作者

### 页脚
- `footer.columns[]`: 页脚菜单分组（title + links[{label,href}] 或 html）
- `footer.friendLinks.show`: 是否显示友链；`source`: table（读表）/ custom（自定义 items）
- `footer.bottom.copyright`: 版权文本（也可用 `site.copyright` 覆盖全局）

### 站点信息
- `site.name` / `site.copyright` / `site.icp` / `site.icpUrl` / `site.poweredBy`
- 值为 null 表示回落 site_settings 全局默认

## Agent 操作示例
- 「把首页 Hero 改成左文右图分栏」→ patch `hero.variant` = "split-left", `hero.overlay.enabled` = false
- 「菜单放左边、Logo 居中」→ patch `header.logo.position` = "center", `header.nav.align` = "left"
- 「二级分类改成顶部标签云」→ patch `layouts.section.subcategory.position` = "top", `layouts.section.subcategory.style` = "pill"
- 「文章页用沉浸式无边栏」→ patch `layouts.article.layout` = "immersive", `layouts.article.showTOC` = false

## Schema 引用
所有字段必须符合 style-json.schema.json（GET /api/v1/styles/blog/schema）

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`（均在后台 Token 管理可授）。

- 读取当前全量：`GET /api/v1/styles/active` → `data.style`（合并后单文件）
- 单字段改：`PATCH /api/v1/styles/blog` body `{ "path":"hero.variant", "value":"split-left" }`
- 批量改：`PATCH /api/v1/styles/blog` body `{ "patch":[ {path,value}, ... ] }`
- 首页组件序列增删改移：`PATCH /api/v1/styles/blog/homepage-sections` body `{ op, index, element?, toIndex? }`
- 配色方案重算：`POST /api/v1/styles/blog/scheme` body `{ mode?, accent?, accentAlt? }`
- 对比两个包：`GET /api/v1/styles/blog/diff?target=enterprise`
- 切换激活：`POST /api/v1/styles/blog/activate`
- 预览图：`POST /api/v1/styles/blog/preview` body `{ view:"home|section", patches?, baseUrl? }`（需可选依赖 playwright-core，未装返回 501）
- 提交新包：`POST /api/v1/styles` body `{ id, style:{...} }`，`style` 为 Agent **本地** LLM 产出的完整 style.json（后端不接 LLM，仅校验落盘）。

> **架构提醒**：Agent 跑在 PC 本地，用本地 LLM 基于 `GET /:id/schema` + 本 playbook 生成/改写 style.json，再调用远程 TokenPress API 提交（POST /、PATCH /、activate 等）。

**可 patch 根**：`site` / `design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据）。design 令牌用下标键，如 `design.tokens['--radius-card']`。
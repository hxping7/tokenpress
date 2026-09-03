# TokenPress 全站可定制风格包 + AI Agent API 方案

> 目标：**切换一个风格包，整个站点"所见"全部随之改变**——Header、菜单（含图标/样式/二级菜单位置）、Hero、CTA 按钮卡片、板块布局、二级分类、文章样式、**页脚菜单/站点信息/友链/版权/ICP**，全部由风格包驱动。
> AI Agent 可通过统一的 API 读取、修改、生成风格包。
> 更新时间：2026-08-05（AI Agent API：schema/playbook/PATCH/homepage-sections/scheme/activate/diff/preview；Agent 在 PC 本地生成 style.json 后 POST 提交，后端不接 LLM。见 §5）

---

## 一、现状盘点：哪些"所见"已经可定制，哪些还没有

### 已可定制（风格包已覆盖）

| 区块 | 覆盖方式 | 文件 |
|------|---------|------|
| Header 形态 | `variant`（sticky-solid / sticky-glass / static）+ 背景/边框 | header.json |
| Header Logo | `type`（image/text/component）+ src/srcLight/position/height/link | header.json |
| Header 菜单 | `nav.style`（underline/pill/plain/split）+ align + icons + colors | header.json |
| Header 右侧操作 | `actions[]`（theme/language/admin/login/logout/link/divider） | header.json |
| 页脚形态 | `variant`（multi-column / minimal）| footer.json |
| 页脚导航分组 | `columns[]`（多列链接分组）| footer.json |
| 页脚颜色 | `background` / `textColor` | footer.json |
| 配色令牌 | `:root{ --bg-*; --text-*; --accent-*; --radius-*; ... }` | theme.css |
| 板块/分类/文章布局 | `layouts.json` 的 section/category/article/list/templates | layouts.json |

### 未可定制（仍写死读 site_settings，风格包覆盖不到）

| 区块 | 现状 | 来源 |
|------|------|------|
| **站点名** | Header 用 `siteSettings.site_name` | site_settings |
| **站点描述** | `<title>`/`<meta description>` 用 `site_description` | site_settings |
| **页脚版权文本** | `copyrightText = settings.copyright_text` | site_settings |
| **页脚 ICP 备案** | `icpNumber = settings.icp_number`（含链接 url）| site_settings |
| **页脚 Powered by** | `poweredBy = settings.powered_by` | site_settings |
| **页脚友链** | 渲染 `friend_links` 表数据（friendLinks）| DB friendLinks 表 |
| **页脚列数** | `footer_nav_columns = settings.footer_nav_columns` | site_settings |
| **页脚底部 Logo** | `FooterLogo` 固定组件 | 组件写死 |
| **Hero 数据** | `hero_slides`（宣传图+CTA）来自 site_settings | site_settings |
| **Hero 形态/CTA 卡片** | 组件硬编码渲染逻辑，风格包只能改色 | HeroCarousel 组件 |
| **首页组件序列** | HomeSections 硬编码，后端白名单校验但前端不消费 | 组件写死 |
| **二级分类** | 无任何处理，三套包都未启用 | — |

### 关键结论

风格包当前覆盖的是"**外壳**"（Header/Footer 形状 + 颜色），但**站点内容信息**（站点名、描述、版权、ICP、友链、Hero 数据、CTA）仍耦合在 `site_settings` 和 `friend_links` 表中。要实现"全站所见定制"，必须让风格包**既能覆盖外壳、又能覆盖站点内容数据**，同时保留 site_settings 作为全局默认值。

---

## 二、设计原则（权衡点）

| 原则 | 说明 |
|------|------|
| P1 | **风格包是覆盖层，不是数据源**。站点信息（名称/版权/ICP）默认仍从 site_settings 读；风格包可**显式覆盖**这些值，未覆盖则回落全局默认 |
| P2 | **内容数据（文章/友链）与展示配置（风格包）分离**。风格包不存业务数据，但可声明"是否展示友链/展示哪些分组/展示成什么样式" |
| P3 | **一个 JSON 单文件**承载全部展示配置（合并原 5 文件）|
| P4 | **AI Agent 只能改展示配置与站点信息覆盖**，不能改业务数据（文章/用户/媒体）——安全边界 |
| P5 | 全站动态化 = 引入**组件注册表**，让 Header/Hero/首页/板块/文章都按 JSON 声明渲染 |

---

## 三、统一风格包：`style.json`（单文件全站配置）

### 3.1 文件结构

```
public/styles/<id>/
├── style.json          ← 唯一配置源（合并原 manifest/theme.css/header/footer/layouts）
├── ai-playbook.md      ← AI Agent 自然语言说明书
└── preview.png         ← 预览图（可选）
```

### 3.2 style.json 顶层结构（新增 `site` 与 `content` 两大块）

```jsonc
{
  // ===== 元数据 =====
  "$": { "id":"blog", "name":"科技博客风", "version":"1.0.0",
         "description":"...", "builtin":true, "preview":"preview.png" },

  // ===== 站点信息覆盖（P1：未覆盖则回落 site_settings 全局默认）=====
  "site": {
    "name": null,               // null = 用 site_settings.site_name
    "description": null,        // null = 用 site_settings.site_description
    "titleFormat": "%s | TokenPress",   // <title> 模板
    "copyright": null,          // null = 用 site_settings.copyright_text
    "icp": null,                // null = 用 site_settings.icp_number
    "icpUrl": null,             // null = 用 site_settings.icp_url
    "poweredBy": null,          // null = 用 site_settings.powered_by
    "footerLogo": {             // 覆盖 FooterLogo
      "type": "image", "src": "/footer-logo.svg", "height": 28
    }
  },

  // ===== 设计令牌（原 theme.css）=====
  "design": { "color":{...}, "fontFamily":{...}, "radius":{...}, "size":{...}, "motion":{...} },

  // ===== Header =====
  "header": {
    "variant": "sticky-solid | sticky-glass | static | hidden",
    "height": 64,
    "logo": { "type":"image|text|component", "src":"/logo-dark.svg", "srcLight":"/logo-light.svg",
              "text":"TokenPress", "position":"left|center|right", "height":36, "link":"/" },
    "nav": {
      "source": "sections | custom | mixed",     // 菜单数据来源
      "items": ["blog","ai-coding","design-works"], // source=custom/mixed 时生效
      "align": "left|center|right",
      "style": "plain|underline|pill|split|minimal",
      "icons": { "ai-coding":"code", "blog":"book", "_default":"folder" },
      "showIcon": true,
      "dropdown": "hover|click",
      "colors": { "text":"#3a3a3f", "hoverBg":"rgba(...)", "hoverText":"#1d1d1f",
                  "activeBg":"#0ea5e9", "activeText":"#fff", "barBg":"transparent", "barText":"#1d1d1f" }
    },
    "actions": [ { "type":"login","icon":"user","style":"ghost","showWhen":"loggedOut" }, ... ]
  },

  // ===== Hero（首页核心视觉 + CTA 卡片）=====
  "hero": {
    "enabled": true,
    "position": "before-content | after-content | floating",
    "variant": "carousel | standard | split-left | split-right | image-only | none",
    "height": "60vh",
    "overlay": { "enabled":true, "color":"rgba(0,0,0,0.4)" },
    "showCTA": true,
    "ctaButtons": [   // CTA 卡片（可覆盖 site_settings.hero_cta_buttons）
      { "label":{"zh":"开始阅读","en":"Start Reading"}, "href":"/blog", "style":"primary" },
      { "label":{"zh":"了解更多","en":"Learn More"}, "href":"/about", "style":"outline" }
    ],
    "autoplay": true,
    "interval": 5000,
    "transition": "slide | fade"
  },

  // ===== 首页组件序列（动态分发，P5）=====
  "homepage": {
    "container": "boxed | full | wide",
    "sections": [
      { "component":"Hero" },
      { "component":"Features", "variant":"3-col-cards" },
      { "component":"ArticleList", "variant":"carousel", "props":{"source":"latest","limit":6} },
      { "component":"CTA", "variant":"banner" },
      { "component":"Banner", "id":"home_main", "variant":"newsletter" }
    ]
  },

  // ===== 板块页 =====
  "section": {
    "layout": "sidebar-right|sidebar-left|top-nav|none",
    "hero": { "enabled":true, "titleFrom":"section", "showCover":true, "description":true },
    "content": { "type":"standard|featured-article|custom", "source":"latest", "articleSlug":"" },
    "sidebar": { "enabled":true, "position":"right|left", "source":"categories|custom|mixed",
                 "customItems":[], "title":"栏目导航", "showCounts":true, "sticky":true },
    "list": { "style":"grid|list|masonry|compact|magazine", "columns":3,
              "aspectRatio":"16/10", "cardStyle":"clean|bordered|shadow|zoom",
              "showThumbnail":true, "showExcerpt":true, "showAuthor":true, "showDate":true,
              "showReadTime":false, "gap":"1.5rem" },

    // ===== 二级分类 =====
    "subcategory": {
      "enabled": true,
      "position": "sidebar | tab | top | none",
      "style": "pill | card | list | grid",
      "columns": 3,
      "showCount": true,
      "showCover": true,
      "source": "auto | custom"
    }
  },

  // ===== 分类页 =====
  "category": { "layout":"sidebar-right", "sidebar":{...}, "hero":{...}, "list":{...}, "subcategory":{...} },

  // ===== 文章详情页 =====
  "article": {
    "layout": "single | two-column | immersive",
    "maxWidth": 720,
    "showTOC": true, "tocPosition": "sidebar | inline",
    "showAuthor": true, "showDate": true, "showReadTime": true, "showTags": true,
    "showRelated": true, "relatedPosition": "sidebar | inline",
    "hero": "default | cover | none", "readingMode": true
  },

  // ===== 卡片网格模板级参数 =====
  "cardGrid": { "article-list":{...}, "article-grid":{...}, ... },

  // ===== 页脚（含站点信息/友链/分组）=====
  "footer": {
    "variant": "multi-column | simple | minimal | mega",
    "columns": [   // 页脚菜单分组
      { "title":"导航", "links":[ { "label":"首页","href":"/" }, { "label":"博客","href":"/blog" } ] },
      { "title":"资源", "links":[...] },
      { "title":"关于", "links":[...] }
    ],

    // ===== 友链展示控制（P2：不存数据，只控制如何展示）=====
    "friendLinks": {
      "show": true,                 // 是否显示友链行
      "source": "table | custom",   // table=读 friend_links 表 | custom=用下方自定义
      "items": [ { "name":"TokenPress","url":"https://tokenpress.com" } ],  // source=custom 时
      "columns": 0,                 // 0=自适应
      "maxItems": 20
    },

    "bottom": {
      "copyright": null,            // 覆盖 site.site.copyright
      "showICP": true, "showPoweredBy": true,
      "social": ["github","wechat"],
      "showBackToTop": true
    },
    "background": "var(--bg-secondary)",
    "textColor": "var(--text-muted)"
  },

  // ===== 行为特性 =====
  "features": {
    "submenuEnabled": true, "readingProgressBar": true, "backToTop": true,
    "welcomeOverlay": true, "languageSwitcher": "icon|label|full"
  }
}
```

### 3.3 字段与现有 DB/文件的映射（收敛）

| 旧来源 | 新归属 |
|--------|--------|
| `site_settings.active_style` | 保留，决定用哪个 style.json |
| `site_settings.active_theme` / `default_theme` | **废弃** → `design.color.mode` |
| `site_settings.site_name` / `site_description` | → `site.name` / `site.description`（风格包可覆盖）|
| `site_settings.footer_nav` | → `footer.columns`（风格包可覆盖）|
| `site_settings.footer_nav_columns` | → `footer.columns` 数组长度 |
| `site_settings.copyright_text` | → `site.copyright` |
| `site_settings.icp_number` / `icp_url` | → `site.icp` / `site.icpUrl` |
| `site_settings.powered_by` | → `site.poweredBy` |
| `site_settings.hero_slides` | → `hero`（数据保留在 site_settings，风格包覆盖形态/CTA）|
| `site_settings.homepage_layouts` | → `homepage` |
| `friend_links` 表 | → `footer.friendLinks.source = "table"`（风格包只控制是否显示/样式）|
| `sections.template` / `template_config` / `layouts` | → `section` |
| `categories.layouts` | → `category` |
| `articles.article_template` / `template_config` | → `article` |

---

## 四、全站动态化：组件注册表

### 4.1 为什么需要

当前 Header / Footer / Hero / HomeSections / 文章页 都是**组件硬编码**。风格包改了 JSON，但组件不消费这些字段，差异就出不来。要让"所见全变"，核心是引入**组件注册表**：每个区块组件都从风格包 config 读取声明，按声明渲染。

### 4.2 统一消费方式

所有组件通过 `useStyleConfig()` 拿到合并后的完整 style.json，按字段渲染：

```tsx
// Header.tsx — 消费 style.header
const style = useStyleConfig()
const h = style.header
// variant: sticky-solid | sticky-glass | static | hidden
// nav.source: sections | custom | mixed → 决定菜单数据
// nav.icons: 每个菜单项图标
```

```tsx
// Footer.tsx — 消费 style.footer + style.site
const style = useStyleConfig()
const f = style.footer
const s = style.site
// footer.friendLinks.show → 是否渲染友链
// site.copyright ?? settings.copyright_text → 版权文本
```

```tsx
// HeroCarousel.tsx — 消费 style.hero
const style = useStyleConfig()
const h = style.hero
// h.variant: carousel | split-left | image-only | none
// h.ctaButtons: CTA 卡片配置
```

### 4.3 首页组件注册表（核心）

```tsx
// src/lib/componentRegistry.tsx
const REGISTRY: Record<string, React.FC<any>> = {
  Hero: HeroSection,
  Features: FeaturesSection,
  ArticleList: ArticleListSection,
  CTA: CTASection,
  Banner: BannerSection,
  CustomBlock: CustomBlockSection,
}

export function registerHomepageComponent(name: string, Comp: React.FC<any>) {
  REGISTRY[name] = Comp
}

export function renderHomepageSections(sections, style) {
  return sections.map((s, i) => {
    const Comp = REGISTRY[s.component]
    if (!Comp) { console.warn(`Unknown: ${s.component}`); return null }
    const defaults = extractDefaults(style, s.component, s.variant)
    return <Comp key={i} {...defaults} {...s.props} variant={s.variant} />
  })
}
```

---

## 五、AI Agent API 规范

### 5.1 权限模型

```
读写风格包：styles:read（读：list/get/schema/playbook/diff）
            styles:write（写：PATCH/生成/preview/activate/restore/PUT/DELETE）
覆盖站点信息：经 PATCH site.* 实现，同属 styles:write 权限
安全边界：风格包只能改展示配置与站点信息覆盖，
         不能改业务数据（文章/用户/媒体/友链表数据）
```

沿用现有 `apiTokenOrAdmin`。API Token 需带 `styles:write`（改）与 `styles:read`（读）。
注意：`styles:read` 已加入 `API_PERMISSION_CATALOG`，可在后台 Token 管理授予 superadmin/admin。

### 5.2 端点清单

#### 读取

```http
### 列出所有风格包（含是否激活）
GET /api/v1/styles
→ { "data": [ { "id":"blog", "name":"科技博客风", "active":true, "preview":"..." } ] }

### 读取当前激活包的完整 style.json（单文件，Agent 首选）
GET /api/v1/styles/active
→ { "data": { ...style.json 全量... } }

### 读取指定包的 style.json
GET /api/v1/styles/:id

### 读取 JSON Schema（Agent 用来理解可配置字段 + 校验）
GET /api/v1/styles/:id/schema
→ { "data": { ...JSON Schema Draft 2020-12... } }

### 读取 ai-playbook.md（Agent 的设计约束说明书）
GET /api/v1/styles/:id/playbook
→ { "data": { "markdown": "# 少数派 ..." } }
```

#### 修改（核心：单字段原子 PATCH）

```http
### PATCH 单字段（不整包提交）
PATCH /api/v1/styles/:id
Content-Type: application/json
{
  "path": "section.layout",      // 点号路径
  "value": "sidebar-left"
}
→ 200 { "success":true, "data":{ "id":"blog", "path":"section.layout", "value":"sidebar-left" } }

### 批量 PATCH（一次提交多个字段，原子应用）
PATCH /api/v1/styles/:id
{
  "patch": [
    { "path":"header.nav.style",   "value":"split" },
    { "path":"hero.variant",       "value":"split-left" },
    { "path":"footer.friendLinks.show", "value":false }
  ]
}
→ 200 { "success":true, "applied": 3 }
```

**PATCH 校验**：
- `path` 必须在 schema 中存在（拒绝未知字段）
- `value` 必须通过该路径的 schema 校验（enum/type/format）
- 数组操作（homepage.sections 增删）用专用端点

```http
### 修改首页组件序列（数组操作）
PATCH /api/v1/styles/:id/homepage-sections
{
  "op": "insert", "index": 2,
  "element": { "component":"Features", "variant":"3-col-cards" }
}
# op 可选: insert | remove | replace | move

### 修改配色方案（批量重算 color 对象）
POST /api/v1/styles/:id/scheme
{ "mode":"dark", "accent":"#ff0000", "accentAlt":"#00ff00" }
→ 自动重算 design.color.* 所有令牌
```

#### 生成（Agent 本地 LLM → POST 完整包）

> 架构：Agent 跑在用户 **PC 本地**，用本地的 LLM 生成/修改 style.json，再通过技能调用 TokenPress **远程 API** 提交。TokenPress 后端不接任何 LLM。

```http
### 提交完整风格包（Agent 本地生成后落盘）
POST /api/v1/styles
Content-Type: application/json
{
  "id": "my-design",     // 必填，风格包 id（仅小写字母/数字/连字符）
  "style": {             // 必填，完整 style.json（Agent 本地 LLM 产出）
    "$": { "id":"my-design", "builtin":false },
    "design": { ... },
    "header": { ... },
    "footer": { ... },
    "layouts": { ... },
    "site": { ... },
    "hero": { ... },
    "features": { ... }
  }
}
→ 201 { "data": { "id":"my-design", "message":"Style pack created" } }
→ 400 校验失败（validatePack） / → 409 id 已存在
```

**Agent 侧生成工作流**（在 PC 本地完成，非后端）：
1. 调 `GET /api/v1/styles/active` 拿到当前包 + `GET /api/v1/styles/<base>/schema`（JSON Schema）+ `GET /api/v1/styles/<base>/playbook`（设计约束）。
2. 用本地 LLM（OpenAI 兼容 chat completions）基于 `schema + playbook + base 包` 生成/改写完整 style.json。
3. 本地用 `style-json.schema.json` 预校验；通过后 `POST /api/v1/styles` 提交落盘。
4. 微调用 `PATCH /:id`、`PATCH /:id/homepage-sections`；评审用 `GET /:id/diff` + `POST /:id/preview`；满意后 `POST /:id/activate` 切换激活。

> 注意：`ai-playbook.md` 目前仅对内置三包提供；自定义包可由 Agent 自行维护一份。

#### 对比 / 预览（Agent 评审）

```http
### 对比两个风格包差异（Agent 用来确认改了什么）
GET /api/v1/styles/:id/diff?target=:id2
→ { "data": { "changes": [
     { "path":"section.layout", "from":"sidebar-right", "to":"sidebar-left" },
     { "path":"header.nav.style", "from":"underline", "to":"split" }
   ] } }

### 渲染预览图（可选，Agent 改完给用户看效果；已实现，依赖 playwright-core）
POST /api/v1/styles/:id/preview
{ "view":"home|section", "patches":[ { "path":"...", "value":"..." } ], "baseUrl":"https://your-site.com" }
→ 200 { "data": { "imageUrl":"/styles/previews/<id>_<ts>.png" } }
→ 501 若未安装 playwright-core（可选依赖）
```

> 预览说明：
> - 依赖可选依赖 `playwright-core`（复用系统 Chrome/Edge，无需下载浏览器）与可访问的前端地址 `baseUrl`（渲染 SSR 用）。
> - 带 `patches` 时，会临时把 patch 写入真实包以让 SSR 读到，渲染完成后在 finally 恢复原包（**非破坏性**）。
> - 未安装 `playwright-core` 时返回 501，预览功能为可选增强，不影响其余接口。

### 5.3 Agent 工具封装（CatPaw / ACP）

```yaml
tools:
  - name: "style_pack_list"        # GET /api/v1/styles
  - name: "style_pack_read"        # GET /api/v1/styles/active
  - name: "style_pack_get_schema"  # GET /api/v1/styles/:id/schema
  - name: "style_pack_get_playbook" # GET /api/v1/styles/:id/playbook
  - name: "style_pack_patch"       # PATCH /api/v1/styles/:id  (单字段/批量)
  - name: "style_pack_edit_homepage" # PATCH .../homepage-sections  (数组)
  - name: "style_pack_create"      # POST /api/v1/styles  (提交 Agent 本地生成的完整 style.json)
  - name: "style_pack_apply_scheme" # POST /:id/scheme  (配色方案重算)
  - name: "style_pack_diff"        # GET .../diff?target=
  - name: "style_pack_preview"     # POST .../preview
  - name: "style_pack_set_active"  # POST /api/v1/styles/:id/activate
  - name: "style_pack_restore"     # POST /api/v1/styles/:id/restore (builtin)
```

### 5.4 Agent 典型任务流程（"整个站点换个风格"）

```
用户："大方向改一下，要像一个设计工作室的官网，很多留白"

Agent:
1. style_pack_read()                     ← 当前 style.json 全貌
2. style_pack_get_schema() + get_playbook() ← 可改字段 + 设计约束
3. 构造批量 patch（path 根必须是可 patch 根：site/design/header/footer/layouts/hero/features）：
   [
     { "path":"design.tokens['--radius-card']", "value":"20px" },
     { "path":"design.tokens['--accent-blue']", "value":"#111111" },
     { "path":"header.variant",        "value":"sticky-glass" },
     { "path":"header.nav.style",      "value":"split" },
     { "path":"hero.variant",          "value":"image-only" },
     { "path":"hero.height",           "value":"80vh" },
     { "path":"layouts.section.layout", "value":"none" },
     { "path":"layouts.section.list.layout", "value":"masonry" },
     { "path":"layouts.article.layout", "value":"immersive" },
     { "path":"footer.variant",        "value":"minimal" },
     { "path":"footer.friendLinks.show","value":false },
     { "path":"site.copyright",        "value":"© 2026 Studio" }
   ]
4. style_pack_patch(...) 批量提交
5. style_pack_preview(view:"home")      ← 渲染首页预览图（需 playwright-core）
6. 用户确认 / Agent 再微调
```

> 路径写法注意：`design` 下的令牌用 `design.tokens['--xxx']`（下标键）；布局路径带 `layouts.` 前缀（如 `layouts.section.list.layout`）。

### 5.5 安全校验规则（沿用并扩展现有 validate）

| 校验 | 规则 |
|------|------|
| 路径存在性 | patch.path 根必须在 PATCHABLE_ROOTS（site/design/header/footer/layouts/hero/features），拒绝 `$` 元数据 |
| 值类型 | 按目标字段校验枚举（header.nav.style、variant 等）/ 类型 |
| CSS 注入 | `design.tokens` 各值、`theme` 禁止 `url(` `@import` `javascript:` `<` `>` `expression(` |
| Logo src | 仅同源相对路径，禁 `://` 外链、禁 `..` |
| 组件白名单 | homepage.sections[].component 必须在 REGISTERED（Hero/Features/ArticleList/CTA/Banner/CustomBlock）|
| 站点信息 | site.copyright 等仅限字符串或 null，禁 HTML/脚本 |
| 权限 | 写操作需 `styles:write`、读操作需 `styles:read`；业务数据（文章/用户/媒体/友链）不可改 |

---

## 六、后端改造点

### 6.1 新模块 `apps/server/src/lib/stylePack.ts`

```ts
export interface StylePack {
  id: string
  $: Manifest
  site: SiteOverrides
  design: DesignTokens
  header: HeaderConfig
  hero: HeroConfig
  homepage: HomepageConfig
  section: SectionConfig
  category: CategoryConfig
  article: ArticleConfig
  cardGrid: Record<string, any>
  footer: FooterConfig
  features: FeatureConfig
}

// 读取：合并 5 文件 → 单对象（向后兼容旧格式）
export async function readPack(id): Promise<StylePack | null>

// 写入：单对象 → style.json
export async function writePack(id, pack)

// 深合并 site_settings 全局默认 + 风格包覆盖
export function resolveSiteInfo(siteOverrides, siteSettingsRow): SiteInfo

// PATCH：按 path 读写（复用 schema.ts 的 getIn/setIn）
export function applyPatch(pack, path, value): StylePack
export function applyPatchArray(pack, op, index, element): StylePack

// 校验
export function validatePack(pack): { ok: boolean; error?: string }
export function validatePatch(pack, path, value): { ok: boolean; error?: string }
```

### 6.2 styles.ts 路由改造

- `GET /active` → 返回**合并后**的单 style.json（含 site 覆盖解析）
- 新增 `PATCH /:id`（单字段 + 批量）、`PATCH /:id/homepage-sections`（数组增删改移）
- 新增 `GET /:id/schema`、`GET /:id/playbook`
- 新增 `POST /`（直接提交 Agent 本地生成的完整 style.json）
- 新增 `GET /:id/diff`、`POST /:id/preview`
- 新增 `POST /:id/activate`（切换激活包）、`POST /:id/scheme`（配色方案重算）
- 已有 `POST /:id/restore`（内置包恢复默认）

### 6.3 前端消费改造

| 组件 | 改动 |
|------|------|
| `StyleProvider.tsx` | 读取合并后的 style.json；新增 `useStyleConfig()` 暴露全量；新增 `useStyleSite()` |
| `Header.tsx` | `site_name` 读 `style.site.name ?? settings.site_name`；nav.source 切换菜单数据源 |
| `Footer.tsx` | copyright/ICP/poweredBy 读 `style.site.* ?? settings.*`；friendLinks.show 控制友链渲染 |
| `HeroCarousel.tsx` | 消费 `style.hero`（variant/position/ctaButtons/height）|
| `HomeSections.tsx` | 改为 `renderHomepageSections(style.homepage.sections, style)` |
| `SectionPageClient.tsx` | 消费 `style.section` + `style.section.subcategory` |
| `ArticleTemplateRenderer.tsx` | 消费 `style.article` |
| `app/layout.tsx` | `<title>`/`<meta description>` 读合并后的 site |

---

## 七、实现路线图

### Phase 0 — 基础（可独立交付，不破坏现有功能）

- [ ] 定义 `style-json.schema.json`（全量字段 JSON Schema）
- [ ] 后端 `lib/stylePack.ts`：读取（兼容旧 5 文件格式）+ 写入 + 合并 site_settings + PATCH
- [ ] `GET /active` 返回单文件合并格式（向后兼容旧字段）
- [ ] `PATCH /:id`（单字段 + 批量）+ schema 校验
- [ ] 现有三包迁移到 style.json 单文件（保留旧文件做兼容）

### Phase 1 — 站点信息覆盖生效

- [ ] `StyleProvider` 增加 `useStyleSite()`；合并 site_settings 默认
- [ ] Header：`site_name` 读覆盖值
- [ ] Footer：copyright/ICP/poweredBy 读覆盖值；`friendLinks.show` 控制友链
- [ ] `app/layout.tsx`：`<title>`/`<meta>` 读覆盖值
- [ ] 三包差异化验证：切换包后 Header/Footer 站点信息随之变化

### Phase 2 — 全站动态化（组件消费 style config）

- [ ] 实现 `componentRegistry.tsx` + HomeSections 改造
- [ ] HeroCarousel 消费 `style.hero`（variant/CTA）
- [ ] SectionPageClient 消费 `style.section` + subcategory
- [ ] ArticleTemplateRenderer 消费 `style.article`
- [ ] Header variant 支持 sticky-glass/hidden；Footer 支持 mega
- [ ] 视觉验收：三包在首页/板块/文章各 ≥3 处可见差异

### Phase 3 — AI Agent 集成

- [x] `GET /:id/schema`、`GET /:id/playbook`
- [x] `PATCH /:id`（单字段/批量）、`PATCH /:id/homepage-sections`（数组）
- [x] `POST /`（提交 Agent 本地生成的完整 style.json，后端校验落盘）
- [x] `GET /:id/diff`、`POST /:id/preview`（依赖可选 playwright-core）
- [x] `POST /:id/activate`、`POST /:id/scheme`、`POST /:id/restore`
- [ ] `ai-playbook.md` 后端模板化自动生成（当前仅内置三包手写）
- [ ] CatPaw / ACP tool 封装（在 CatPaw 侧注册为工具）

### Phase 4 — DB 清理与后台

- [ ] 标记 `active_theme`/`default_theme` deprecated
- [ ] 取消 `sections.template/layouts`、`categories.layouts` 在非 admin 路径使用
- [ ] admin 设置"外观" tab 合并到风格包 tab

---

## 八、三套差异化包设计要点

### blog — 科技博客（保留）
- Header: sticky-glass 毛玻璃 + underline
- Hero: split-left 左文右图
- 首页: Hero → 轮播列表 → CTA
- 板块: sidebar-right + grid-3
- 文章: two-column + TOC 右侧栏
- Footer: multi-column 3 列 + 友链行

### enterprise — 科技企业官网
- Header: sticky-solid + 文字 Logo + 高 72px
- Hero: standard 单张大图 + 双 CTA
- 首页: Hero → Features → 数据 Banner → CTA → grid-2
- 板块: sidebar-left + 标签切换二级分类 + grid-2
- 文章: single + 顶部 cover 大图
- Footer: multi-column 4 列

### design — 设计师作品集
- Header: sticky-glass + split 居中 Logo + 极简操作
- Hero: image-only 满屏大图
- 首页: Hero → 瀑布流（几乎只有两个区块）
- 板块: none 零边栏 + masonry 瀑布流
- 文章: immersive 沉浸式无边栏
- Footer: minimal 极简单行（不显示友链）

**差异点明确**：enterprise 方形卡片+黑+左栏+标签；design 衬线字+20px 圆角+零边栏+瀑布流+沉浸式；blog 毛玻璃+右栏+轮播。

---

## 九、总结

本方案让风格包成为**全站所见即所得的唯一入口**：

| 需求 | 覆盖方式 |
|------|---------|
| Header 菜单（样式/图标/位置） | `header.nav.*` |
| 站点信息（名称/描述/标题格式） | `site.name/description/titleFormat` |
| Hero 位置/是否显示/CTA 卡片 | `hero.*` |
| 板块样式/布局/二级分类位置与样式 | `section.*` + `section.subcategory.*` |
| 文章样式 | `article.*` |
| **底部菜单** | `footer.columns[]` |
| **站点信息（版权/ICP/Powered by）** | `site.*` |
| **友链（是否显示/数据源/样式）** | `footer.friendLinks.*` |
| 首页整体结构 | `homepage.sections[]` + 组件注册表 |

**AI Agent**：通过 `style_pack_read / patch / create / diff / preview / set_active` 等工具，读 schema + playbook → 生成/修改 style.json → 校验 → 渲染预览 → 激活。

**关键权衡**：
- 风格包是覆盖层，不是数据源 → 站点信息保留 site_settings 默认，风格包可覆盖
- 内容数据与展示配置分离 → 风格包控制"如何展示"，不存业务数据
- 单文件 JSON → Agent 读写简单，schema 校验保证安全
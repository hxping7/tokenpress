# TokenPress 灵活前端模板（Style Pack）设计方案

> 状态：模板包文件已落地（Phase B 完成：blog / enterprise / design 三包）；渲染引擎 Phase A（StyleProvider + 组件配置化）待实现。
> 范围：在不改动业务源码的前提下，通过「样式目录 + 配置文件」驱动前端布局与配色，支持不同客户群体（首批：博客 blog / 企业站 enterprise / 设计师站 design），并可通过远程 AI API 上传新模板包。
> 决策记录：文件系统存储；首批 blog + enterprise + design 三包（blog 为默认）；单站、无多租户；后台设置风格；板块页布局可配置；Logo 资源保持现有存储、模板仅控制显示。

---

## 1. 背景与目标

TokenPress 当前首页、文章页、板块页的布局与配色由组件代码 + 5 套主题（light/night/cyber/lava/space）决定。5 套主题本质是「换肤」（仅改 CSS 颜色变量），无法改变布局结构、Header/Footer 组合、板块页形态。

目标：引入 **Style Pack（样式模板包）** 概念——一个目录包含布局、配色、Header、Footer 的完整定义。切换模板包 = 纯配置变更，无需改组件代码（首次需一次性把组件改造为「读配置渲染」）。新增第三种客户风格，只需上传一个新目录，不碰源码。

---

## 2. 与现有 5 套配色的关系（关键澄清）

两者**正交、可组合**，不是替代关系：

- **5 套主题（light/night/cyber/lava/space）= 配色皮肤**：只换 CSS 颜色变量（`--color-primary` 等），不动布局、结构、Header/Footer 组合。
- **Style Pack（blog / enterprise / design）= 模板（换骨 + 换肤）**：决定首页 section 顺序与版式、文章页单栏/双栏、板块页形态、Header/Footer 组合与整体设计语言，并自带一套「出厂配色」（theme.css）。`blog` 为站点默认（复刻现有科技博客风），`enterprise` 为企业官网，`design` 为设计师作品集。

后台是两个独立旋钮，自由组合：

| 旋钮 | 字段 | 取值 | 控制范围 |
|---|---|---|---|
| 模板/布局 | `activeStyle` | `blog`（默认）\| `enterprise` \| `design` | 骨架：布局结构 + Header/Footer 组合 |
| 配色皮肤 | `activeTheme` | `light` \| `night` \| `cyber` \| `lava` \| `space` | 涂装：仅颜色变量（可叠加在模板出厂配色之上做微调） |

示例：「企业骨架 + 深空蓝(cyber)配色」完全成立。`useThemeStore` 现有 5 主题继续复用，从「全局皮肤」降级为「模板内的配色微调选项」。

---

## 3. 存储策略：直接文件（文件系统）

- **目录约定**：`apps/web/public/styles/<id>/`，首批三个包：`styles/blog/`、`styles/enterprise/`、`styles/design/`（均已完成）。
- **Docker 持久化**（关键）：该目录在容器内必须是**挂载卷**（如 `/data/styles`），否则容器重建后上传的包会丢失。部署时加一步「首次启动把镜像内建的 `blog/enterprise/design` 拷贝进卷」，之后内置 + 上传的统一以卷为唯一源。
- **前端不 import、只 fetch**：Style Pack 配置由后端 API 从文件系统读取后返回，Next 构建期不依赖它们，规避构建耦合。
- **静态资源（背景图/栏目图等）**：由 nginx/express 从卷路径以 `/styles/<id>/...` 对外服务，不走 Next `public` 构建。
- **Logo 例外（重要）**：Logo 资源文件**保持项目现有存储结构**（沿用 `site_settings.logo` / 媒体库位置，**不搬入**模板包 `assets/` 目录）。模板包仅在 `header.json` 中**引用现有路径**并控制其显示——即「用哪个 logo + 在 Header 内的位置 + 尺寸」。模板包不负责存放/复制 Logo 二进制。

> 注：可选的「纯库存储」方案（新 `styles` 表存 JSON）本次不选，保持与用户心智模型 `/styles/<id>/` 一致；若未来需要多租户再迁移。

---

## 4. 模板包目录与配置文件

```
styles/blog/                      styles/enterprise/                styles/design/
├── manifest.json                  ├── manifest.json                ├── manifest.json        # 元数据
├── theme.css                      ├── theme.css                    ├── theme.css              # 设计令牌（配色/字体/圆角/阴影/容器）
├── layouts.json                   ├── layouts.json                 ├── layouts.json           # 各页面布局（首页/板块页/文章页/列表）
├── header.json                    ├── header.json                  ├── header.json            # Logo(引用现有) + 导航 + 动作
├── footer.json                    ├── footer.json                  ├── footer.json            # 页脚栏目 + 配色
└── assets/                       └── assets/                      └── assets/                 # 包内静态资源（背景图/栏目图等；Logo 不在此，见 §3）
```

### 4.1 manifest.json

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一标识，必须匹配 `^[a-z0-9-]+$`（同时用作目录名与防路径穿越） |
| `name` | string | 展示名，如「企业官网风格」 |
| `description` | string | 简述适用场景 |
| `version` | string | 语义化版本 |
| `author` | string | 作者 |
| `preview` | string | 预览图 URL，如 `/styles/enterprise/preview.png` |
| `builtin` | boolean | 是否内置包（内置包受保护，禁止 DELETE） |
| `tags` | string[] | 标签，便于检索 |

```json
{
  "id": "enterprise", "name": "企业官网风格",
  "description": "适合 B2B 企业站的稳重布局",
  "version": "1.0.0", "author": "token00",
  "preview": "/styles/enterprise/preview.png",
  "builtin": true, "tags": ["enterprise", "b2b"]
}
```

### 4.2 theme.css（设计令牌）

仅允许 `:root { --var: value }` 声明（服务端校验，防注入）。完整令牌集：

```css
:root{
  /* 颜色 */
  --color-primary:#1e40af;        --color-primary-hover:#1e3a8a;  --color-primary-soft:#eff6ff;
  --color-accent:#0ea5e9;
  --color-bg:#ffffff;             --color-surface:#f8fafc;        --color-surface-2:#f1f5f9;
  --color-text:#0f172a;           --color-text-muted:#64748b;     --color-border:#e2e8f0;
  --color-link:#1e40af;
  /* 字体 */
  --font-sans:"Inter","PingFang SC",system-ui,sans-serif;
  --font-heading:"Inter",sans-serif;
  --text-base:16px;  --text-sm:14px;  --text-lg:18px;  --text-xl:24px;
  --leading-base:1.7;  --heading-weight:700;
  /* 圆角 / 阴影 */
  --radius-sm:4px;  --radius-md:8px;  --radius-lg:12px;  --radius-xl:16px;
  --shadow-card:0 1px 3px rgba(0,0,0,.08);  --shadow-lg:0 8px 24px rgba(0,0,0,.12);
  /* 布局 */
  --container-max:1200px;  --content-max:720px;  --header-height:64px;  --gap-grid:24px;
  /* 动效 */
  --transition-base:150ms ease;
}
```

### 4.3 layouts.json（页面布局，核心）

```json
{
  "homepage": {
    "container": "boxed",
    "sections": [
      { "component":"Hero",       "variant":"split-image-right", "props":{"showStats":true} },
      { "component":"Features",   "variant":"3-col-cards" },
      { "component":"ArticleList","variant":"grid-3", "props":{"source":"latest","limit":6} },
      { "component":"CTA",        "variant":"banner" }
    ]
  },
  "section": {
    "layout": "page-sidebar-left",
    "hero":   { "enabled":true, "titleFrom":"section", "showCover":true, "description":true },
    "sidebar":{
      "enabled":true, "position":"left",
      "source":"categories", "title":"栏目导航", "showCounts":true, "sticky":true,
      "customItems":[]
    },
    "content": {
      "type":"featured-article",
      "source":"latest",
      "articleSlug":""
    }
  },
  "article": {
    "layout":"single", "showTOC":false, "showAuthor":true,
    "sidebar":"related", "maxWidth":720
  },
  "list": { "layout":"grid", "columns":3 }
}
```

**字段说明**

`homepage`：
- `container`：`boxed`（限宽居中）| `full`（通栏）
- `sections[]`：按数组顺序渲染已注册区块组件。`component` 必须在后端「已注册组件白名单」内；`variant` 选该组件的变体；`props` 透传给组件。

`section`（板块页，本次新增可配置）：
- `layout`：
  - `article-list`：主区显示**文章缩略图列表**（grid/list/masonry），即当前默认形态；
  - `page-sidebar-left` / `page-sidebar-right`：**网站页形态**——主区显示「内容」（见 `content`，**非列表/缩略图**），左/右为二级目录菜单（见 `sidebar`）；
  - `landing`：纯落地页（Hero + 功能块 + CTA），弱化列表。
- `hero`：板块页顶部标题区（标题取板块名或自定义、封面、简介）。
- `sidebar`：二级目录菜单（仅 `page-sidebar-*` 生效）。**首批 `source` 用 `categories`**——即该板块下的分类作为二级目录菜单项。
  - `position`：`left` | `right`
  - `source`：`categories`（取该板块下分类为二级目录，首批采用）| `subsections`（取子板块）| `custom`（用 `customItems` 手动定义）
  - `showCounts` / `sticky`：是否显示数量、是否吸顶
- `content`（`page-sidebar-*` 主区内容，**不是列表/缩略图**）：**首批 `type:"featured-article"`**——展示一篇文章正文。
  - `type`：`featured-article`（展示一篇文章正文）| `static-page`（展示指定 statichtml 静态页）| `none`
  - `source`：`latest`（该板块最新/首篇）| `featured`（精选）| `specific`（指定，用 `articleSlug`）
  - `articleSlug`：`source:"specific"` 时指定文章
- `list`（`article-list` 布局的主区列表版式）：`layout`(grid/list/masonry)、`columns`、`showThumbnail`、`showExcerpt`

> 你描述的「点击板块显示一个网站页面，左边或右边菜单（二级目录）」即 `page-sidebar-left / right`。当前默认 `article-list` 保持不变。

`article`：
- `layout`：`single`（单栏宽版）| `two-column`（双栏 + 悬浮 TOC）| `wide`（宽屏）| `magazine`（杂志式）
- `showTOC` / `showAuthor` / `sidebar`（`related` | `none`）/ `maxWidth`

`list`：文章/搜索列表的全局版式。

### 4.4 header.json

```json
{
  "variant":"sticky-solid",
  "logo": {
    "type":"image",
    "src":"/uploads/logo.svg",
    "text":"Token00",
    "position":"left",
    "height":36,
    "link":"/"
  },
  "nav":  { "align":"right", "style":"pill", "source":"sections", "customItems":[] },
  "actions": [ { "label":"联系我们", "href":"/contact", "type":"button-primary" } ],
  "background":"var(--color-bg)",
  "borderBottom":"1px solid var(--color-border)"
}
```

**Logo 说明（关键）**：Logo 资源文件保持在项目**现有存储结构**（`site_settings.logo` / 媒体库），**不随模板包搬运、不复制进包内 `assets/`**。`logo.src` 仅**引用现有路径**（如 `/uploads/logo.svg`）；模板控制的是「用哪个 logo + 在 Header 内的位置 + 尺寸」。`type:"text"` 时不引用文件，直接渲染文字 Logo（如设计站用文字标）。

| 字段 | 说明 |
|---|---|
| `variant` | `sticky-solid`（实色吸顶）\| `sticky-transparent`（透明悬浮）\| `static`（静态） |
| `logo.type` | `image`（用 `src` 引用现有文件）\| `text`（用 `text` 渲染文字 Logo） |
| `logo.src` | Logo 文件**现有存储路径**引用（如 `/uploads/logo.svg`），模板不搬运文件 |
| `logo.position` | `left` \| `center` \| `right`（Logo 在 Header 内的水平位置） |
| `logo.height` | 尺寸（px），控制 Logo 显示高度 |
| `logo.text` | `type:"text"` 时的文字 Logo 内容 |
| `nav.align` | `left` \| `center` \| `right` |
| `nav.style` | `underline` \| `pill` \| `plain` |
| `nav.source` | `sections`（取板块导航）\| `custom`（用 customItems） |
| `actions[]` | Header 右侧动作按钮（CTA） |

### 4.5 footer.json

```json
{
  "variant":"multi-column",
  "columns":[
    { "title":"产品", "links":[ {"label":"功能","href":"/p/features"} ] },
    { "title":"公司", "links":[ {"label":"关于","href":"/about"} ] }
  ],
  "bottom": { "copyright":"© 2026 Token00 Inc.", "social":["github","wechat"], "showBackToTop":true },
  "background":"var(--color-surface)",
  "textColor":"var(--color-text-muted)"
}
```

| 字段 | 说明 |
|---|---|
| `variant` | `multi-column`（多栏）\| `simple`（简版）\| `minimal`（极简单行） |
| `columns[]` | 每栏标题 + 链接列表 |
| `bottom.social` | 社交图标标识数组 |
| `background` / `textColor` | 直接引用 theme.css 变量 |

---

## 5. 三个模板包差异定义（首批）

| 维度 | **blog（默认·科技博客）** | **enterprise（企业官网）** | **design（设计师作品集）** |
|---|---|---|---|
| 出厂主色 | 深空蓝青 `#0ea5e9` + 浅底 | 稳重藏蓝 `#1e40af` + 中性灰 | 深空蓝青渐变 `#0ea5e9→#6366f1`（深底高对比） |
| Logo（资源） | 引用现有 `/uploads/logo.svg`，**左置、高 36px** | 引用现有 `/uploads/logo.svg`，**左置、高 36px** | 文字 Logo「Token00」**居中**（或用现有文件） |
| 首页结构 | Hero 轮播 → 文章网格(9) | Hero 图文左文右图 → 数据指标条 → 功能 3 栏卡片 → 文章精选网格 → CTA 横幅 | 全屏 Hero → 作品 masonry 网格 → 文章流 → 极简 Footer |
| 板块页 | `article-list`（文章缩略图列表，默认形态） | `page-sidebar-left`（左二级目录=分类 + 主区=首篇精选文章正文） | `article-list`（masonry 作品网格） |
| 文章页 | `two-column` 双栏 + TOC + 相关阅读 | `single` 单栏宽版 720px + 作者卡 + 相关阅读 | `magazine` 双栏 + 悬浮 TOC + 大图封面 |
| Header | `sticky-solid`、下划线导航、左置 Logo | `sticky-solid`、胶囊导航、右置「联系我们」按钮 | `sticky-transparent`、下划线导航、Logo 居中 |
| Footer | `simple` 简版单栏 | `multi-column` 3 栏 + 社交图标 | `minimal` 单行 + 大字 Logo |
| 气质 | tech / clean / readable | trust / professional / B2B | creative / bold / portfolio |

---

## 6. 渲染机制（如何做到「不改源码切换」）

1. 根布局加 `StyleProvider`（client component）：拉取 `activeStyle` 完整配置（theme/layouts/header/footer）+ `activeTheme` 配色，注入 `<head>` 的 `:root` 变量（**SSR 阶段注入防闪烁**）。
2. 页面组件改为**配置消费型**（一次性重构，之后零改码）：
   - `Home` 循环渲染 `layouts.homepage.sections[]`；
   - `SectionPageClient` 读 `layouts.section`，按 `layout` 渲染文章列表或「侧栏 + 主区」网站页；
   - `Header` / `Footer` 读各自 JSON；
   - 文章页读 `layouts.article.layout` 决定单栏/双栏/杂志式。
3. **组合**：`activeStyle` 提供骨架 + 出厂配色，`activeTheme` 再覆盖颜色变量。
4. 切换：后台写 `activeStyle` → 全站即时换骨换肤。

> **诚实边界**：「不改源码」指上线后切 enterprise/design、或新增第三包纯配置；首次把组件改成「读配置渲染」是一次性重构投入。

**进阶（可选，灵活度拉满）**：`layouts.section.layout` 是全局默认；若需「不同板块不同布局」，可在 `sections` 表加 `pageLayout` 字段做单板块覆盖（如「关于我们」用 `landing`，「博客」用 `article-list`）。

---

## 7. 后台设置风格（单站、无多租户）

- `site_settings` 表新增 `activeStyle` 字段（默认 `blog`），保留现有 `activeTheme`。
- 管理后台新增「**风格 Style**」设置块：三张包卡片（带 `preview` 预览图，blog/enterprise/design），点击即激活；下方保留现有「配色主题」下拉（5 选 1）。
- 激活即写 `activeStyle`，无需重启。

---

## 8. 远程 AI API 规范（上传 = 写文件）

**鉴权**：直接复用后台现有 token API 权限控制（`apiTokenOrAdmin` 中间件），**不新建鉴权体系**。「权限白名单」即 `routes/tokens.ts` 中已有的 `validPermissions` 枚举；styles 端点只需往该枚举**追加两个值**，由中间件统一校验（角色约束沿用现有 `allowedByRole`，如 `styles:write` 按 `settings:write` 同级处理为 admin+）：
- `styles:write`：创建 / 更新 / 删除模板包
- `styles:read`：列出 / 获取模板包
- `settings:write`：已可写 `activeStyle` 激活（复用现有 `/api/v1/site-settings`，无需新权限）

请求头：`Authorization: Bearer t00_sk_xxx`；curl 需带 `-A 'Mozilla/5.0'`（反爬）。

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/api/v1/styles` | 列全部包（元数据 + 是否激活） |
| GET | `/api/v1/styles/:id` | 从文件系统读某包完整配置返回 |
| POST | `/api/v1/styles` | 写 `styles/<id>/{manifest,theme.css,layouts.json,header.json,footer.json}` |
| PUT | `/api/v1/styles/:id` | 局部覆盖（如只改 theme.css） |
| DELETE | `/api/v1/styles/:id` | 删自定义包（`builtin:true` 受保护） |
| PUT | `/api/v1/site-settings` | 写 `activeStyle` 激活（复用现有接口） |

**新建示例（POST /api/v1/styles）**
```json
{
  "manifest": { "id":"enterprise", "name":"企业官网风格", "version":"1.0.0",
                "preview":"/styles/enterprise/preview.png", "builtin":true },
  "theme": ":root{--color-primary:#1e40af;...}",
  "layouts": { "homepage":{...}, "section":{...}, "article":{...}, "list":{...} },
  "header": { "variant":"sticky-solid", ... },
  "footer": { "variant":"multi-column", ... }
}
```

**资源文件**（logo/背景图）：走 `POST /api/v1/media`（`media:upload`）或 styles 上传用 multipart 附带 `assets[]`，落到包内 `assets/`。

**服务端校验**
- `<id>` 必须匹配 `^[a-z0-9-]+$`，禁止 `..` 路径穿越；
- `theme` 仅允许 `:root{ --var: value }` 声明，过滤 `<script>`/`@import`/url() 等；
- `header.logo.src` 仅允许引用**同源/现有存储路径**（如 `/uploads/...`），禁止外域 URL 与 `..` 穿越，避免资源注入；
- `layouts` 中 `component` 必须在「已注册组件白名单」内（防止渲染未知组件）；
- `builtin:true` 的包拒绝 DELETE；
- 写盘落卷（`/data/styles/<id>/`），前端经 API 读取、静态资源经 nginx 反代 `/styles/<id>/`。

---

## 9. 落地阶段（已剔除多租户）

- **A 组件配置化**：把 Home / SectionPage / Article / Header / Footer 改造为「读配置渲染」；实现 `StyleProvider` + `site_settings.activeStyle`；SSR 注入变量防闪烁。
- **B 落地三包 + 存储**：创建 `blog`/`enterprise`/`design` 三包文件（已于 `apps/web/public/styles/` 落地）；Docker 卷挂载 `/data/styles` + 首次初始化拷贝内置包；nginx 反代 `/styles/`。
- **C 后台 + API**：实现 styles 文件系统 API（鉴权直接复用现有 token 权限：在 `routes/tokens.ts` 的 `validPermissions` 白名单追加 `styles:write`/`styles:read`，由 `apiTokenOrAdmin` 中间件统一校验）+ 后台「风格」设置块。
- **D 远程验证**：用 AI 代理远程上传第三个包，验证「纯配置上线新风格」闭环。

---

## 10. 待评审 / 开放问题

1. ~~板块页二级目录数据来源~~ **已确认**：侧栏二级目录 = 该板块下的**分类**（`source:"categories"`）；主内容区 = **首篇精选文章正文**（`content.type:"featured-article"`，`source:"latest"`），即「点击板块显示内容页而非列表」。本期不做 `subsections` 嵌套板块。
2. ~~`design` 包默认深底高对比是否要浅色版~~ **已确认（路线 B）**：**不单独建浅色 design 包**。design 出厂为深底高对比，浅色需求靠 `activeTheme=light` 叠加到同一布局上实现（包保持 3 个：blog/enterprise/design）。待 Phase A 接入渲染后实测 `design + light` 观感，若覆盖后变量冲突明显，再微调 `light` 主题变量，不新增包。
3. 是否要在首批就做「按板块单独覆盖 `pageLayout`」，还是先全局默认？
4. ~~预览图来源~~ **已确认**：最终由**运行时截图**（平台按 `activeStyle` 对线上页面截图回填 `preview`）；**当前阶段先用「渲染图」占位**——为三包各生成一张体现首页形态的预览渲染图，落到 `styles/<id>/preview.png`，供后台风格卡片展示。不阻塞方案评审与 Phase A 实现。

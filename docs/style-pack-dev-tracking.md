# TokenPress Style Pack 开发验收文档

> 关联设计文档：`docs/style-pack-design.md`
> 用途：跟踪 Style Pack 功能开发进度、验收标准与问题/风险。
> 维护方式：每完成一项，把对应 `[ ]` 改为 `[x]`；新问题填入第 5 节。

## 状态标记约定

| 标记 | 含义 |
|---|---|
| ⬜ 待开始 | 尚未动工 |
| 🔵 进行中 | 正在开发 |
| ✅ 已完成 | 代码落地，待验收 |
| ✔ 已验收 | 通过验收标准（第 4 节） |
| 🚫 阻塞 | 被依赖/问题卡住 |
| 🔶 风险 | 已知风险，需关注 |

---

## 1. 里程碑总览

| 阶段 | 名称 | 状态 | 完成度 | 备注 |
|---|---|---|---|---|
| 设计 | 方案与配置 Schema | ✔ 已验收 | 100% | `style-pack-design.md` 已定稿，4 项开放问题已确认 3 项 |
| Phase B | 三包配置文件落地 | ✔ 已验收 | 100% | blog/enterprise/design 各 6 文件 + 预览图 |
| Phase A | 渲染引擎接入（改源码） | ✅ 已完成 | 100% | 后端 API + 前端 Provider/组件 + 后台设置块 + 本地 Docker 全链路验收 19/19 通过 |
| Phase C | 权限与 API 终态 | ✔ 随 Phase A | 100% | `styles:write`/`styles:read` 已接入 token 权限白名单，API 终态落地 |
| Phase D | 远程 AI 上传验证 | ✔ 已验收 | 100% | `styles:write` token 上传第四包并生效、激活切换全站换骨换肤、无权限写接口被拒 403，均已在本地 Docker 验证通过 |
| Phase E | 板块级布局覆盖 | 🔵 代码完成 | 待验收 | 见下方 2.5 |

---

## 2. 任务清单

### 2.1 设计阶段（已完成）

- [x] 确定存储策略：文件系统 `apps/web/public/styles/<id>/`
- [x] 确定与现有 5 配色正交（`activeStyle` + `activeTheme` 两层旋钮）
- [x] 确定首批三包：blog（默认）/ enterprise / design
- [x] 确定板块页可配置（`page-sidebar-*` 网站子页形态）
- [x] 确定 Logo 资源不搬包、仅控制位置/尺寸
- [x] 确定 design 浅色靠 `activeTheme=light` 叠加（路线 B）
- [x] 确定预览图当前用渲染图占位、最终运行时截图
- [x] 确定 API 复用现有 token 权限白名单（追加 `styles:write`/`styles:read`）

### 2.2 Phase B — 三包配置文件（已完成 ✔）

- [x] 创建 `apps/web/public/styles/{blog,enterprise,design}/` 目录
- [x] 每包 5 配置文件：`manifest.json` / `theme.css` / `layouts.json` / `header.json` / `footer.json`
- [x] 三包 `preview.png` 渲染图生成并归位
- [x] `style-pack-design.md` 同步为三包（状态/旋钮/目录/差异表/默认风格/Phase）

### 2.3 Phase A — 渲染引擎接入（待开始，需改源码）

**后端**
- [x] `site_settings` 表新增 `activeStyle` 字段（默认 `blog`）— 经 `GET/PUT /site-settings` 的 `active_style` key 读写（无需改表结构）
- [x] 新增 `GET /api/v1/styles` — 列全部包（元数据 + 是否激活）
- [x] 新增 `GET /api/v1/styles/:id` — 从文件系统读某包完整配置
- [x] 新增 `POST /api/v1/styles` — 写文件（manifest/theme.css/layouts.json/header.json/footer.json）
- [x] 新增 `PUT /api/v1/styles/:id` — 局部覆盖（如只改 theme.css）
- [x] 新增 `DELETE /api/v1/styles/:id` — 删自定义包（内置包受保护）
- [x] `routes/tokens.ts` 的 `validPermissions` 追加 `styles:write` / `styles:read`
- [x] 服务端校验：id 正则 `^[a-z0-9-]+$` 防穿越；`theme` 仅允许 CSS 变量声明；`layouts.component` 必须在注册组件白名单；`header.logo.src` 仅同源/现有路径

**前端**
- [x] 新增 `StyleProvider`：拉取 `activeStyle` 完整配置 + `activeTheme`，SSR 注入 `:root` 变量防闪烁，配置进 React Context
- [x] `Home` 改造为配置消费型（循环渲染 `layouts.homepage.sections[]`）
- [x] `SectionPageClient` 改造为配置消费型（支持 `article-list` / `page-sidebar-*` / `landing`）
- [x] `Article` 页改造为配置消费型（单栏/双栏/杂志式由 `layouts.article.layout` 决定）
- [x] `Header` 改造为配置消费型（读 `header.json`：variant/logo 位置尺寸/nav/actions）
- [x] `Footer` 改造为配置消费型（读 `footer.json`）
- [x] 管理后台新增「**风格 Style**」设置块：三包卡片 + 预览图，点击激活；保留现有「配色主题」下拉

**部署**
- [x] Docker 卷挂载 `tokenpress-styles`，首次启动由 `initBuiltinStyles` 拷贝内置三包进卷（仅缺失时拷贝，不覆盖用户包）
- [x] nginx 反代 `/styles` 对外服务静态资源（走 backend 持久卷）
- [x] 验证容器重建后上传包不丢（本地 Docker 验证：上传 agency 包 → 重建 backend 容器 → 包与 active_style 均保留）

### 2.4 Phase D — 远程 AI 上传验证（已完成 ✔）

- [x] 用带 `styles:write` 的 `t00_sk_` token 调 `POST /api/v1/styles` 上传第四包（agency，201）
- [x] 验证上传即生效、切换 `activeStyle` 全站换骨换肤（homepage 200，active=agency）
- [x] 验证权限不足（无 `styles:write`）被拒（只读 token POST/DELETE 均 403）

### 2.5 Phase E — 板块级布局覆盖 + 首页单独控制（代码完成 🔵）

- [x] DB 迁移 0017：`sections` 表增加 `layouts TEXT` 列（nullable）
- [x] Drizzle schema 更新：`sections.layouts` 字段
- [x] Backend sections API：GET 返回 layouts（JSON 解析）、POST/PUT 接受并校验
- [x] Styles API `/active`：自动从 `siteSettings.homepage_layouts` 深合并首页布局
- [x] 前端解析工具：`lib/resolveLayout.ts` — `resolveSectionLayout(override, global, key)`
- [x] SectionPageClient：接收 `sectionLayouts` prop → 解析 section 布局覆盖
- [x] ArticleDetailClient：接收 `sectionLayouts` prop → 解析 article 布局覆盖
- [x] 页面 Server：`[section]/page.tsx` 和 `[slug]/page.tsx` 从 API 获取板块 layouts 传入
- [ ] 本地 Docker 验证（迁移 + API + 渲染 + 回退全链路）

**解析链**：
```
板块 DB layouts.{section,article,list}  ──→ 覆盖全局包默认
          null / 缺失                      ──→ 回退全局 layouts.json
首页 siteSettings.homepage_layouts        ──→ 覆盖全局包 homepage
          null / 缺失                      ──→ 回退全局 layouts.json
```

**权限**：
- 板块 layouts 写：`sections:write` token（已有）
- 首页 `homepage_layouts` 写：`settings:write` token（已有，通过 site-settings API）

---

| 编号 | 功能点 | 验收条件（可勾选） |
|---|---|---|
| AC-1 | 风格切换 | 后台切到 enterprise，全站布局 + 出厂配色即时变更，无需重启/重建 |
| AC-2 | 与配色正交 | enterprise 布局下切 `activeTheme=light/night/...` 仅换颜色、不动布局 |
| AC-3 | 板块页（企业） | 点板块进入网站子页：左二级目录 = 该板块分类；主区 = 首篇精选文章正文（非列表） |
| AC-4 | 板块页（博客） | 点板块显示文章缩略图列表（现状保持） |
| AC-5 | 文章页差异 | enterprise 单栏 720 + 作者卡；design 杂志双栏 + 大图 |
| AC-6 | Logo 控制 | 三包引用现有 `/uploads/logo.svg`（design 用文字 Logo），位置/尺寸由 header.json 控制，文件不搬包 |
| AC-7 | 远程上传 | 带 `styles:write` 的 token 可 `POST /api/v1/styles` 上传新包并生效 |
| AC-8 | 权限隔离 | 无 `styles:write` 的 token 访问写接口被 403；读接口需 `styles:read` |
| AC-9 | 安全校验 | id 含 `..` 被拒；theme 含 `<script>`/`@import` 被拒；未知 component 被拒 |
| AC-10 | 持久化 | 容器重建后，上传的自定义包与内置三包均不丢 |

---

## 4. 问题 / 风险日志

| ID | 日期 | 类型 | 描述 | 状态 | 解决方案 / 备注 |
|---|---|---|---|---|---|
| R-1 | 2026-07-14 | 风险 | `design + light` 配色叠加后变量可能冲突（design 出厂深底，light 浅底变量覆盖效果未实测） | ✔ 实测通过 | 经正确 cookie `token00_theme=light` 触发 SSR 注入 `style-theme-override`（light 变量 `--bg-primary:#ffffff` 覆盖 design 深底 `#050b1a`），无冲突、无破版；注意覆盖层由 cookie 名 `token00_theme` 驱动，非 `theme` |
| R-2 | 2026-07-14 | 风险 | Docker 卷挂载若未做首次拷贝，内置三包在空卷下缺失 | ✔ 已确认 | `initBuiltinStyles` 首拷已验证：内置三包在空卷/重建卷下均存在；自定义包（如 agency）容器重建后亦不丢 |
| R-3 | 2026-07-14 | 已实现 | 「按板块单独覆盖 `pageLayout`」：`sections.layouts` DB 列 + `resolveSectionLayout` 解析链。支持 section/article/list 三键覆盖 + 首页 `homepage_layouts` 单独控制 | ✅ 已实现 | 见第 4 节 Phase E |
| B-1 | 2026-07-14 | 缺陷(已修复) | blog/enterprise/design 三套 `footer.json` 引用了 `theme.css` 中**不存在**的 `--color-surface`/`--color-bg`/`--color-text-muted`，`Footer.tsx` 直接消费 → 页脚背景/文字色失效 | ✅ 已修复 | 统一改为 `--bg-secondary`/`--text-muted`，同步进卷 + 后端镜像重建；已 grep 全包确认无残留 `--color-*` |
| B-2 | 2026-07-14 | 纪律(已规避) | 镜像重建后未重建容器 → 运行容器仍挂旧悬空镜像，导致修复不生效（板块页曾因此持续 500） | ✅ 已规避 | 重建镜像后务必 `docker compose up -d --no-deps <svc>` 重建容器；并移除 `[section]/page.tsx` 中无意义的 `generateStaticParams`（全站 force-dynamic 下属死代码，是 static→dynamic 冲突隐患） |
| B-3 | 2026-07-14 | 缺陷(修复中) | **客户端切换配色主题失效**：点击页眉调色板切换 night/cyber/lava/light/space 时页面颜色不变。根因：`setTheme()` 只更新 store+cookie+`data-theme`，但真正驱动配色的覆盖层 `<style id="style-theme-override">`（`:root{…}`）仅在挂载/`activeStyle` 变化时由 `StyleProvider` 重注；切换主题未触发该 effect。叠加顺序隐患：新覆盖层 `appendChild` 到 `<head>`（位于 `<body>` 的 style-pack 之前），会被出厂主题 `:root` 反超 | 🔵 修复中 | `StyleProvider` 订阅 `useThemeStore` 的 `theme`，effect 依赖 `[theme]` 重注覆盖层（取值读 cookie，规避 store 初始默认 'night'）；`applyThemeOverride` 新建元素改挂 `document.body` 末尾以保证覆盖 style-pack。前端镜像重建 + 容器重建后需本地验证 |

> 新增问题请按上表格式追加，状态用第 1 节标记。

> 新增问题请按上表格式追加，状态用第 1 节标记。

---

## 5. 待决议项（开放问题）

| # | 问题 | 状态 | 结论 |
|---|---|---|---|
| 1 | 板块页二级目录数据来源 | ✔ 已确认 | 侧栏 = 该板块分类；主区 = 首篇精选文章正文 |
| 2 | design 是否需浅色版 | ✔ 已确认 | 不建浅色包，靠 `activeTheme=light` 叠加（路线 B） |
| 3 | **按板块单独覆盖 `pageLayout`？** | ✔ 已实现 | 通过 `sections.layouts` JSON 列 + `resolveSectionLayout` 解析链实现；支持 section/article/list 三键覆盖；首页通过 `homepage_layouts` siteSettings 键单独控制 |
| 4 | 预览图来源 | ✔ 已确认 | 最终运行时截图，当前渲染图占位 |

### 5.1 尚未闭环 / 待验证项（截至 2026-07-14）

- **R-3 / 待决议项 #3（按板块单独覆盖 `pageLayout`）**：唯一明确未开发的**功能项**。当前全局只有默认 `pageLayout`，单板块覆盖（如某板块用 landing、某板块用 page-sidebar-*）未实现，需先拍板设计再开发。
- **验收标准 AC-3 / AC-4 / AC-5 未勾选**：板块页差异（企业左栏+首篇精选正文 / 博客缩略图列表 / 文章页单栏 720+作者卡 vs 杂志双栏+大图）代码已支持配置消费，但默认三包是否真正呈现这些差异、且切换风格后保持正确，**尚未逐项实测**，建议补一次本地验收。
- **预览图（待决议项 #4）**：当前 `preview.png` 为渲染图占位，最终形态应为运行时截图，未产出。
- **B-3 主题切换失效**：见第 4 节，修复中（前端重建后验证）。

---

## 6. 关联文件索引

| 文件 | 说明 |
|---|---|
| `docs/style-pack-design.md` | 设计文档（配置 Schema / API 规范 / 三包差异） |
| `apps/web/public/styles/blog/*` | 默认科技博客风模板包（6 文件） |
| `apps/web/public/styles/enterprise/*` | 企业官网风模板包（6 文件） |
| `apps/web/public/styles/design/*` | 设计师作品集风模板包（6 文件） |

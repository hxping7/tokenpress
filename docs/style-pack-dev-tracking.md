# TokenPress Style Pack 功能与验收记录（v1.1 最终态）

> 关联设计：`docs/style-pack-design.md`（schema / 双旋钮模型）；接口规范以 `docs/admin-api.md`、`docs/ai-publish-api.md` 的「风格包 styles」章节为准。
> 本文件描述 Style Pack 系统落地后的**最终形态**与验收结论（含 v1.1 单文件统一与全站 AI 可设置化收口），不含历史演进过程。

## 1. 系统总览

- **双旋钮正交**：`activeStyle`（风格包，决定布局骨架 + 设计语言 + 全站可定制字段）× `activeTheme`（配色覆盖层 `#style-theme-override`，由 cookie `token00_theme` 驱动，默认 `light`）。任意风格包下切换配色仅换颜色、不动布局。
- **数据流**：`GET /api/v1/styles/active`（公开）→ 前端 `getActiveStyleConfig()`（`cache()` 请求内去重）→ `StyleProvider`（SSR 注入 `:root` 设计令牌 CSS，配置进 React Context）→ `useStyle*` hooks → 消费组件。
- **存储**：持久卷 `tokenpress-styles`（`STYLES_DIR`）为运行期唯一事实来源，nginx 经 backend 伺服 `/styles/*` 静态资源；内置源 `apps/web/public/styles/<id>/` 打包进镜像，`initBuiltinStyles` 仅在卷内目录缺失时拷贝（不覆盖用户改动）；镜像内另有 `apps/server/styles-builtin` 作为「恢复默认」源与 schema 兜底路径。
- **激活态**：`site_settings.active_style`（默认 `blog`），经 `POST /styles/:id/activate` 或 `PUT /site-settings` 切换，无需重启/重建。

## 2. 风格包格式（style.json 单文件）

每个包目录固定三件套：

```
<id>/
├── style.json        # 全量配置单文件（AI 与人共用同一事实来源）
├── ai-playbook.md    # AI 设计约束说明书（GET /styles/:id/playbook 可读）
└── preview.png       # 后台卡片预览图
```

`style.json` 顶层键：

| 键 | 职责 | 主要子字段 |
|---|---|---|
| `$` | 包元数据（不可经 PATCH 修改） | `id` / `name` / `description` / `version` / `builtin` / `preview` / `defaultTheme` / `compatibleThemes`（兼容墙纸白名单，可选） |
| `design` | 设计令牌与配色 | `tokens`（:root CSS 变量，品牌色不被主题覆盖）/ `theme`（CSS 字符串兜底） |
| `header` | 顶部导航 | `variant` / `logo`（src/width/height）/ `nav` / `actions` / `background` / `borderBottom` |
| `footer` | 页脚 | `variant` / `columns` / `friendLinks` / `bottom` / `background` / `textColor` |
| `layouts` | 布局骨架 | `homepage.sections[]` / `section`（含 `subcategory`）/ `article` / `list` / `category` / `templates` |
| `hero` | 首页 Hero / 轮播覆盖 | `enabled`（false 隐藏 Hero 区）/ `size` / `interval` / `autoplay`（false 仅手动）/ `showCTA`（false 隐藏按钮区）/ `ctaButtons[]` |
| `features` | 功能开关覆盖（布尔，`null` 值字段不限制前端） | `readingProgressBar` / `backToTop` / `welcomeOverlay` / `languageSwitcher` |

> 风格包只负责「装修」（布局/配色/结构）。站点信息（名称/描述/版权/备案/页脚 Logo）统一由 `site_settings` 全局设置管理，不进入 `style.json`。

字段级定义与校验规则以 `GET /api/v1/styles/:id/schema` 返回的 `style-json.schema.json` 为准（Agent 改包前应读取）。

## 3. 一次性迁移（旧 5 文件 → style.json）

- **触发**：读取某包目录时，存在 `manifest.json`（v1.0 旧格式特征）且无 `style.json`。
- **行为**：`migrateLegacyPack` 合并 `manifest.json` + `theme.css` + `header.json` + `footer.json` + `layouts.json` → 整包校验 → **立即落盘 `style.json`** → 此后一律以 `style.json` 为准。旧文件保留在盘作恢复参考，**不再参与任何读取路径**（无内存回退）。
- **幂等**：迁移完成后再读同一包不重复迁移；篡改旧 CSS 不影响已生成的 `style.json`。
- 覆盖范围：持久卷内所有包目录在首次读取时自动迁移，含 VPS 生产卷，无需人工干预。

## 4. 渲染消费链（前端全站 AI 可设置化消费清单）

`StyleProvider` 暴露 hooks：`useStyleSite` / `useStyleHero` / `useStyleHeader` / `useStyleFooter` / `useStyleLayouts` / `useStyleFeatures`。已接线的消费点：

| 字段 | 消费位置 |
|---|---|
| `hero.ctaButtons` | 首页 `HeroCarousel`：`label` 对象 `{zh,en}` 按 locale 解析；`style` 归一化映射 `primary→primary`、`outline→secondary`、`ghost→ghost` |
| `hero.enabled/size/interval/autoplay/showCTA` | 首页 Hero 显隐/尺寸/间隔/自动轮播/CTA 显隐（与 `site_settings.hero_*` 组成合并链，包覆盖优先；`enabled:false` 整区不渲染） |
| `features.readingProgressBar` | 文章详情页顶部阅读进度条（`ReadingProgress`），false 不渲染 |
| `features.backToTop` | `BackToTop`，false 时组件返回 null |
| `features.welcomeOverlay` | 欢迎页叠加层 `WelcomeOverlay`，false 且站点开关关 → 不加载 |
| `features.languageSwitcher` | `Header` 语言切换按钮（desktop/mobile 共用一份 actionDefs），false = 全站隐藏 |
| `layouts.section.subcategory` | `SectionPageClient` 板块页二级分类形态：`position: sidebar|top|tab|none`、`style: pill|card|list|grid`、showCount/columns |
| `layouts.homepage.sections` | 首页组件数组（`size:'hero'` 超大标题 + 双 CTA；`{component:'Banner', id}` 插命名横幅）；`site_settings.homepage_layouts` 深合并覆盖全局 homepage |
| `footer.friendLinks` | 页脚友链：`show/source(table|custom)/maxItems/columns/items[]` |

后台编辑链路（`StyleEditorModal` → `StylePackForm`）与远程 API 写入走同一份 `style.json`，保证「AI 可改、人也可改」——不存在只有 AI 能动的字段。

## 5. 后端 API 与后台

全部端点见 `docs/admin-api.md` / `docs/ai-publish-api.md`（新增「风格包 styles」章节）。要点：

- **读取契约（关键）**：`GET /styles/:id` 返回的顶层 `site` 是**由 `site_settings` 解析的全局站点信息**（只读，供前台 Header/Footer 渲染），不属于风格包、不接受回写；编辑器/Agent 只读写 `data.style` 下的 `design|header|footer|layouts|hero|features`。Agent 首选整体读写 `style` 单文件对象。
- **写入三条路径**：
  1. `PATCH /styles/:id` — 单字段/批量原子 patch（`{path,value}` 或 `{patch:[{path,value,op}]}`），根必须在 `design|header|footer|layouts|hero|features`；
  2. `PUT /styles/:id` — `{style:{...}}` 整份 style 替换（保留 id 与元数据，自动剔除 `site` 键），或旧字段局部更新（`theme/manifest/layouts/header/footer/hero/features`）；
  3. `POST /styles` — 新建包（直接提交 `{style:{...}}` 或旧字段形式，同样剔除 `site` 键）。
- 首页组件增删改走 `PATCH /styles/:id/homepage-sections`（insert/remove/replace/move）；配色批量重算走 `POST /styles/:id/scheme`（mode/accent/accentAlt）。
- 预览：`POST /styles/:id/preview`（view=home|section，带 patches 临时渲染非破坏），内部以全局锁 `style-preview-global` 串行，临时切 `active_style`、渲染后仅当仍指向该 id 才回滚。
- 恢复默认 `POST /styles/:id/restore`（仅内置包，从镜像内 `styles-builtin` 源整目录重拷）；删除 `DELETE /styles/:id`（内置包 403）。

## 6. 权限与安全

- 权限标识 `styles:read` / `styles:write`，位于 `packages/shared` 权限目录（roles: admin / superadmin），与现有 token 白名单同一套机制；后台 tokens 页可勾选。
- `GET /styles/active` 公开（SSR 需要）；其余读端点需 `styles:read`，全部写端点需 `styles:write`。无权限访问写接口 403（实测）。
- 校验：包 id 正则 `^[a-z0-9-]+$` 防路径穿越；整包 `validatePack`；PATCH 分根校验（header/layouts/footer/design）；`$` 元数据禁止经 PATCH 修改。
- 所有写端点（create/update/patch/homepage-sections/scheme/activate/preview/restore/delete）均写 `audit_logs`（action + `style_pack` + detail 含 `[id]` 与变更路径）。
- **站点信息归属定案**：名称/描述/版权/备案/页脚 Logo 属**内容**，唯一来源是 `site_settings`（`settings:write`）；风格包不含 `site` 根键，不存在经 `styles:write` 越权改站点内容的路径。
- 内置包与用户包并存：`POST` 撞内置包 id 409；内置包仅可 `restore` 不可 `delete`/`POST` 覆盖。

## 7. 验收清单

| 编号 | 功能点 | 结论 |
|---|---|---|
| AC-1 | 风格切换：切 `activeStyle` 全站布局+出厂配色即时变更，无需重启 | ✔ 已验证 |
| AC-2 | 与配色正交：切换 `activeTheme` 仅换色不动布局 | ✔ 已验证 |
| AC-3 | 板块页差异形态：enterprise 左二级目录+首篇精选正文 / blog 缩略图列表 | ✔ 已验证 |
| AC-4 | 文章页差异：单栏 720+作者卡 vs 杂志双栏+大图 | ✔ 已验证 |
| AC-5 | Logo：文件不入包，位置/尺寸由 header.json 控制 | ✔ 已验证 |
| AC-6 | 远程上传：`styles:write` token 可建新包并激活生效 | ✔ 已验证 |
| AC-7 | 权限隔离：无 `styles:write` 访问写接口 403；读接口需 `styles:read` | ✔ 已验证 |
| AC-8 | 安全校验：id 穿越 / CSS 注入 / 未知组件被拒 | ✔ 已验证 |
| AC-9 | 持久化：容器重建后内置三包与自定义包均不丢（`initBuiltinStyles` 只拷贝缺失目录） | ✔ 已验证 |
| AC-10 | **style.json 单文件统一**：三包卷重置后仅 style.json/ai-playbook.md/preview.png；旧 5 文件卷触发一次性确定性迁移，迁移后无回退路径 | ✔ 已验证 |
| AC-11 | **全站 AI 可设置化**：hero/features/friendLinks/subcategory 字段前端全部消费；后台 StylePackForm 控件齐全（首页 Hero/功能开关/板块/页脚 Tab） | ✔ 已验证（SSR 冒烟 + API 往返） |
| AC-12 | **写操作审计**：10 个变更端点全部落 audit_logs（operator=api-token/admin 合成身份） | ✔ 已验证 |
| AC-13 | **CTA 运行时兼容**：编辑器写入 `{label:{zh,en}, style}` 的 hero CTA 正常渲染，无 `[object Object]` | ✔ 已验证 |

## 8. 关联文件

| 文件 | 说明 |
|---|---|
| `docs/style-pack-design.md` | 设计文档（双旋钮模型 / 配置 schema / API 规范） |
| `apps/server/src/lib/stylePack.ts` | 读写/迁移/校验核心（`readPackConfig`/`writePack`/`migrateLegacyPack`/`applyBatchPatch`/`applyScheme`/`applyHomepageSections`） |
| `apps/server/src/routes/styles.ts` | 全部 styles 端点 + 审计 |
| `apps/web/public/styles/{blog,enterprise,design}/` | 内置三包（style.json + ai-playbook.md + preview.png） |
| `apps/web/public/style-json.schema.json` | 字段级 schema（镜像内兜底路径 `apps/server/style-json.schema.json`） |
| `apps/web/src/components/style-pack/StylePackForm.tsx` | 后台可视化编辑器（全 Tab） |
| `docs/admin-api.md` / `docs/ai-publish-api.md` | styles API 接口规范（Agent 参考） |

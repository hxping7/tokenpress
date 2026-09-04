# TokenPress 风格包（Style Pack）设计规范

风格包是 TokenPress 的**布局骨架层**：在不改动业务源码的前提下，用一份配置驱动首页、板块页、文章页的结构与全站可定制字段，支持通过后台 UI 或远程 AI API 创建/修改/激活。

配套文档：`docs/style-pack-dev-tracking.md`（验收追踪）、`docs/admin-api.md` §13 与 `docs/ai-publish-api.md` §10（接口详情）、`apps/web/public/style-json.schema.json`（机器可读 schema）。

---

## 1. 设计定位：与配色主题正交

两个旋钮互相独立、可自由组合：

| 旋钮 | 存储 | 取值 | 控制范围 |
|---|---|---|---|
| 风格包（骨架） | `site_settings.active_style` | `blog`（默认）/ `design` / `enterprise` / 自定义包 id | 页面结构、组件编排、Header/Footer 组合、站点信息覆盖、功能开关 |
| 配色主题（涂装） | cookie `token00_theme`（用户级，SSR 与客户端同源读取） | `light` / `night` / `cyber` / `lava` / `space`；缺省则用包自带 `design.theme` 出厂配色 | 仅颜色变量，注入 `#style-theme-override` 覆盖层 |

内置主题覆盖层**不覆盖风格包自带的 `--accent-blue`**（`apps/web/src/lib/themePalettes.ts` 的 `resolveThemePalette`），否则任意切一次主题会把各包的强调色刷成同一种颜色。

---

## 2. 包结构与存储

```
styles/<id>/
├── style.json        # 全部配置（唯一必需文件）
├── ai-playbook.md    # 给 AI Agent 的改包说明（可选，强烈建议）
└── preview.png       # 后台卡片预览图
```

- **存储位置**：Docker 卷 `tokenpress-styles`，静态资源经 nginx 以 `/styles/<id>/...` 伺服。
- **内置包初始化**：`initBuiltinStyles()` 仅在卷内目录缺失时拷贝；升级内置包须删除卷内对应目录后重启（或用后台「恢复默认」）。
- **旧格式迁移**：历史 5 文件格式（`manifest.json` / `theme.css` / `layouts.json` / `header.json` / `footer.json`）在首次读取时经 `migrateLegacyPack` **一次性落盘迁移为 `style.json`**，此后不存在回退路径。
- **Logo 资源**：文件保持在现有存储（`site_settings` / 媒体库），风格包只通过 `header.logo.src` **引用路径**并控制位置与尺寸，不搬运二进制。

---

## 3. `style.json` 顶层结构

六个根键，可通过 `PATCH /api/v1/styles/:id` 单独更新（`PATCHABLE_ROOTS = design / header / footer / layouts / hero / features`）。

| 根键 | 职责 |
|---|---|
| `design` | 配色模式、设计令牌、主题变体与可选项 |
| `header` | 顶栏形态、Logo、导航、动作按钮 |
| `footer` | 页脚版式、栏目、友情链接、底栏 |
| `layouts` | 首页 / 板块页 / 分类页 / 文章页 / 列表页 的结构编排 |
| `hero` | 首页英雄区（轮播/标准/分栏）与 CTA |
| `features` | 全站功能开关（阅读进度条、回顶、欢迎页、语言切换器、二级菜单） |

> **风格包只负责「装修」**：布局、配色、结构。站点信息（名称/描述/版权/备案/页脚 Logo）是**内容**，统一由后台「系统设置」（`site_settings`）管理，不进入风格包——同一份内容不存两套来源。

### 3.1 `design`

| 字段 | 说明 |
|---|---|
| `mode` | `light` / `dark` / `auto` |
| `tokens` | 设计令牌对象（颜色/字体/圆角/阴影/容器宽度） |
| `theme` | 出厂配色名 |
| `themeVariants` | 多套可切配色（键值对象） |
| `themeOptions` | 后台下拉可选项数组 |

### 3.2 `header`

| 字段 | 取值 / 说明 |
|---|---|
| `variant` | `sticky-solid` / `sticky-glass` / `sticky-transparent` / `static` / `hidden` |
| `height` | 数字（px） |
| `logo` | `{ type: image\|text\|component, src, srcLight, text, position: left\|center\|right, height, link }` |
| `nav` | `{ source: sections\|custom\|mixed, items, customItems, align, style: plain\|underline\|pill\|split\|minimal, position: top\|left, icons, showIcon, dropdown: hover\|click, colors }` |
| `actions` | 右侧动作按钮数组 |
| `background` / `borderBottom` | CSS 值 |

### 3.3 `footer`

| 字段 | 说明 |
|---|---|
| `variant` | `multi-column` / `simple` / `minimal` / `mega` |
| `columns[]` | `{ title, links[], html }` |
| `friendLinks` | `{ show, source: table\|custom, items:[{name,url}], columns, maxItems }` |
| `bottom` | `{ copyright, social[], showBackToTop }` |
| `background` / `textColor` | CSS 值 |

### 3.4 `layouts`

- `homepage`：`container`（`boxed` / `full` / `wide`）+ `sections[]`，按数组顺序渲染；每项 `{ component, variant, id, props }`，`component` 取值受白名单约束：`Hero` / `Features` / `ArticleList` / `CTA` / `Banner` / `CustomBlock`（`Banner` 用 `id` 引用 `home_banners` 中的命名横幅）。
- `section`（板块页默认骨架）：
  - `layout`：`page-sidebar-left` / `page-sidebar-right` / `landing` / `none`
  - `hero`：板块页顶部标题区
  - `sidebar`：`{ enabled, sticky }`
  - `subcategory`：`{ enabled, position: sidebar\|top\|tab\|none, style: pill\|card\|list\|grid, columns, showCount }`
  - `list`：列表版式覆盖
- `category` / `article` / `list`：分类页、文章页、列表页的结构覆盖。
- 板块与分类另有 `template`（7 套：`article-list` / `article-grid` / `article-masonry` / `magazine` / `single-page` / `link-wall` / `design-gallery`）+ `template_config`，优先级高于风格包默认值，用于「同一站点内不同板块不同版式」。

### 3.5 `hero`

| 字段 | 取值 / 说明 |
|---|---|
| `enabled` | boolean；`false` 时首页不渲染 Hero 区 |
| `size` | `standard` / `wide` / `ultrawide` / `full`（空 = 跟随后台 `hero_size`） |
| `interval` | 自动轮播间隔秒数（空/0 = 跟随后台 `hero_carousel_interval`） |
| `autoplay` | boolean；`false` 时仅手动切换 |
| `showCTA` | boolean；`false` 时隐藏 CTA 按钮区 |
| `ctaButtons[]` | `{ label, href, style: primary\|outline\|ghost }`，`label` 可为 `{ zh, en }` 双语对象；非空时覆盖后台 `hero_cta_buttons` |

> **运行时契约**：`HeroCarousel` 会把 `{ label:{zh,en}, style }` 归一化为当前语言的文本 + `primary` / `secondary` / `ghost`（`outline` → `secondary`），未归一化前直接渲染会显示 `[object Object]`。

### 3.6 `features`

| 字段 | 取值 | 说明 |
|---|---|---|
| `readingProgressBar` | boolean | 阅读进度条 |
| `backToTop` | boolean | 回到顶部按钮 |
| `welcomeOverlay` | boolean | 欢迎页浮层 |
| `languageSwitcher` | `icon` / `label` / `full` | 语言切换器形态 |

---

## 4. 渲染机制

1. **SSR 注入**：`getActiveStyleConfig()`（`cache()` 去重）在服务端读取激活包，`StyleProvider` 把设计令牌写入 `:root`，避免首屏闪烁。
2. **组件消费**：页面组件不再硬编码结构，改为读取配置：
   - `useStyleSite()` / `useStyleHero()` / `useStyleHeader()` / `useStyleFooter()` / `useStyleLayouts()` / `useStyleFeatures()`
   - `Home` 循环渲染 `layouts.homepage.sections[]`；`SectionPageClient` 读 `layouts.section`；文章页读 `layouts.article`。
3. **覆盖顺序**：后台站点设置（站点信息的唯一来源）→ 板块/分类 `template` 覆盖版式 → 配色主题覆盖颜色变量。
4. **切换生效**：写 `active_style` 立即生效，无需重启。

---

## 5. 后台编辑器与读写契约

- 编辑器入口：管理后台「风格」设置块（卡片选择 + 编辑弹窗 `/admin/style-preview` 实时预览）。
- **关键契约**：`GET /api/v1/styles/:id` 的**顶层 `site` 是由 `site_settings` 解析的全局站点信息**（只读，供前台 Header/Footer 渲染），**不属于风格包、不可回写**；编辑器草稿只读写 `data.style` 下的 `design` / `header` / `footer` / `layouts` / `hero` / `features`。
- 编辑器保存走 `PUT /api/v1/styles/:id` 的 legacy 字段分支（`hero` / `features` / `header` / `footer` / `layouts` / `theme` / `manifest`）；POST/PUT 整包替换时后端会自动剔除传入的 `site` 键。

---

## 6. 远程 API 与权限

**鉴权**：复用现有 API Token 体系（`apiTokenOrAdmin` 中间件），权限值 `styles:read` / `styles:write`；请求头 `Authorization: Bearer t00_sk_xxx`，curl 需带 `-A 'Mozilla/5.0'`。

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/api/v1/styles` | 列包（`styles:read`） |
| GET | `/api/v1/styles/active` | 当前激活包（公开，前台渲染用） |
| GET | `/api/v1/styles/:id` | 读整包（含合并后的顶层 `site`） |
| GET | `/api/v1/styles/:id/schema` | 取 `style.json` schema |
| GET | `/api/v1/styles/:id/playbook` | 取 `ai-playbook.md` |
| POST | `/api/v1/styles` | 新建包 |
| PUT | `/api/v1/styles/:id` | 整体或 legacy 字段更新 |
| PATCH | `/api/v1/styles/:id` | 按根键局部更新（`patch[]` 数组，原子） |
| PATCH | `/api/v1/styles/:id/homepage-sections` | 单独编排首页组件数组 |
| POST | `/api/v1/styles/:id/scheme` | 按 `{ mode, accent, accentAlt }` 重算配色方案 |
| GET | `/api/v1/styles/:id/diff?target=<id>` | 与另一包逐字段对比差异 |
| POST | `/api/v1/styles/:id/preview` | 临时切 `active_style` 到目标包做 SSR 预览（全局加锁，结束回滚） |
| POST | `/api/v1/styles/:id/activate` | 激活 |
| POST | `/api/v1/styles/:id/restore` | 恢复内置默认 |
| DELETE | `/api/v1/styles/:id` | 删除自定义包（`builtin:true` 受保护） |

写操作全部记录 `audit_logs`（action `update` / resource `style_pack`）。

**服务端校验**：`<id>` 必须匹配 `^[a-z0-9-]+$` 且禁止路径穿越；`layouts` 中 `component` 必须在注册白名单内；内置包禁止删除。

---

## 7. 内置三包定位

| 维度 | blog（默认） | design | enterprise |
|---|---|---|---|
| 气质 | 浅色科技博客 | 少数派：白底 + 红 `#d71920` + 浅灰圆角卡片 + 胶囊 | 特赞：白底 + 纯黑 `#111` + 超大黑标题 + 黑胶囊 |
| 首页 | Hero 轮播 → 文章网格 | 大标题 Hero → 作品/文章网格 | Hero → 能力块 → 案例 → CTA |
| 板块页 | `article-list` | `article-list`（网格） | `page-sidebar-*` 侧栏 + 主区内容 |
| 导航 | 下划线 | 实色胶囊 | 实色胶囊 |

---

## 8. 字段设计原则

`style.json` 中**每一个字段都必须已接入渲染**——不接受"预置/保留"类死配置（这类字段会让编辑者和 AI 误以为改动有效）。新增可配置项的顺序：先实现渲染消费，再加入 schema 与编辑器；字段一旦被证明无消费端，即从 schema、三包文件与编辑器中同步移除。

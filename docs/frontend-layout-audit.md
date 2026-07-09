# 前端显示布局与屏幕适应走读报告

> 走读范围：公开站点（首页 / 板块列表 / 文章详情 / 搜索 / 登录）的布局、容器宽度与响应式断点。
> 时间：2026-07-09

## 一、整体布局架构

- **根布局** `src/app/layout.tsx`：`<body class="min-h-screen flex flex-col">` → `Header`(fixed) + `<main class="flex-1">` + `Footer`。经典「顶部栏 + 内容 + 底栏」三明治结构。
- **Header** `src/components/Header.tsx`：`fixed top-0 left-0 right-0 z-50 h-16`（64px），内容 `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`。
- **Footer** `src/components/Footer.tsx`：`max-w-7xl mx-auto`，内部导航用 CSS Grid。
- **统一外框宽度**：`max-w-7xl` = 1280px 是全站唯一硬性约束；个别区块用 `max-w-6xl`(1152) / `max-w-4xl`(896) / `max-w-3xl`(768) / `max-w-2xl`(672)。

## 二、响应式断点体系

`tailwind.config.js` **未自定义 `screens`**，直接使用 Tailwind v3 默认断点：

| 断点 | 像素 | 语义 |
|------|------|------|
| sm   | 640  | 主题/语言/登录按钮开始出现 |
| md   | 768  | 主导航出现、汉堡消失；文章网格 2 列 |
| lg   | 1024 | 文章详情 TOC + 右侧栏出现；板块页右栏出现 |
| xl   | 1280 | 首页/板块文章网格 3 列；容器宽度到顶 |
| 2xl  | 1536 | 无额外加宽逻辑 |

> 注：搜索页、登录页等约束更窄（max-w-3xl），在任意断点下都保持单列居中。

## 三、各页面宽度处理

| 页面 | 外层补偿 | 容器 | 栅格 / 侧栏 |
|------|----------|------|-------------|
| 首页 `page.tsx` | **无** `pt-16`，依赖 Hero 自带 padding | Hero `max-w-3xl/6xl`、区块 `max-w-6xl` | 文章 `grid-cols-1 md:2 lg:3` |
| 板块列表 `SectionPageClient.tsx` | `min-h-screen pt-16` | `max-w-7xl` | `lg:grid-cols-[1fr_260px]`，文章 `md:2 xl:3` |
| 文章详情 `ArticleDetailClient.tsx` | `min-h-screen pt-16` | 标题 `max-w-4xl`、正文 `max-w-7xl` | `lg:grid-cols-[200px_1fr_240px]`，TOC/侧栏 `hidden lg:block`，正文 `min-w-0`（防溢出 ✓） |
| 搜索 `search/page.tsx` | `min-h-screen pt-16` | `max-w-3xl` | 单列列表 |
| 登录 `auth/login/page.tsx` | `min-h-screen pt-16` | 卡片居中 `px-4` | 单列 |

正文 Markdown（`MarkdownContent.tsx`）：`prose prose-lg max-w-none`，代码块包 `overflow-x-auto`，图片走 `prose-img`（默认 `max-w-full`）—— 移动端横向溢出控制良好。

## 四、发现的问题（按优先级）

### P0 · 标题字号失效（大小）
`text-heading-1` / `text-heading-2` 在业务代码中大量使用（文章标题、板块标题、搜索页 H1），但项目内**未定义**（Tailwind config 无 `fontSize` 扩展，全局 CSS 也无对应规则）。受 Tailwind preflight `h1..h6 { font-size: inherit; font-weight: inherit }` 影响，这些大标题会回退为 body 字号（16px 常规），导致「大标题变小字」。
- 修复：在 `tailwind.config.js` 增加
  ```js
  theme: { extend: { fontSize: {
    'heading-1': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
    'heading-2': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
  }}}
  ```
  或直接把对应 `text-heading-1/2` 改为 `text-4xl` / `text-3xl`。

### P1 · 全屏 Hero 顶部被遮挡（宽度/遮挡）
首页 Hero 在 `size==='fullscreen'` 时用 `pt-14`（56px）`<` 固定头部 64px，顶部约 8px 被头部盖住；非全屏 `pt-20`（80px）正常。建议全屏模式也使用 `pt-16` 或更大。

### P1 · Header 在 640–767px 的「适应死区」
- 主题/语言/登录按钮：`hidden sm:flex` → ≥640 显示
- 主导航：`hidden md:flex` → ≥768 显示
- 汉堡：`md:hidden` → <768 显示

结果 640–767px 区间**同时存在汉堡与内联按钮**，但主导航仍只能经汉堡访问，主入口可发现性差。建议把主导航显隐阈值与汉堡统一（都用 `md`），或在该区间隐藏部分内联按钮。

### P2 · 窄屏 Logo 占用
Header Logo 容器固定 `width:160`（内联 `style={{ width: 160 }}`），在 320px 窄屏占近半宽；`siteName` 带 `tracking-[0.15em]` 较挤。建议窄屏隐藏 `siteName` 或允许收缩。

### P2 · Markdown 表格横向溢出
代码块、图片均有溢出保护，但 `<table>` 在移动端无横向滚动包裹，超宽表格可能溢出。建议在 `MarkdownContent` 外层对表格包一层 `overflow-x-auto`。

### P2 · 超宽屏留白
>1280px 后内容固定于 1280 居中，两侧留白较大（可接受）。如需更宽，可提到 `max-w-[90rem]` 之类，并相应调整栅格列数。

### 确认项 · viewport
Next.js 14 默认注入 `<meta name="viewport" content="width=device-width, initial-scale=1">`，移动端缩放正常；建议在真机/浏览器设备模式实测一次。

## 五、结论

布局骨架（容器 1280 居中、固定头部 + `pt-16` 补偿、栅格随断点降列、正文 `min-w-0` 防溢出）整体健康，移动端阅读体验有基本保障。
**最需立即修复的是 P0 标题字号失效**——它让所有大标题「缩水」成正文大小，是观感上的硬伤；其次是全屏 Hero 偏移与 Header 640–767 死区两处适应瑕疵。

如需，我可以直接应用上述修复（P0 必改，P1/P2 可按优先级）。

## 六、修复记录（2026-07-09）

### P0 · 标题字号失效 ✅ 已修复
`apps/web/tailwind.config.js` 的 `theme.extend.fontSize` 新增两个 token：
- `heading-1`: `2.25rem` / `line-height 2.75rem` / `font-weight 700`（等同 `text-4xl`）
- `heading-2`: `1.875rem` / `line-height 2.25rem` / `font-weight 700`（等同 `text-3xl`）

文章详情 `text-heading-1`、板块页 `text-heading-1`、搜索页 `text-heading-2` 现可正常渲染为大标题，不再回退成 16px 正文。

### P1 · 全屏 Hero 顶部被遮挡 ✅ 已修复
`apps/web/src/components/HeroCarousel.tsx` 第 47 行：全屏模式 `pt-14` → `pt-16`，与固定头部 64px 对齐，顶部不再被遮挡。

### P1 · Header 640–767px 死区 ✅ 已修复
`apps/web/src/components/Header.tsx`：主题切换、语言切换、后台入口、登录/退出 4 个按钮的显隐阈值由 `sm`(640) 统一改为 `md`(768)，与主导航(`hidden md:flex`)、汉堡(`md:hidden`) 对齐。现为 `<768` 仅显示 Logo+汉堡，`≥768` 显示完整导航与按钮，死区消除。

> P2 项（窄屏 Logo 占用、Markdown 表格横向溢出、超宽屏留白）按优先级暂未处理，可视需要后续跟进。

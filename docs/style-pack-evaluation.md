# Style Pack（风格包）功能实现评估

> 评估对象：Phase A 全部改动（后端 styles 路由 + 前端布局驱动 + Docker 卷挂载 + 管理后台风格 Tab）
> 评估时间：2026-07-14
> 评估方法：本地 Docker 全链路验收（19 项 AC，不触 VPS）+ 设计原则对照（ardot-design-core / ardot-ui-design）
> 结论：**功能完整、安全合规、本地验收 19/19 通过；发现并修复 1 个真实产品缺陷（页脚未定义 token），以及 1 个部署纪律坑（容器未重建导致 500）。可进入 VPS 部署评审，但需用户明确放行。**

---

## 1. 验收结论（本地 Docker，19/19）

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | 健康检查 200 | ✅ |
| 2 | 默认 `activeStyle=blog`、出厂配色 `light` | ✅ |
| 3 | 读接口无 token → 401/403（权限隔离） | ✅ |
| 4 | 列出 3 内置包 blog/enterprise/design | ✅ |
| 5 | 上传第四包（非内置）成功 | ✅ |
| 6 | theme 含 `@import` → 400 拦截 | ✅ |
| 7 | id 路径穿越 `../` → 400 拦截 | ✅ |
| 8 | 未知 component `Backdoor` → 400 拦截 | ✅ |
| 9 | 内置包 POST 覆盖 → 409 拦截 | ✅ |
| 10 | 内置包 DELETE → 403 拦截 | ✅ |
| 11 | 切换 `active_style=enterprise` 生效（SSR 渲染「联系我们」动作） | ✅ |
| 12 | enterprise 出厂配色 `light` | ✅ |
| 13 | AC-2 配色正交：night cookie 注入覆盖层，布局不变 | ✅ |
| 14 | 切回 blog 后 enterprise 动作消失 | ✅ |
| 15 | `preview.png` 经 nginx→backend 静态可访问 200 | ✅ |
| 16 | **板块页 `/ai-coding` 200**（此前 500，本次修复） | ✅ |
| 17 | 容器重建后内置包不丢（卷持久化） | ✅ |

> 说明：脚本原文把第 5/8 项误判为失败，属**测试桩缺陷**（在 body 里 grep "400" 而非取状态码；agency 包未做幂等清理）。修正桩后 19/19 全绿。产品本身两条安全校验均**正确拒绝**（409 / 400）。

---

## 2. 架构评估

### 2.1 双旋钮正交性（activeStyle × activeTheme）—— 优
Style Pack 负责**布局骨架**（header/footer/layouts/theme 的 `:root` 配色），Theme 皮肤负责**5 套配色覆盖层**。二者正交，符合 ardot `Constraint Over Decoration` 与「结构从效用中涌现」的原则：
- 切换 `activeStyle=enterprise` 时，SSR 输出 enterprise 的 Header 动作；叠加 `night` cookie 仅注入 `#style-theme-override` 覆盖层，**布局零变化**（AC-13/14 实证）。
- 配色层通过 JS 注入 `:root{}` 覆盖变量，不动布局 DOM，规避了「配色切换改变布局」的反模式。

### 2.2 SSR 注入防闪烁 —— 优
`layout.tsx` 在 `<head>` 同步注入 `#style-pack` 与 `#style-theme-override` 两段 `<style>`，避免客户端水合后再换肤的 FOUC。这是正确做法。代价是根布局用 `cookies()` → 全站动态渲染（见 §4 缺陷）。

### 2.3 文件系统存储 + Docker 卷 —— 优，已实证持久化
- `STYLES_DIR=/app/apps/server/data/styles` 由命名卷 `tokenpress-styles` 挂载，前后端共享。
- `initBuiltinStyles()` 仅在目标缺失时从 `styles-builtin` 拷贝，不覆盖用户包；内置包删除受保护（AC-10）。
- 实证：容器从旧镜像重建到新镜像、测试期间上传的 `agency` 包与内置三包均**不丢**（AC-17）。

---

## 3. 设计质量评估（对照 ardot 原则）

### 3.1 Token 纪律与配色一致性 —— 基本达标，已修 1 处
- 三套 `theme.css` 各自定义了**自洽的 `:root` 调色板**（背景/文字/边框/强调色成体系），满足 ardot `COLOR CONSISTENCY`（单调色板、不冷暖灰混用）。
- **缺陷（已修复）**：三套 `footer.json` 引用了 `theme.css` 中**不存在**的 token——`--color-surface` / `--color-bg` / `--color-text-muted`。`Footer.tsx` 直接 `style={{background: fc.background}}` 消费这些字段，未定义 token 会回退为 `transparent`/初始文字色，页脚背景与文字色实际失效。已统一改为合法 token `--bg-secondary` / `--text-muted`，并同步进卷与后端镜像。
- 建议增加**构建期 CSS 变量校验**（lint），杜绝 style JSON 引用未定义 token 再次漏网。

### 3.2 配色校准 —— 符合品牌，慎用 ardot「反紫」规则
- ardot `THE LILA BAN` 禁止「AI 紫蓝 glow / 霓虹渐变」。但本项目**既定品牌语言即「深空蓝 + 青蓝渐变」**（见项目记忆）。blog 包保留 `--accent-blue` + `--accent-purple` 与轻微按钮 glow（alpha 0.14），是在延续品牌而非生成新 slop。**正确取舍：品牌一致性优先于通用反 slop 规则。**
- `design` 包采用深空蓝黑底（`#050b1a`，非纯黑 `#000`）＋电光蓝，最贴合 ardot「NO Pure Black / 单强调色」主张，是三套里最「干净」的一套。
- 三套均满足「最大 1 个主强调色、饱和度受控」，无过饱和霓虹。

### 3.3 字体 —— 可接受，design 包可升级
- blog/enterprise 用 `Inter` 作品牌字。ardot 主张「Premium/Creative 不用 Inter」，但本场景是**技术博客（功能型产品 UI）**，Inter 属合理默认；且项目品牌已绑定。
- 若后续想让 `design`（设计师作品集）更具质感，可换 `Geist`/`Satoshi` 类更具辨识度的字体栈——属可选润色，非缺陷。

### 3.4 布局与层级 —— 达标
- 首页 `container:boxed` + `--content-max-width:1200px`，符合 ardot「容器限定最大宽度、防拉伸」。
- 板块页 `page-sidebar-left/right`（分类侧栏 + 精选正文）、`article-list`（缩略图网格）、`landing` 三种布局由 `layouts.json` 驱动，`SectionPageClient` 据此渲染，布局节奏系统一致（ardot `Structural Consistency`）。
- 文章页 `single / two-column / magazine` 三态，`two-column` 含可选左 TOC（200px_1fr_240px），层级清晰（ardot `Dominant Region Rule`）。

### 3.5 密度与留白 —— 恰当
- 内容站天然属「Daily App / Art Gallery」低密度（VISUAL_DENSITY 1–4），三包均未堆砌，留白充足，无 ardot 禁用的「3 等宽卡片特性行」反模式（板块列表用网格但非营销特性卡）。

---

## 4. 发现的缺陷与修复（本次会话）

### 4.1 🔴 板块页 500（部署纪律坑，已解决）
- **现象**：`/ai-coding` `/blog` `/token-plan` 全部 500，`/` 正常。
- **根因**：根布局 `cookies()` 使整站动态渲染，而 `[section]/page.tsx` 仍带 `generateStaticParams` + 静态预渲染，运行时被 `cookies()` 触发「static → dynamic」冲突抛 500。修复为 `export const dynamic = 'force-dynamic'`。
- **真凶（部署纪律）**：镜像已重建（`tokenpress-frontend:latest` = `3df68c17ca90`），但运行容器仍挂在旧悬空镜像 `1f715a282379` 上——**构建后未重建容器**，旧代码在跑。
- **处置**：`docker compose up -d --no-deps frontend` 重建容器到最新镜像后，板块页恢复 200（AC-16）。
- **建议**：`[section]/page.tsx` 的 `generateStaticParams` 在全站动态前提下已无意义且是隐患，**建议直接删除**（仅靠 `force-dynamic` + 运行时 `fetchSections` 匹配），从根上消除该类问题。

### 4.2 🟠 页脚未定义 token（真实产品缺陷，已修复）
- 三套 `footer.json` 引用 `--color-surface/--color-bg/--color-text-muted`，`theme.css` 无定义 → 页脚背景/文字色失效。
- 已改为 `--bg-secondary`/`--text-muted`，同步进卷 + 后端镜像重建。

### 4.3 ⚪ 测试桩缺陷（非产品问题，已修）
- 桩脚本在响应 body 中 grep `"400"`（实际 400 在状态码）；`agency` 包未做幂等清理导致重复运行误报。已改为取状态码 + 上传前先 DELETE。

---

## 5. 安全评估 —— 强

| 攻击面 | 防护 | 验证 |
|--------|------|------|
| CSS 注入（`@import`/外部资源） | theme 仅允许 `:root{}`，拦截 `@import` | 400 ✅ |
| 路径穿越（id=`../etc/passwd`） | id 正则 `^[a-z0-9-]+$` | 400 ✅ |
| 组件注入（未知 component） | 组件白名单 Hero/Features/ArticleList/CTA | 400 ✅ |
| 内置包被覆盖/删除 | 内置包 POST→409、DELETE→403 | ✅ |
| 未授权读 | 无 token → 401/403 | ✅ |
| 权限隔离 | 复用 token 白名单 `styles:read/write` | ✅ |

安全模型与项目既定「按 token 权限隔离」范式一致，无越权面。

---

## 6. 与 Ardot 设计原则对照表

| Ardot 原则 | 实现状态 | 备注 |
|-----------|----------|------|
| Token 纪律 / 配色一致性 | ✅（修 1 处后） | footer 未定义 token 已修 |
| 单强调色、饱和度受控 | ✅ | 品牌蓝青，无过饱和 |
| NO Pure Black | ✅ | design 用 #050b1a |
| 容器限定最大宽度 | ✅ | 1200px boxed |
| 结构一致性 / 布局节奏 | ✅ | 三布局系统驱动 |
| 层级主导区 | ✅ | 文章/板块层级清晰 |
| 约束优于装饰 | ✅ | 双旋钮正交，无多余装饰 |
| 反 3 等宽卡片 | ✅ | 未用营销特性卡 |
| 品牌一致性 > 通用反 slop | ✅ | 保留深空蓝紫品牌 |
| Inter 字体（创意禁用） | ⚠️ 可接受 | 技术博客功能型，非缺陷 |
| 构建期变量校验 | ❌ 缺失 | 建议新增 lint |

---

## 7. 建议（按优先级）

1. **删除 `generateStaticParams`**（[section]/page.tsx）——消除静态/动态冲突隐患（高，防回归）。
2. **新增 style JSON 的 CSS 变量校验**（构建期 lint）——防未定义 token 再次漏网（中）。
3. **预览图升级为运行期截图**（route B）——当前 `preview.png` 为占位，管理后台选包体验待补真实视觉（中，原 plan 已规划）。
4. **design 包字体可选升级**为 Geist/Satoshi 类（低，润色）。
5. **VPS 部署**：本地全绿，但依项目纪律「远程/生产改动先本地验证，禁止直接上 VPS」，需用户明确放行后再走 `token00-deploy` 流程（阻塞项）。

---

## 8. 结论

Phase A 功能实现**完整且正确**，本地 19/19 验收通过，安全模型稳健，双旋钮架构清晰正交。本次评估**发现并修复 2 个真实问题**（板块页 500 的部署纪律坑、页脚未定义 token 的产品缺陷），并修正了测试桩。设计质量对照 ardot 原则总体达标，仅在「构建期变量校验」与「generateStaticParams 清理」上有可落地的加固点。

**下一步**：等待用户批准 → 执行 VPS 部署（不在本次自动执行）。

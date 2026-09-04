# Token00 首页欢迎页 · API 与集成设计文档

> 范围：首页欢迎页（首次访问域名时展示的科幻动画）的**后台开关 + 文件路径配置 + 远程 AI Token 控制 + 前端消费**全链路设计。
> 结论先说：**无需新增任何后端接口或权限**——它复用既有 `site-settings` KV 存储与 `settings:write` 权限；Token00 站点设置本身已对 `settings:write` 的 token 开放。

---

## 1. 设计目标

- 后台可**启用/关闭**欢迎页，并可填写**欢迎页文件路径**（对外 URL 路径）。
- 远程 **AI Token（`settings:write`）** 可同等开关与换页，纳入既有权限隔离体系。
- 欢迎页本身为独立 HTML（**预置源在仓库 `apps/server/statichtml-presets/welcome/`，构建期打进后端镜像，启动时由 `initBuiltinStaticHtml()` 拷进 statichtml 持久卷，对外 `/statichtml/<file>.html`），与工程解耦，可随时替换/扩展变体。**
- 首次访问才弹，关闭后按浏览器记忆不再弹（不打扰老访客）。

---

## 2. 设置项契约（site_settings KV）

| key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `welcome_page_enabled` | bool(字符串) | `false` | 总开关；`true` 时访客首次进入首页展示欢迎页 |
| `welcome_page_html` | text(url) | `/statichtml/welcome.html` | 欢迎页对外路径，**须以 `/statichtml/` 开头** |

- 存储规则：KV 表 `value` 一律为字符串；布尔以 `"true"` / `"false"` 存储。
- 校验：`welcome_page_html` 建议以 `/statichtml/` 开头（前端不强制，但非此前缀的页面可能无样式/跨域）。
- 未知 key：既有 `PUT /site-settings` 对任意 key 原样 upsert，因此这两个 key **零迁移**即可生效。

### 内置变体（写入 `welcome_page_html` 切换）

| 路径 | 风格 |
|------|------|
| `/statichtml/welcome.html` | 基线：深空蓝·撞击绽放 |
| `/statichtml/welcome-minimal.html` | 极简冷光 |
| `/statichtml/welcome-neon.html` | 赛博霓虹 |
| `/statichtml/welcome-ink.html` | 粒子水墨 |
| `/statichtml/welcome-cosmic.html` | 深空星海 |

---

## 3. API 契约

### 3.1 读取（公开）

```
GET /api/v1/site-settings/keys/welcome_page_enabled,welcome_page_html
```
返回：
```json
{ "success": true, "data": { "welcome_page_enabled": "true", "welcome_page_html": "/statichtml/welcome-cosmic.html" } }
```

### 3.2 写入（需 `settings:write`，或 JWT 管理员会话）

```
PUT /api/v1/site-settings
Authorization: Bearer t00_sk_xxxxx     # 或 JWT 管理员
Content-Type: application/json
```
请求体（兼容两种）：
```json
{ "settings": { "welcome_page_enabled": "true", "welcome_page_html": "/statichtml/welcome-neon.html" } }
```
或数组形式：
```json
{ "settings": [ { "key": "welcome_page_enabled", "value": "true" }, { "key": "welcome_page_html", "value": "/statichtml/welcome-neon.html" } ] }
```
成功返回完整 settings；权限不足返回 `403 { error: "Missing required permission: settings:write" }`。
写入后会 `revalidatePath('/')`，首页约 1 分钟内生效（ISR `revalidate:60`）。

### 3.3 远程 AI Token 示例

```bash
# 开启 + 切换变体（赛博霓虹）
curl -X PUT "https://www.token00.com/api/v1/site-settings" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"welcome_page_enabled":"true","welcome_page_html":"/statichtml/welcome-neon.html"}}'

# 关闭
curl -X PUT "https://www.token00.com/api/v1/site-settings" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"welcome_page_enabled":"false"}}'

# 读取当前配置
curl "https://www.token00.com/api/v1/site-settings/keys/welcome_page_enabled,welcome_page_html"
```

### 3.4 权限矩阵（确认无需新增）

| 操作 | 所需权限 | 说明 |
|------|----------|------|
| 读设置 | 公开（无需 token） | `GET /site-settings*` |
| 写欢迎页设置 | `settings:write` | 与「改站点名/主题」同权；admin / superadmin 可签发 |
| 上传欢迎页 HTML | `statichtml:write` | 若欢迎页需经 API 上传（也可本地直接落盘 `data/statichtml/`） |

> 刻意不新增专属权限：`welcome_page_*` 属系统设置范畴，纳入 `settings:write` 即可，保持权限矩阵正交。

---

## 4. 后台 UI 设计（系统设置 → 首页 → 欢迎页）

位置：后台「系统设置」的 **首页** 分组下新增第三个子 Tab **欢迎页**（与现有「Hero / 中部 Banner」并列）。

控件：
1. **启用欢迎页** 开关（Toggle）。说明文案：开启后访客首次进入首页展示欢迎页，点「进入」关闭（按浏览器记忆）。
2. **欢迎页文件路径** 文本输入（placeholder `/statichtml/welcome.html`）。
3. **快速选择内置变体** 下拉（5 个内置变体），选中即填入路径。
4. **预览当前欢迎页** 链接（新窗口打开 `welcome_page_html`）。

保存：复用既有「保存全部」按钮，随 `handleSaveAll` 把 `welcome_page_enabled` / `welcome_page_html` 一并 PUT。

---

## 5. 前端消费设计（首页 WelcomeOverlay）

组件：`apps/web/src/components/WelcomeOverlay.tsx`（`'use client'`），由 `apps/web/src/app/page.tsx`（服务端组件）渲染。

数据流：
```
后台/Token 写入 PUT /site-settings
        │  (revalidatePath('/'))
        ▼
首页服务端 getWelcomePage()  ── fetch /api/v1/site-settings/keys/welcome_page_enabled,welcome_page_html
        │
        ▼
<WelcomeOverlay enabled htmlPath />   （SSR 注入，避免闪烁）
        │
        ▼
首次访问 && enabled && localStorage.token00_welcome_seen !== '1'
        → 全屏 fixed 遮罩 + iframe(src=htmlPath)
        │
        ├─ 欢迎页内点「进入」 → postMessage({type:'welcome:close'})
        │       → 遮罩淡出 + localStorage 标记 '1'
        └─ 手动「跳过 ›」按钮 → 同上关闭并标记
```

要点：
- 仅在 `enabled && 首次访问` 时弹，关闭后同源下不再弹（`localStorage` 记忆）。
- iframe `src` 即 `welcome_page_html` 路径（相对站点根）。
- 监听 `window.message`，收到 `welcome:close` 即关闭——与欢迎页内部「进入」按钮契约一致。
- 尊重欢迎页自身 `prefers-reduced-motion`（动画自动快进到按钮态）。

---

## 6. 欢迎页 HTML 契约（供替换/扩展时遵循）

任意放入 **statichtml 持久卷**（`/statichtml/<file>.html`，即 `/admin/statichtml` 管理的目录）的 HTML 均可作欢迎页，只需遵守：
- 全屏自适应（`width:100vw;height:100vh`）、响应式 DPR/resize。
- 结尾必须出现「进入」与「重播」两个按钮。
- 「进入」点击行为：
  - 在 iframe 内：`window.parent.postMessage({ type: 'welcome:close' }, '*')`；
  - 独立打开（非 iframe）：优雅淡出，切勿跳转到文件系统。
- 「重播」：重置动画时间轴。
- 尊重 `window.matchMedia('(prefers-reduced-motion: reduce)')`：自动跳到按钮态。
- 零外部依赖（纯 Canvas / 原生 JS），保证离线/无网也能播放。

---

## 7. 部署与运维注意（已落地）

### 7.1 仓库管理（纳入版本控制）

预置欢迎页已从运行时目录移出版本管理：

| 位置 | 作用 | 是否入库 |
|------|------|----------|
| `apps/server/statichtml-presets/welcome/*.html` | **唯一真源**，5 个变体 | ✅ 入库 |
| 镜像 `/app/apps/server/statichtml-presets/` | 构建期 `COPY` 进后端镜像 | 镜像内 |
| 持久卷 `tokenpress-statichtml` → 容器 `/app/apps/server/data/statichtml/` | 运行时由 `initBuiltinStaticHtml()` 拷入 | 运行时数据（gitignore） |
| `nginx` 代理 `/statichtml` → `backend:4001` | 对外服务路径 | — |

- `data/statichtml/` 仍被 `.gitignore` 忽略——但**无需再手动往里放文件**：部署即由镜像预置自顶向下填充。
- 与 Style Pack 同策略：**仅当目标文件不存在时才拷贝，不覆盖后台 `/admin/statichtml` 中的手动编辑**。若需强制更新某变体，可在后台删除后重启用，或直接经 `statichtml:write` API 覆盖。

### 7.2 本地 Docker 验证

```bash
# 端口以 deploy.conf 为准（当前 HTTP_PORT=8081 / HTTPS_PORT=8444）
# 1) 构建并启动（重建镜像会自动拷入预置欢迎页）
docker-compose up --build -d

# 2) 健康 & 欢迎页可访问（反爬需带 UA）
curl -A 'Mozilla/5.0' -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/v1/health
curl -A 'Mozilla/5.0' -o /dev/null -w "%{http_code}\n" http://localhost:8081/statichtml/welcome.html

# 3) 远程开 + 切变体（赛博霓虹）
curl -X PUT "http://localhost:8081/api/v1/site-settings" \
  -H "Authorization: Bearer t00_sk_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"welcome_page_enabled":"true","welcome_page_html":"/statichtml/welcome-neon.html"}}'

# 4) 浏览器开 http://localhost:8081/ → 首次访问应弹出欢迎页遮罩（iframe 嵌入 /statichtml/welcome-neon.html）
```

- 镜像重建后**必须重建容器**（`up --build` 已含），否则会跑旧的悬空镜像。
- 远程/生产改动遵循测试纪律：**先本地 Docker 验证，禁止直接在 VPS 生产测试**。

---

## 8. 待办（如需进一步）

- [ ] 后台「欢迎页」子 Tab 已落地；可选：增加「上传欢迎页」按钮（复用 StaticPagePicker / statichtml 上传）。
- [ ] 可选：后台加「预览动效」内嵌 iframe 实时预览，而非仅新窗口链接。
- [ ] 可选：欢迎页变体纳入 Style Pack 体系，随风格包一起切换。

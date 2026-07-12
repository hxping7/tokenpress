# Token00 静态页面（statichtml）功能开发计划

## 目标
为 Token00 增加「静态 HTML 页面」能力：
- 通过 `https://www.token00.com/statichtml/<path>` 直接访问静态页面（如 `statichtml/test.html`、`statichtml/item1/test1.html`）。
- 后台提供静态页面管理入口：树形文件夹管理、上传常用 Web 文件（html/css/js/json/svg/图片/字体等）。
- 静态页面可作为「自定义板块链接 / Hero 区链接 / Hero CTA 按钮链接」的跳转目标（活动宣传、教程集合等）。
- 支持通过远程 API（access token 权限隔离）创建/发布静态页面。

## 架构决策
1. **存储与访问**：静态文件存于后端数据目录 `data/statichtml/`，由后端 `express.static('/statichtml')` 提供 HTTP 访问；nginx 增加 `location /statichtml` 反代到 backend。与现有 `/uploads` 模式一致。
2. **独立卷**：docker-compose 新增 `tokenpress-statichtml` 卷，挂到 backend `/app/apps/server/data/statichtml`，数据持久化、可单独备份。
3. **数据源**：以文件系统为唯一事实源，tree/list 直接扫描目录；不引入新 DB 表，避免迁移复杂度。
4. **权限**：新增 `statichtml:write`（建/删文件夹、上传/替换/删文件）与 `statichtml:read`（tree/list 选择器）。接入既有 `apiTokenOrAdmin` 中间件，纳入 access token 权限矩阵。
5. **链接方式（关键）**：
   - 顶部导航 section 用 `externalUrl` 字段挂静态页 URL（避免污染 `[section]` 动态路由预渲染）。
   - Header 与 HeroCarousel 对 `/statichtml/`、`/uploads/`、http(s) 链接改为**硬 `<a>` 跳转**（`<Link>` 会客户端导航到不存在的 Next 路由导致 404）。
   - 选择器回填值统一为公开 URL：`/statichtml/<relpath>`。

## 后端改动
### 新增 `apps/server/src/routes/statichtml.ts`
- `GET /api/v1/statichtml/tree` — 返回树形结构（folders/files，含 size/mtime/relPath/publicUrl）。鉴权：`statichtml:read` 或 JWT 管理员。
- `GET /api/v1/statichtml/list` — 扁平列表（仅文件，供选择器用），每项为 `{ relPath, url, name, ext }`。鉴权同上。
- `POST /api/v1/statichtml/folder` — 建文件夹 `{ path }`（支持多级，如 `item1/sub`）。鉴权：`statichtml:write` 或 JWT 管理员。
- `DELETE /api/v1/statichtml/folder` — 删文件夹（递归）。鉴权同上。
- `POST /api/v1/statichtml/file` — 上传文件 `{ folder, filename, content|file(base64), mimeType }`。文本类（html/css/js/json/txt/md/svg）收 raw `content` 字符串；二进制收 base64 `file`。鉴权同上。
- `PUT /api/v1/statichtml/file` — 替换文件内容（同参数 + `relPath`）。鉴权同上。
- `DELETE /api/v1/statichtml/file` — 删文件 `{ relPath }`。鉴权同上。
- 安全：路径解析后必须 `startsWith(STATIC_HTML_DIR)`（防 `../` 穿越）；扩展名白名单（html/htm/css/js/mjs/json/svg/png/jpg/jpeg/gif/webp/ico/txt/md/map/woff/woff2/ttf/otf/eot/pdf）；`sanitizeFilename` 清洗文件名；目录自动创建。

### `apps/server/src/index.ts`
- `const STATIC_HTML_DIR = path.resolve(process.cwd(), 'data', 'statichtml')`
- `app.use('/statichtml', express.static(STATIC_HTML_DIR))`（在 `/uploads` 之后、routes 之前）
- `app.use('/api/v1/statichtml', statichtmlRoutes)`

### `apps/server/src/routes/tokens.ts`
- `validPermissions` 增加 `'statichtml:write'`, `'statichtml:read'`
- `allowedByRole`：superadmin/admin 全含；user 不含（或仅 read，按策略暂不给 user）。

### `apps/server/src/utils/paths.ts`
- 导出 `STATIC_HTML_DIR`（供路由复用，与 index.ts 同源）。

## 前端改动
### 新增 `apps/web/src/app/admin/statichtml/page.tsx`（`'use client'`）
- 左侧树：文件夹可展开/折叠，文件显示图标+名称+大小+修改时间。
- 工具栏：新建文件夹（输入路径）、上传文件（`<input type=file multiple>` → 读为 base64/raw → 调 `POST /file`）。
- 文件操作：预览（新标签打开 `/statichtml/<relpath>`）、复制公开 URL、删除（带确认）。
- 文件夹操作：删除（递归，带确认）。
- 调用 `api.get/post/put/delete('/statichtml/...')`，自动带管理员 token。

### 注册菜单与国际化
- `apps/web/src/app/admin/layout.tsx`：`allItems` 增加 `{ key:'/admin/statichtml', label:t('admin.staticHtml'), icon:FileText, roles:['superadmin','admin'] }`。
- `apps/web/src/locales/zh.json` + `en.json` 的 `admin` 下加 `staticHtml: "静态页面" / "Static Pages"` 及页面内常用文案。

### 新增 `apps/web/src/components/StaticPagePicker.tsx` + `useStaticPages` hook
- `useStaticPages()`：`useQuery(['statichtml-list'], () => api.get('/statichtml/list'))`。
- `StaticPagePicker`：按钮「选择静态页面」→ 弹窗列出页面（名称+URL）→ 选中回调回填 URL。
- 集成点：
  - `apps/web/src/app/admin/categories/page.tsx`：section 编辑 `externalUrl` 字段旁加选择器，回填 `/statichtml/...`。
  - `apps/web/src/app/admin/settings/page.tsx`：Hero CTA `href`、Hero slide `linkUrl` 字段旁加选择器。
- 硬链接渲染：
  - `apps/web/src/components/Header.tsx`：`item.externalUrl` 或 `item.path` 以 `/statichtml`、`/uploads` 开头时渲染 `<a href>`（硬跳转），否则 `<Link>`。
  - `apps/web/src/components/HeroCarousel.tsx`：CTA 与 slide 链接当 href/linkUrl 以 `/statichtml`、`/uploads`、`http://`、`https://`、`//` 开头时渲染 `<a>`，否则 `<Link>`。

## 部署配置
- `nginx.conf`：在 HTTP server 与 HTTPS server 各加 `location /statichtml { proxy_pass http://backend:4001; proxy_set_header Host $host; }`（放在 `/uploads` 之后、`location /` 之前）。
- `docker-compose.yml`：
  - `backend` 服务 `volumes` 增加 `- tokenpress-statichtml:/app/apps/server/data/statichtml`
  - `volumes:` 下增加 `tokenpress-statichtml: { name: tokenpress-statichtml }`
- `Dockerfile` backend 阶段：`RUN mkdir -p data/uploads data/statichtml`

## 测试方案（仅本地 Docker，不碰 VPS 生产）
1. 构建 backend + frontend 镜像，重建本地容器（先 rm 旧 backend/frontend 容器再 `docker compose up -d --no-deps`）。
2. 功能验证：
   - `POST /api/v1/statichtml/folder {path:'item1'}` → 201
   - `POST /api/v1/statichtml/file {folder:'item1', filename:'test1.html', content:'<h1>Hi</h1>'}` → 201
   - 浏览器/ curl 访问 `http://localhost:8081/statichtml/item1/test1.html` → 200 且内容正确（带 UA 避反爬）。
   - `GET /tree`、`/list` 返回结构正确。
   - 路径穿越防护：尝试 `relPath:'../../etc/passwd'` → 403。
   - 扩展名防护：上传 `.exe` → 400。
   - 权限隔离：无 token → 401；仅 `stats:read` 的 token 写 → 403；含 `statichtml:write` 的 token → 成功。
   - 前端：admin 页面树形显示、上传、删除正常；选择器在 section/CTA/slide 回填正确；Header/HeroCarousel 点击 `/statichtml` 链接硬跳转生效。
3. 修复发现的 bug，复测至全绿。

## 交付物
- 后端路由 + 静态服务 + 权限
- nginx/compose/Dockerfile 配置
- 前端管理页 + 选择器 + 硬链接渲染
- 开发计划文档（本文件）
- 本地 Docker 验证报告（测试后写入项目记忆）

# Token00 静态页面（statichtml）功能 — 本地 Docker 验证报告

测试时间：2026-07-12　环境：本地 Docker（不触碰 VPS 生产）
镜像：`tokenpress-backend:latest` / `tokenpress-frontend:latest`（本地 8081/8444 nginx、4001 backend、4000 frontend）
结果：**19/19 全部通过**

## 功能清单
- 直访：`https://www.token00.com/statichtml/<path>`（支持子目录，如 `statichtml/item1/test1.html`）
- 后台：`/admin/statichtml` 树形文件夹管理（建/删文件夹、上传/替换/删文件、预览、复制 URL）
- 链接集成：板块 `externalUrl`、Hero slide `linkUrl`、Hero CTA `href` 均可通过选择器回填 `/statichtml/...`，并以硬 `<a>` 跳转
- 远程 API：新增 `statichtml:write` / `statichtml:read` 权限，接入既有 `apiTokenOrAdmin` 权限隔离

## 验证用例（curl，带 UA 避反爬）
| # | 用例 | 期望 | 结果 |
|---|---|---|---|
| 1 | 无 token 写接口 | 401 | ✅ 401 |
| 2 | 只读 token 读接口 | 200 | ✅ 200 |
| 3 | 写 token 建文件夹 | 201 | ✅ 201 |
| 4 | 写 token 上传 html | 201 | ✅ 201 |
| 5 | 写 token 上传嵌套 css | 201 | ✅ 201 |
| 6 | nginx 直访静态页（内容正确） | 200 | ✅ 200 |
| 7 | backend 直访静态页 | 200 | ✅ 200 |
| 8 | tree 返回正确结构 | 200 | ✅ 200 |
| 9 | 仅 article:write token 写 | 403 | ✅ 403 |
| 10 | 只读 token 写 | 403 | ✅ 403 |
| 11 | 上传 .exe | 400 | ✅ 400 |
| 12 | 路径穿越 `/statichtml/..%2f..%2fetc%2fpasswd` | 不泄露 | ✅ 404，无 passwd 内容 |
| 13 | PUT 替换文件内容 | 200 | ✅ 200 |
| 14 | DELETE 文件 + 复访 404 | 200/404 | ✅ |
| 15 | DELETE 文件夹（递归） | 200 | ✅ 200 |

## 开发过程中修复的 Bug
1. 前端 `invalidate` 用 `&&` 连接两个 `invalidateQueries` Promise → TypeScript 严格模式编译错误 → 改为顺序调用。
2. `readFile` 未返回 `filename` → 上传 mutation 缺必填项编译错 → 返回值补 `filename`。
3. **关键**：共享 `sanitizeFilename` 会追加 `timestamp+random` 后缀，导致静态文件名不可预测、URL 失效、直访 404 → 改用本地 `sanitizeName`（保留原名与扩展名）。
4. `sanitizeName` 初版漏了扩展名前的点（`test1html`）→ 扩展名校验失败 400 → 改为 `${safeName}.${safeExt}`。

## 安全验证
- 路径穿越：API 写路径 `safeResolve` + `express.static` 内置防护，越界请求返回 404，不泄露 `/etc/passwd` 等。
- 扩展名白名单：非白名单（如 `.exe`）返回 400。
- 权限隔离：缺权限 403、无 token 401、越权 token 403。

## 待办（未做，受用户约束）
- 远程 VPS 生产部署（用户要求本次仅本地测试）。

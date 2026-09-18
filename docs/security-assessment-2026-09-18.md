# TokenPress 测试与安全评估报告

评估日期：2026-09-18　|　范围：`d:\work\token00`（main 分支）　|　方法：源码审计 + 依赖审计 + 运行实例黑盒探测 + 自动化回归测试

## 结论摘要

| 维度 | 结果 |
|------|------|
| 自动化测试 | 基线 18 例 → 现有 **91 例**，全部通过 |
| 依赖漏洞 | **68 条公告**（2 critical / 32 high / 29 moderate / 5 low），按漏洞实例计 74 项 |
| 源码缺陷 | 16 项（P0 1 / P1 4 / P2 6 / P3 5），**已修复 6 项**，未发现可直接接管线上站点的漏洞 |
| 已验证防线 | 鉴权边界、越权、路径穿越、上传白名单、原型污染、信息泄露 6 类共 51 项断言全部通过 |

本轮已完成的处理：批次 A（本地密钥轮换）+ 批次 B（SEC-05 / 01 / 02 / 08 / 09 / 10）全部落地并经本地 Docker 复验。
仍需决策：**Next.js 14.2.35 的 2 个 critical RCE** 需跨大版本升级到 15.5.24+，属破坏性变更，未执行。

---

## 一、测试资产

### 1.1 测试文件

| 文件 | 用例数 | 覆盖内容 |
|------|--------|----------|
| `apps/server/src/routes/security.integration.test.ts` | 54 | HTTP 层安全回归：鉴权边界 18 项、JWT 真实性 5 项、越权 6 项、路径穿越 7 项、上传白名单与错误码 6 项、注入与原型污染 5 项、信息泄露 5 项、登录保护与验证码表 2 项 |
| `apps/server/src/lib/security.utils.test.ts` | 13 | 纯逻辑层：风格包 id 白名单、文件名清洗、MIME 白名单、SSRF 防护（含 IPv6） |
| `apps/server/src/lib/secrets.test.ts` | 6 | 密钥解析：生产环境缺失/弱密钥拒绝启动、非生产环境一次性随机密钥 |
| 原有 `articles.test.ts` / `ai-publish.test.ts` | 18 | 业务回归，全部保持通过 |

运行方式（与原有测试共用 vitest 配置，未新增依赖）：

```bash
npx vitest run                 # 全量 91 例
npx vitest run security        # 仅安全集成套件
```

测试环境约定：`NODE_ENV=test` → 数据库与上传目录落在 `data-test/`（已被 `.gitignore` 覆盖），不污染运行数据。

### 1.2 故障保护约定

测试只断言**安全属性**（例如「清洗后的文件名 join 基目录后不得逃出」「伪造 XFF 前缀不得重置失败计数」），
不断言实现细节。上一轮的三处已知缺陷已修复，对应断言已从 `it.fails` 改回 `it`，
修复被回退时这些用例会立即转红。

---

## 二、依赖漏洞

完整机读清单：`docs/security-audit-npm-2026-09-18.json`（`pnpm audit --json`，npmmirror 无 audit 端点，已切官方源获取）。

### P0 · Critical（2）

| 公告 | 组件 | 修复版本 | 本项目暴露判断 |
|------|------|----------|----------------|
| GHSA-p293-qw3h-jr36 | next（Windows 托管 RCE） | ≥15.5.24 | 生产部署在 Linux，**不直接受影响**；本地 Windows 开发环境受影响 |
| GHSA-2xp9-vwfh-vxw4 | next（Image Optimization AVIF RCE） | ≥15.5.24 | `next.config.js` 声明了 `image/avif`；仅当 `IMAGES_UNOPTIMIZED≠true` 时启用优化管道。Docker compose 默认 `true`，**生产需实测确认** |

### P1 · High（精选，与本项目相关）

| 公告 | 组件 | 说明 | 暴露判断 |
|------|------|------|----------|
| GHSA-gpj5-g38j-94v9 | drizzle-orm <0.45.2 | SQL 标识符转义不当导致注入 | 当前 0.36；代码未使用动态标识符，**暂不可利用**，建议随升级一并处理 |
| GHSA-c4j6-fc7j-m34r | next（WebSocket 升级 SSRF，CVSS 8.6） | ≥15.5.16 | nginx 已透传 Upgrade 头，存在攻击面 |
| GHSA-89xv-2m56-2m9x | next（Server Actions SSRF，自定义服务器） | ≥15.5.21 | 前端用 `next start`，非自定义服务器 |
| GHSA-p9j2-gv94-2wf4 | next（rewrites 目标主机名 SSRF） | ≥15.5.21 | `rewrites` destination 取自 `BACKEND_URL`，非用户可控 |
| GHSA-36qx-fr4f-26g5 | next（Pages Router i18n 中间件绕过） | ≥15.5.16 | 项目为 App Router，不适用 |
| GHSA-6g55-p6wh-862q / 后续 | postcss | CSS `sourceMappingURL` 任意文件读 | 构建期依赖，需升级 postcss |
| GHSA-hmw2-7cc7-3qxx | form-data <4.0.6 | multipart 字段名 CRLF 注入 | 上传接口走 base64/JSON，不走 multipart |
| GHSA-96hv-2xvq-fx4p | ws <8.21.0 | 分片内存耗尽 DoS | 依赖链间接引入 |
| 其余 | nanoid / brace-expansion / js-yaml / glob / vite | DoS 与 CLI 注入 | 均非运行时用户输入路径，优先级低 |

> 口径说明：`pnpm audit` 汇总行显示 74 vulnerabilities（按依赖实例计），`advisories` 对象为 68 条（按公告去重）。

---

## 三、源码审计发现

状态列：✅ 已修复并纳入回归　⏳ 待处理

### P1

| # | 位置 | 问题 | 状态 |
|---|------|------|------|
| SEC-05 | `middleware/auth.ts`、`routes/auth.ts`、`utils/revalidate.ts` | `JWT_SECRET` 缺失时静默回退硬编码字符串，任何未显式配置的环境都可用公开值伪造 superadmin JWT | ✅ 收敛到 `lib/secrets.ts`：生产环境缺失或长度 <32 直接终止启动，非生产环境生成一次性随机密钥 |
| SEC-06 | `middleware/auth.ts` | JWT 为无状态校验，不查库确认用户是否仍存在/已停用/已改密；用户被停权后旧 token 7 天内仍可用 | ⏳ 需引入 `tokenVersion` 或短期吊销名单，属会话结构改造 |
| SEC-07 | `routes/auth.ts` `/auth/refresh` | 用 access token 换发新的 access token（7d→7d），可无限续期 | ⏳ 需区分 token 类型并改造前端刷新逻辑 |
| SEC-08 | `routes/auth.ts` `getClientIp` | 登录失败锁定按 `X-Forwarded-For` 首段计，该头由客户端可控，轮换前缀即可绕过 5 次锁定与验证码 | ✅ 改用 `req.ip`（`trust proxy=1` 已配置），取 XFF 链中代理追加的真实客户端段 |

### P2

| # | 位置 | 问题 | 状态 |
|---|------|------|------|
| SEC-01 | `middleware/errorHandler.ts` | 所有异常统一 500，body 超限（应 413）、JSON 语法错误（应 400）被吞成 500 | ✅ 按 `err.status` / `err.type` / multer `LIMIT_*` 映射状态码，4xx 走 warn 日志 |
| SEC-02 | `lib/contentReview/imageDownloader.ts` | `PRIVATE_IP_RANGES` 仅覆盖 IPv4，`http://[::1]:PORT/` 可探测本机服务 | ✅ 新增 IPv6 环回 / ULA `fc00::/7` / 链路本地 `fe80::/10` / IPv4-mapped 判定 |
| SEC-09 | `utils/revalidate.ts`、`apps/web/src/app/api/revalidate/route.ts` | 前后端共享默认 secret `token00-revalidate`，且用 `!==` 非恒定时间比较 | ✅ 删除回退默认值，未配置时拒绝全部刷新请求；比较改为 sha256 + `timingSafeEqual` |
| SEC-10 | `routes/auth.ts` 验证码表 | 验证码存于进程内 Map，仅在校验成功/命中过期时删除，未校验的验证码可无限堆积 | ✅ 容量上限 500 + 每 10 分钟清理过期条目，灌入时先执行清理 |
| SEC-11 | `routes/media.ts` `handleUpload` | 上传只信客户端声明的 `mimeType`，不校验文件魔数 | ⏳ 需引入 magic bytes 校验 |
| SEC-12 | `packages/shared/src/constants/index.ts` + 静态目录 | `image/svg+xml` 在允许列表内且同域直出，构成存储型 XSS 媒介 | ⏳ 需剥离 SVG 脚本或改为 attachment 输出 |

### P3

| # | 位置 | 问题 | 状态 |
|---|------|------|------|
| SEC-04 | `packages/shared/src/utils/slug.ts` `sanitizeFilename` | 只清洗主名，扩展名段未清洗，可产生 `name./sub/dir` 这类文件名；实测**无法向上穿越** | ⏳ 对最终结果再清洗一次 |
| SEC-13 | `middleware/cors.ts` | 无 `Origin` 时返回 `ACAO: *` 且同时 `Allow-Credentials: true`（无效组合） | ⏳ 无 origin 场景不设置 ACAO |
| SEC-14 | `index.ts` helmet 配置 | CSP 处于 `reportOnly: true`，`scriptSrc` 允许 unsafe-inline / unsafe-eval | ⏳ 观察期结束后转强制模式 |
| SEC-15 | 依赖 morgan <1.12 | 日志伪造（未转义 Unicode 行分隔符） | ⏳ 升级至 ≥1.12.0 |
| SEC-16 | `index.ts` 静态目录 | `/statichtml`、`/styles` 内容由后台写入且同域提供，写入者即管理员 | ⏳ 随 CSP 收敛一并处理 |

---

## 四、已验证通过的防线（黑盒 + 自动化，共 51 项断言）

| 类别 | 结论 |
|------|------|
| 鉴权边界 | `/users`、`/tokens`、`/admin/articles`、`/media`、`/backup`、`/stats`、`/logs/*`、`/styles`、`/admin/reviews`、`/admin/ads`、`/admin/sensitive-keywords`、`/statichtml/tree` 未携带凭证全部 401 |
| JWT 真实性 | 错误密钥、历史硬编码默认密钥、alg=none、篡改 payload、缺 Bearer 前缀全部 401 |
| 越权 | admin 访问备份接口 403；`styles:read` Token 写风格包 403；普通角色不得授予越权 Token、不得创建管理员；普通用户只见自身记录；用户列表不泄露 `passwordHash` |
| 路径穿越 | 媒体文件接口 4 种穿越载荷全部拒绝；上传与静态页写入的落盘路径均锁在基目录内；静态页 `folder=../../escape` 被拒 |
| 上传 | `application/x-msdownload`、`text/html` 被拒；超限返回 413、畸形 JSON 返回 400 |
| 注入 | `search=' OR 1=1--` 不报错、不注入；风格包 PATCH 拒绝 `$.name`、`__proto__.polluted`、非法 id |
| 信息泄露 | 未知 Origin 不返回 ACAO；已安装站点拒绝再次触发安装向导；健康检查不含密钥/路径；错误响应不含堆栈 |
| 登录保护 | 伪造 XFF 前缀不改变失败计数归属（按代理追加段计），达到阈值后触发验证码门槛 |
| 备份还原 | Zip Slip 防护（`isPathSafe`）、条目数/压缩比/体积上限齐备 |

---

## 五、本轮已执行的修复

### 5.1 密钥轮换（批次 A，本地）

| 项 | 处理 |
|----|------|
| `JWT_SECRET` | 替换为 `crypto.randomBytes(32).toString('hex')` 生成的 64 位十六进制随机值 |
| `REVALIDATE_SECRET` | 同上，独立生成 |
| 注入路径 | 仓库根 `.env` → `docker-compose.yml` 的 `backend` / `frontend` 环境 |
| 副作用 | 本地后台登录态失效（需重新登录一次）；API Token（`t00_sk_`）存于数据库，不受影响，发布技能无需重建 |
| `.env.example` | 弱示例值已删除，改为空值 + 生成命令说明 |

### 5.2 代码修复（批次 B）

| # | 改动 |
|---|------|
| SEC-05 | 新增 `apps/server/src/lib/secrets.ts`，统一解析 `JWT_SECRET` / `REVALIDATE_SECRET`；生产环境缺失或 <32 位抛错终止启动，非生产环境生成一次性随机密钥并告警。`middleware/auth.ts`、`routes/auth.ts`、`utils/revalidate.ts` 改为惰性读取 |
| SEC-01 | `middleware/errorHandler.ts` 按 `err.status`、`err.type`（`entity.too.large` / `entity.parse.failed` 等）、multer `LIMIT_*` 映射状态码；4xx 记 warn、5xx 记 error |
| SEC-02 | `imageDownloader.ts` 的 `isPrivateIp` 支持 IPv6：环回 `::1`、未指定 `::`、ULA `fc00::/7`、链路本地 `fe80::/10`、IPv4-mapped/兼容写法一律拒绝 |
| SEC-08 | `getClientIp` 改为 `req.ip` 优先（`trust proxy=1`），并归一化 `::ffff:` 前缀 |
| SEC-09 | 前端 `/api/revalidate` 删除默认口令回退，未配置时拒绝全部请求；比较改为 sha256 归一化后 `timingSafeEqual` |
| SEC-10 | 验证码表容量上限 500，签发时与每 10 分钟各执行一次过期清理 + 超限淘汰 |

### 5.3 本地 Docker 复验（容器重建后实测）

| 探测 | 期望 | 实测 |
|------|------|------|
| 新密钥签发 JWT → `/auth/me` | 200 | ✅ 200 |
| 历史硬编码默认密钥签发 JWT | 401 | ✅ 401 |
| 轮换前的旧本地密钥签发 JWT | 401 | ✅ 401 |
| 无凭证访问 `/users` | 401 | ✅ 401 |
| `/api/revalidate` 携带新密钥 | 200 | ✅ 200 |
| `/api/revalidate` 携带旧口令 / 默认口令 | 401 | ✅ 401 |
| 超限请求体（11MB base64） | 413 | ✅ 413 |
| 畸形 JSON 请求体 | 400 | ✅ 400 |
| nginx 首页 8081 | 200 | ✅ 200 |
| 后端容器启动日志 | 无 SEC-05 告警 | ✅ 无告警（密钥已注入且强度达标） |

---

## 六、剩余处理顺序

| 批次 | 内容 | 状态 |
|------|------|------|
| A | 轮换密钥 | 本地已完成；**生产 VPS 待单独授权**（需同步 `.env` 并重建 backend / frontend 容器，届时生产后台登录态失效） |
| B | SEC-05 / 01 / 02 / 08 / 09 / 10 | ✅ 已完成 |
| C | SEC-06 会话吊销（`tokenVersion`）、SEC-07 refresh 与 access 分离 | 需设计确认，涉及前端刷新逻辑与会话结构 |
| D | next 14 → 15.5.24+（破坏性，需回归全站）、drizzle-orm → ≥0.45.2、postcss / ws / morgan 等 | 需单独排期，建议先在 dev 分支验证 |
| E | SEC-11 魔数校验、SEC-12 SVG 输出策略、SEC-04 文件名二次清洗、SEC-13 CORS、SEC-14 CSP 转强制 | 低优先级加固 |

---

## 七、复现方式

```bash
# 依赖审计（npmmirror 无 audit 端点，必须指定官方源）
pnpm audit --json --registry=https://registry.npmjs.org > _security_audit.json

# 安全回归测试
npx vitest run security

# 黑盒探测（需服务在 4001 运行）
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0' http://127.0.0.1:4001/api/v1/users   # 期望 401
curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0' --path-as-is \
  'http://127.0.0.1:4001/api/v1/media/files/uploads/../../../../etc/passwd'                    # 期望 403/404

# 生成强随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

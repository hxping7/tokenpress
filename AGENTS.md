# TokenPress 项目记忆

## 技术栈
- **Monorepo**: pnpm 9.15 workspace + Turbo
- **前端**: Next.js 14.2 (App Router) + React 18.3 + Tailwind CSS 3.4 + Zustand 5 + @tanstack/react-query 5 + Framer Motion 11 + lucide-react
- **后端**: Express.js 4.21 + SQLite (@libsql/client 0.14) + Drizzle ORM 0.36
- **认证**: JWT (jsonwebtoken 9) + bcryptjs + svg-captcha
- **语言**: TypeScript 5.7
- **i18n**: 自定义实现 (`@/lib/i18n` + `@/stores` localeStore), 翻译文件在 `apps/web/src/locales/zh.json` 和 `en.json`
- **Markdown**: react-markdown 9 + rehype-highlight 7 + rehype-raw 7 + remark-gfm 4 + shiki 1.24
- **日志**: Pino 9
- **测试**: Vitest

## 项目结构
```
token00/
├── apps/
│   ├── web/          # Next.js 前端
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [section]/        # 动态板块路由
│   │       │   │   ├── [slug]/       # 文章详情
│   │       │   │   └── page.tsx      # 板块列表页
│   │       │   ├── admin/            # 管理后台
│   │       │   │   ├── layout.tsx    # Admin布局（侧边栏+权限守卫）
│   │       │   │   ├── page.tsx      # 仪表盘
│   │       │   │   ├── settings/page.tsx  # 系统设置（10 Tab）
│   │       │   │   ├── articles/     # 文章管理
│   │       │   │   ├── categories/   # 分类管理
│   │       │   │   ├── media/        # 媒体库
│   │       │   │   ├── users/        # 用户管理
│   │       │   │   ├── tokens/       # API Token管理
│   │       │   │   ├── stats/        # API统计
│   │       │   │   ├── ai-debug/     # AI发布调试
│   │       │   │   ├── reviews/      # 内容审核
│   │       │   │   └── logs/         # 日志查看
│   │       │   ├── auth/login/       # 登录页
│   │       │   ├── search/           # 搜索页
│   │       │   ├── api/revalidate/   # Next.js ISR revalidate
│   │       │   ├── feed.xml/         # RSS Feed
│   │       │   ├── robots.txt/       # robots.txt
│   │       │   └── sitemap.xml/      # sitemap.xml
│   │       ├── components/
│   │       │   ├── ui/               # 基础UI组件 (Button/Input/Modal/Toast)
│   │       │   ├── Header.tsx        # 顶部导航
│   │       │   ├── Footer.tsx        # 底部导航（从site_settings读取footer_nav JSON）
│   │       │   ├── FooterLogo.tsx    # 底部Logo
│   │       │   ├── Logo.tsx          # Logo组件
│   │       │   ├── HeroCarousel.tsx  # 首页轮播
│   │       │   ├── ArticleCard.tsx   # 文章卡片
│   │       │   ├── ArticleSidebar.tsx
│   │       │   ├── MarkdownContent.tsx
│   │       │   ├── MarkdownEditor.tsx
│   │       │   ├── SearchBar.tsx
│   │       │   ├── Pagination.tsx
│   │       │   ├── BackToTop.tsx
│   │       │   ├── ViewToggle.tsx    # 视图切换 (grid/list)
│   │       │   ├── TableOfContents.tsx
│   │       │   ├── SectionPageClient.tsx
│   │       │   ├── SectionSidebar.tsx
│   │       │   ├── AnalyticsLoader.tsx
│   │       │   └── LocaleInitializer.tsx
│   │       ├── providers/
│   │       │   ├── query-provider.tsx
│   │       │   └── toast-provider.tsx
│   │       ├── lib/
│   │       │   ├── api.ts            # API客户端封装 (Bearer token自动注入)
│   │       │   ├── i18n.ts           # i18n工具函数
│   │       │   ├── cn.ts             # Tailwind类名合并 (clsx + twMerge)
│   │       │   ├── cookies.ts        # Cookie工具
│   │       │   └── reading-time.ts   # 阅读时间计算
│   │       ├── stores/
│   │       │   ├── auth.ts           # useAuthStore (token/refreshToken/user, localStorage持久)
│   │       │   ├── index.ts          # useThemeStore + useLocaleStore (cookie持久)
│   │       │   ├── layout.ts         # useLayoutStore (grid/list视图, localStorage持久)
│   │       │   └── locale.ts         # 类型: Locale('zh'|'en'), ThemeName('night'|'cyber'|'lava'|'light'|'space')
│   │       └── locales/              # zh.json / en.json
│   └── server/        # Express 后端
│       └── src/
│           ├── index.ts              # 服务入口，注册所有路由和中间件
│           ├── db/
│           │   ├── schema.ts         # Drizzle ORM schema（16张表）
│           │   ├── config.ts         # 数据库连接配置
│           │   ├── seed.ts           # 种子数据
│           │   └── migrations/       # 12个迁移文件 (0001~0012)
│           ├── routes/
│           │   ├── auth.ts           # 认证API (登录/注册/刷新/验证码)
│           │   ├── articles.ts       # 公开文章API
│           │   ├── admin-articles.ts # 管理员文章CRUD
│           │   ├── ai-publish.ts     # AI发布API (Token认证, 10次/分限流)
│           │   ├── categories.ts     # 分类CRUD
│           │   ├── sections.ts       # 板块CRUD
│           │   ├── friend-links.ts   # 友链CRUD
│           │   ├── site-settings.ts  # 站点设置API (GET/PUT)
│           │   ├── search.ts         # 全文搜索 (FTS5)
│           │   ├── tags.ts           # 标签API
│           │   ├── media.ts          # 媒体文件上传/管理
│           │   ├── users.ts          # 用户管理
│           │   ├── tokens.ts         # API Token管理
│           │   ├── stats.ts          # API统计
│           │   ├── logs.ts           # 日志查看
│           │   ├── backup.ts         # 备份管理
│           │   ├── captcha.ts        # 验证码 (SVG)
│           │   ├── admin-reviews.ts  # 内容审核管理API
│           │   └── admin-sensitive-keywords.ts # 敏感词管理API
│           ├── middleware/
│           │   ├── auth.ts           # JWT认证
│           │   ├── apiToken.ts       # API Token认证
│           │   ├── cors.ts           # CORS
│           │   ├── antiScraping.ts   # 反爬虫 (UA黑名单+图片防盗链)
│           │   └── errorHandler.ts   # 错误处理
│           ├── lib/
│           │   └── contentReview/    # 内容审核核心库
│           │       ├── index.ts      # 审核主入口 (scheduleReview + reviewContent)
│           │       ├── types.ts      # 审核类型定义
│           │       ├── extractText.ts # 文本提取 (去Markdown/HTML)
│           │       ├── extractImages.ts # 图片URL提取
│           │       ├── sensitiveScanner.ts # 本地敏感词扫描
│           │       ├── imageDownloader.ts # 图片下载器 (含SSRF防护)
│           │       ├── statusManager.ts # 审核状态推进
│           │       └── providers/    # 云服务商适配器
│           │           ├── index.ts  # 服务商路由 + 环境变量配置
│           │           └── tencent.ts # 腾讯云审核 (TC3-HMAC-SHA256)
│           ├── workers/
│           │   └── reviewScheduler.ts # 异步审核Worker (5s轮询+启动补偿)
│           └── utils/
│               ├── logger.ts         # Pino日志
│               ├── auditLogger.ts    # 审计日志
│               ├── params.ts         # 参数校验
│               └── revalidate.ts     # Next.js ISR revalidate
├── packages/
│   └── shared/        # 共享类型和常量
│       └── src/
│           ├── types/index.ts        # 共享类型定义
│           ├── constants/index.ts    # 共享常量
│           └── utils/slug.ts         # 工具函数 (generateSlug, extractExcerpt, formatFileSize等)
├── data/              # 运行时数据 (token00.db + uploads + backups)
├── deploy.conf        # 部署配置
├── deploy.conf.sample # 部署配置示例
├── host.conf          # VPS SSH连接信息
├── host.conf.sample   # VPS配置示例
├── deploy.sh          # VPS端部署脚本
├── deploy-windows-docker.bat  # Windows本地Docker部署
├── deploy-local.sh            # Linux本地部署
├── deploy-local-to-vps.bat    # VPS部署
├── docker-compose.yml         # Docker Compose (backend+frontend+nginx)
├── Dockerfile                 # 多阶段构建 (backend+frontend)
├── Dockerfile.server          # 简单生产镜像 (仅后端, alpine:3.19)
├── nginx.conf                 # Nginx反向代理配置
└── DEPLOY.md                  # 部署文档
```

## 核心数据模型

### 数据库表 (18张)
| 表名 | 说明 |
|------|------|
| `sections` | 板块 (name, slug, path, externalUrl, sortOrder, isActive) |
| `users` | 用户 (username, passwordHash, displayName, role: superadmin/admin/user, isActive) |
| `apiTokens` | API Token (userId, token, name, permissions:JSON, expiresAt, isActive) |
| `categories` | 分类 (name, slug, sectionId, sortOrder) |
| `articles` | 文章 (title, slug, content, excerpt, coverImage, sectionId, categoryId, status: draft/published/archived/scheduled/pending_review) |
| `tags` | 标签 |
| `articleTags` | 文章-标签关联 |
| `media` | 媒体文件 (filename, mimeType, size, url, thumbnailUrl, width, height, duration, isReviewed, reviewNote) |
| `apiLogs` | API使用日志 (tokenId, endpoint, method, statusCode, responseTime, contentUrl) |
| `friendLinks` | 友链 (name, url, description, sortOrder, isActive) |
| `siteSettings` | 站点设置 KV (key:unique, value) |
| `loginLogs` | 登录日志 (ipAddress, username, success, reason) |
| `loginProtect` | 登录保护 (ipAddress:unique, failCount, lockedUntil, captchaRequired) |
| `backups` | 备份 (filename, size, type: manual/auto, status: pending/completed/failed) |
| `auditLogs` | 审计日志 (operatorId, operatorName, action, targetType, targetId, detail) |
| `systemEvents` | 系统事件 (eventType, level: info/warn/error, message) |
| `contentReviews` | 内容审核 (targetType, targetId, version, localScanStatus, cloudTextStatus, cloudImageStatus, manualStatus, finalVerdict) |
| `sensitiveKeywords` | 敏感词 (keyword:unique, category, severity, action, scope, enabled) |

### site_settings 重要 key
- `site_name` / `site_description` - 站点名称/描述
- `header_logo` / `footer_logo` - Logo URL
- `footer_nav` - 底部导航分组JSON (FooterNavGroup[])
- `footer_nav_columns` - 底部导航列数
- `hero_slides` / `hero_effect` - 首页轮播
- `friend_links_columns` - 友链列数
- `copyright_text` / `icp_number` - 版权/备案
- `analytics_code` - 统计代码
- `anti_scraping_enabled` - 反爬虫开关
- `default_theme` / `frontend_locale` / `backend_locale` - 主题/语言

### FooterNavGroup 类型
```typescript
interface FooterNavGroup {
  title: string        // 分组标题
  links?: NavItem[]    // 链接列表（链接分组）
  html?: string        // 自定义HTML内容（HTML分组，如二维码/联系方式）
}
// links 和 html 互斥：有 html 则为HTML分组，否则为链接分组
```

### HeroSlide 类型
```typescript
interface HeroSlide {
  id: string
  imageUrl: string
  linkUrl: string
  linkTarget: '_blank' | '_self'
}
```

### API权限
```typescript
type ApiPermission = 'article:write' | 'media:upload' | 'work:write' | 'content:delete' | 'settings:write'
// superadmin: 全部5项 | admin: 前4项 | user: article:write + media:upload
```

## API 路由

### 公开路由
- `POST /api/v1/auth` - 认证（登录/注册/刷新Token/验证码）
- `GET /api/v1/articles` - 公开文章API
- `GET /api/v1/categories` - 分类API
- `GET /api/v1/sections` - 板块API
- `GET /api/v1/friend-links` - 友链API
- `GET /api/v1/site-settings` - 站点设置API
- `GET /api/v1/site-settings/keys/:keys` - 按key获取（逗号分隔）
- `GET /api/v1/search` - 全文搜索API
- `GET /api/v1/tags` - 标签API
- `GET /api/v1/health` - 健康检查

### Admin/JWT保护路由
- `PUT /api/v1/site-settings` - 批量更新（需Admin认证或settings:write权限）
- `/api/v1/users` - 用户管理
- `/api/v1/admin/articles` - 管理员文章操作
- `/api/v1/tokens` - API Token管理
- `/api/v1/media` - 媒体文件管理
- `/api/v1/stats` - API统计
- `/api/v1/logs` - 日志查看
- `/api/v1/backup` - 备份管理
- `/api/v1/admin/reviews` - 内容审核管理（列表/统计/通过/拒绝/重试）
- `/api/v1/admin/sensitive-keywords` - 敏感词管理（CRUD）

### API Token保护路由
- `/api/v1/ai` - AI发布API（额外限流：10次/分钟）

### 限流配置
- 全局: 100次/分 | auth: 20次/15分 | articles: 30次/分 | ai-publish: 10次/分

### 中间件顺序
helmet(CSP report-only) → cors → antiScraping(UA黑名单) → imageHotlinkProtection → express.json(10MB) → 请求日志 → rate-limit

## 管理后台设置页 (10 Tab)
`basic` | `ui` | `logo` | `hero` | `nav` | `links` | `footer` | `backup` | `analytics` | `security`

## 代码风格
- camelCase 命名（handleXxx, xxxMutation, xxxRef）
- Tailwind CSS 工具类 + CSS 变量主题（text-t-text-primary, bg-t-bg-secondary, text-t-accent-blue 等）
- 不加注释除非必要
- 组件 'use client' 指令用于客户端组件
- i18n: `t('key', locale)` 函数调用

## 部署
- 本地Windows Docker: `./deploy-windows-docker.bat`
- 本地Linux: `./deploy-local.sh`
- VPS: `./deploy-local-to-vps.bat all`
- VPS部署流程: build(docker save|gzip) → split(50MB分块) → SCP逐块上传(断点续传:VPS检测已上传块跳过) → VPS合并 → deploy.sh导入启动
- Docker Compose: backend + frontend + nginx 三服务

# TokenPress 项目架构文档

## 整体架构：Monorepo (Turborepo + pnpm workspaces)

```
TokenPress/
├── apps/server/          # 后端 Express.js API 服务
├── apps/web/             # 前端 Next.js 网页应用
├── packages/shared/      # 共享类型、常量、工具
├── docker-compose.yml    # 3服务容器编排 (nginx + backend + frontend)
├── Dockerfile            # 多阶段构建 (backend + frontend)
└── nginx.conf            # Nginx 反向代理
```

## 技术栈

| 层 | 技术 | 版本 |
|---|------|------|
| **后端** | Express.js | 4.21.1 |
| **ORM** | Drizzle ORM | 0.36.0 |
| **数据库** | libSQL/SQLite | 0.14.0 |
| **认证** | jsonwebtoken + bcryptjs | 9.0.2 / 2.4.3 |
| **前端框架** | Next.js (App Router) | 14.2.20 |
| **UI库** | React | 18.3.1 |
| **CSS** | Tailwind CSS | 3.4.16 |
| **状态管理** | Zustand | 5.0.2 |
| **数据请求** | TanStack React Query | 5.62.0 |
| **动画** | Framer Motion | 11.15.0 |
| **构建编排** | Turborepo | 2.3.0 |
| **包管理** | pnpm | 9.15.0 |
| **语言** | TypeScript | 5.7.0 |
| **部署** | Docker Compose + Nginx | - |

## 目录结构

### 顶层目录

```
TokenPress/
├── apps/                        # 应用包 (monorepo apps)
│   ├── server/                  # 后端 API 服务 (Express.js)
│   └── web/                     # 前端 Web 应用 (Next.js)
├── packages/                    # 共享包 (monorepo libs)
│   └── shared/                  # 共享类型、常量、工具
├── certbot/                     # Let's Encrypt SSL 证书
├── data/                        # 本地数据库 & 上传文件
├── docs/                        # 项目文档
├── logodesign/                  # Logo 设计资源
├── package.json                 # 根 monorepo 配置
├── pnpm-workspace.yaml          # pnpm 工作区定义
├── turbo.json                   # Turborepo 管道配置
├── docker-compose.yml           # Docker Compose (3服务)
├── Dockerfile                   # 多阶段 Docker 构建
├── Dockerfile.server            # 简单生产镜像
├── nginx.conf                   # Nginx 反向代理配置
├── deploy.conf                  # 部署配置
├── host.conf                    # VPS SSH 连接信息
└── .env                         # 环境变量
```

## 后端架构 (`apps/server/src/`)

### 入口与启动

- **入口文件**: `src/index.ts`
- **端口**: 4001 (可通过 `PORT` 环境变量配置)
- **启动流程**:
  1. 加载 dotenv 环境变量
  2. 创建 Express 应用
  3. 应用中间件: helmet, cors, JSON解析, morgan日志, 限流
  4. 注册所有路由模块
  5. 运行 7 个顺序数据库迁移
  6. 启动 HTTP 服务

### 目录结构

```
src/
├── index.ts              # Express 服务入口
├── db/
│   ├── index.ts          # 数据库连接 (libSQL/SQLite via Drizzle ORM)
│   ├── schema.ts         # 完整数据库 Schema
│   ├── seed.ts           # 数据库种子
│   └── migrations/       # 7个顺序迁移
│       ├── 0001_initial.ts
│       ├── 0002_sections.ts
│       ├── 0003_external_url.ts
│       ├── 0004_friend_links.ts
│       ├── 0005_site_settings.ts
│       ├── 0006_separate_locales.ts
│       └── 0007_login_protect.ts
├── middleware/
│   ├── auth.ts           # JWT 认证中间件 + adminOnly 守卫
│   ├── apiToken.ts       # API Token 认证 + 权限检查 + 使用日志
│   └── errorHandler.ts   # 错误处理中间件
├── routes/
│   ├── auth.ts           # 认证 (登录、注册、刷新、修改密码) 含验证码与暴力防护
│   ├── users.ts          # 用户 CRUD (管理员保护)
│   ├── articles.ts       # 公开文章列表/阅读
│   ├── admin-articles.ts # 管理员文章 CRUD (JWT 保护)
│   ├── ai-publish.ts     # AI 发布 API (API Token 保护)
│   ├── categories.ts     # 分类 CRUD
│   ├── sections.ts       # 板块 CRUD
│   ├── friend-links.ts   # 友链 CRUD
│   ├── site-settings.ts  # 站点设置 CRUD
│   ├── tokens.ts         # API Token 管理
│   ├── media.ts          # 媒体上传/管理
│   ├── stats.ts          # 仪表盘统计
│   └── captcha.ts        # SVG 验证码生成
└── utils/
    └── params.ts         # 查询参数解析工具
```

### 数据库表 (12张)

| 表名 | 用途 |
|------|------|
| `sections` | 内容板块 |
| `users` | 用户 |
| `api_tokens` | API 令牌 |
| `categories` | 分类 |
| `articles` | 文章 |
| `tags` | 标签 |
| `article_tags` | 文章-标签关联 |
| `media` | 媒体文件 |
| `api_logs` | API 调用日志 |
| `friend_links` | 友情链接 |
| `site_settings` | 站点设置 |
| `login_logs` | 登录日志 |
| `login_protect` | 登录保护 (暴力防御) |

### 认证与授权

1. **JWT 认证** — 管理员/编辑用户登录和会话管理
2. **API Token 认证** — 程序化/AI 访问 (前缀 `t00_sk_`，基于权限)
3. **登录保护** — 验证码 + IP 锁定防暴力破解
4. **角色控制** — admin/editor/user 角色

## 前端架构 (`apps/web/src/`)

### 目录结构

```
src/
├── app/                           # Next.js App Router 页面
│   ├── layout.tsx                 # 根布局 (Header + Footer + Providers)
│   ├── page.tsx                   # 首页
│   ├── [section]/                 # 动态板块页面
│   │   └── [slug]/               # 文章详情页
│   ├── admin/                    # 管理后台
│   │   ├── page.tsx              # 文章管理
│   │   ├── categories/           # 分类管理
│   │   ├── claw/                 # Claw 内容管理
│   │   ├── media/                # 媒体库
│   │   ├── settings/             # 站点设置
│   │   ├── stats/                # 统计仪表盘
│   │   ├── tokens/               # API Token 管理
│   │   └── users/                # 用户管理
│   ├── auth/login/               # 登录页
│   ├── auth/change-password/     # 修改密码页
│   ├── ai-coding/                # AI Coding 板块
│   ├── ai-works/                 # AI Works 板块
│   ├── blog/                     # Blog 板块
│   ├── claw/                     # Claw 板块
│   └── token-plan/               # Token Plan 板块
├── components/                    # 可复用 UI 组件
│   ├── Header.tsx                 # 导航头
│   ├── Footer.tsx                 # 页脚
│   ├── Logo.tsx                  # Logo 组件
│   ├── ArticleCard.tsx           # 文章卡片
│   ├── MarkdownContent.tsx       # Markdown 渲染器
│   ├── MarkdownEditor.tsx        # Markdown 编辑器
│   ├── Pagination.tsx            # 分页组件
│   ├── SectionPage.tsx           # 通用板块页模板
│   └── LocaleInitializer.tsx    # 国际化初始化
├── lib/                           # 工具库
│   ├── api.ts                    # API 客户端 (类型化方法)
│   ├── cn.ts                     # 类名合并工具
│   ├── cookies.ts                # Cookie 工具
│   └── i18n.ts                   # 国际化工具
├── stores/                        # 状态管理 (Zustand)
│   ├── index.ts                  # 主 Store
│   ├── auth.ts                   # 认证状态
│   └── locale.ts                 # 语言状态
├── providers/                     # React Context 提供者
│   └── query-provider.tsx        # React Query 提供者
├── locales/                       # 翻译文件
│   ├── zh.json                   # 中文
│   └── en.json                   # 英文
└── styles/
    └── globals.css               # 全局样式 (CSS 自定义属性)
```

### 内容板块 (5个)

Claw, Token Plan, AI Coding, AI Works, Blog

### 状态管理

- **Zustand** — 客户端状态 (认证、语言、UI)
- **TanStack React Query** — 服务端状态 (数据请求、缓存)

### 国际化

中英双语，翻译文件位于 `locales/zh.json` 和 `locales/en.json`

## 共享包 (`packages/shared/src/`)

```
src/
├── index.ts              # 主入口 (重导出)
├── types/
│   └── index.ts          # 共享 TypeScript 接口
├── constants/
│   └── index.ts          # 共享常量
└── utils/
    └── slug.ts            # Slug 生成工具
```

- **types**: User, ApiToken, Section, Category, Article, Tag, Media, ApiResponse, PaginatedResponse, AIPublishDTO 等
- **constants**: DEFAULT_SECTIONS, USER_ROLES, CONTENT_STATUS, API_PERMISSIONS, UPLOAD_LIMITS, JWT_EXPIRES_IN, API_TOKEN_PREFIX, 限流配置等

## 部署架构

### 请求流转

```
浏览器 → Nginx (HTTP_PORT / HTTPS_PORT)
           ├── /api/v1/*  → Backend:4001
           ├── /uploads/* → Backend:4001
           └── /*         → Frontend:4000
```

### Docker Compose 服务

| 服务 | 镜像 | 内部端口 | 外部端口 | 用途 |
|------|------|----------|----------|------|
| **nginx** | nginx:alpine | 80/443 | 8081/8444 | 反向代理, SSL 终止 |
| **backend** | TokenPress-backend | 4001 | 4001 | Express API 服务 |
| **frontend** | TokenPress-frontend | 4000 | 4000 | Next.js Web 应用 |

### 多阶段 Docker 构建 (Dockerfile)

1. **backend-builder** (node:20-alpine) — 安装依赖，构建 shared 包，编译 TypeScript
2. **backend** (node:20-alpine) — 复制编译产物 + 生产依赖，运行 `node dist/index.js`
3. **frontend-builder** (node:20-alpine) — 安装依赖，构建 Next.js 应用
4. **frontend** (node:20-alpine) — 复制构建产物 + 依赖，运行 `npx next start`

### 数据持久化

Docker volume `TokenPress-data` 挂载到后端，存储 SQLite 数据库 + 上传文件

### 部署命令

| 场景 | 命令 |
|------|------|
| 本地 Windows | `./deploy-windows-docker.bat` |
| 本地 Linux | `./deploy-local.sh` |
| VPS 部署 | `./deploy-local-to-vps.bat all` |

### VPS 部署流程

```
本地机器                              VPS
┌──────────────────┐          ┌──────────────────┐
│  构建 Docker 镜像 │──SCP──> │  加载镜像         │
│  导出为 .tar      │          │  生成 .env        │
│  上传配置文件      │          │  docker compose   │
└──────────────────┘          └──────────────────┘
```

## 关键配置文件

| 文件 | 用途 |
|------|------|
| `.env` | 根环境变量 (端口、JWT密钥、站点URL) |
| `deploy.conf` | 部署配置 (域名、端口、密钥) |
| `host.conf` | VPS SSH 连接信息 |
| `nginx.conf` | Nginx 反向代理与 SSL 配置 |
| `apps/server/.env` | 后端环境变量 |
| `apps/web/.env` | 前端环境变量 |
| `apps/web/next.config.mjs` | Next.js 配置 (API 代理重写) |
| `apps/web/tailwind.config.js` | Tailwind 主题配置 |
| `turbo.json` | Turborepo 构建管道 |
| `pnpm-workspace.yaml` | pnpm 工作区定义 |

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./logodesign/logo-tp-v2-hexicon.svg">
    <img alt="TokenPress" src="./logodesign/logo-tp-v2-hexicon.svg" width="360">
  </picture>
</p>

<p align="center">
  <b>AI 赋能的内容创作平台 & 博客引擎</b><br>
  <i>Token 力量无限放大 — 让每个创作 Token 被 AI 放大价值</i>
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/readme-了解项目-6366f1?style=flat-square" alt="Readme"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-339933?style=flat-square&logo=node.js" alt="Node"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-9.15-F69220?style=flat-square&logo=pnpm" alt="pnpm"></a>
</p>

---

## ✨ 简介

**TokenPress** 是一个 **AI 原生内容创作平台** — 它不只是一个博客系统，更是一个连接人工创作与 AI 能力的枢纽。

名称源于 Token（创作/词元投入）+ Express + Press（出版），寓意将每一次 AI 协作创作的投入，放大为真正有影响力的内容。

### 核心理念

> **每个 Token = 一次创作投入**
> **∞ = AI 放大你的能力边界**

### 四大板块

| 板块 | 定位 | 用户心智 |
|------|------|---------|
| **Token 计划** | 创作日志 / 看板 | "我在做什么、想做什么、完成了什么" |
| **AI 编程** | 开发记录 | "这个功能怎么实现的，AI 帮了什么" |
| **AI 作品** | AI 协作作品展示 | "用 AI 生成的图/视频/内容" |
| **博客** | 想法碎片 | "偶尔的思考、观点、灵感" |

---

## 🚀 特性

### 🤖 AI 原生集成
- **AI 远程发布 API** — 支持通过 API Token 从 WorkBuddy、OpenClaw、QClaw 等 AI 智能体远程发布文章
- **自适应速率限制** — AI 发布 API 自带 10次/分的限流保护
- **内容审核系统** — 敏感词扫描 + 图片审核 + 多层审批工作流

### 📝 强大的内容管理
- **Markdown 编辑器** — 实时预览 + 语法高亮 + 媒体插入
- **多板块/分类/标签** — 灵活的内容组织体系
- **全文搜索** — 基于 SQLite FTS5 的内置搜索引擎
- **文章置顶** — 全局 / 板块级置顶，后台一键置顶与取消
- **状态管理** — 草稿 / 已发布 / 定时发布 / 待审核 / 归档
- **文章互动** — 点赞、浏览计数、收藏（浏览器书签引导）、社交分享（微信 / 朋友圈 / 微博 / QQ / Telegram 等，展示位置后台可配）

### 🎨 前端体验
- **5 套主题** — Night（暗夜）、Cyber（赛博）、Lava（熔岩）、Light（光）、Space（太空）
- **中英文国际化** — 完整的 i18n 支持
- **响应式设计** — 桌面 + 平板 + 手机全端适配
- **Framer Motion 动效** — 流畅的页面过渡和交互动画
- **Grid / List 视图切换** — 灵活的浏览模式
- **首页轮播尺寸可调** — 默认 / 宽屏 / 全屏 三种模式，后台一键切换
- **社交分享卡片** — 文章页一键分享到微信（二维码）/ 朋友圈 / 微博 / QQ / Telegram 等平台

### 🔧 全功能管理后台
- **文章 / 作品管理** — CRUD + 批量操作
- **用户管理** — 三级角色体系（superadmin / admin / user）
- **API Token 管理** — 细粒度权限隔离（19 项权限：article:write / media:upload / settings:write / friendlinks:write / sections:write / categories:write / users:write / stats:read / logs:read / backup:write / reviews:write / keywords:write / ads:write|read|delete / statichtml:write|read 等），支持 AI 智能体远程管控全站设置
- **媒体库** — 上传、缩略图、预览、审核
- **分类管理** — 板块级分类
- **广告管理** — 11 个广告位 + 定向投放 + 曝光/点击统计
- **系统设置** — 10 个设置 Tab（站点信息、导航、SEO、分析、安全等）
- **静态页面管理** — 后台树形管理静态 HTML（文件夹 / 文件增删改、重命名、扩展名防护），支持 `/statichtml/<path>` 直访，可嵌入板块 / Hero / CTA 链接
- **API 统计面板** — 请求量、响应时间、使用趋势
- **AI 发布调试面板** — 在线调试 AI 发布流程
- **备份管理** — 数据库备份与恢复
- **日志查看** — API 调用日志含 Token 所属用户/名称/密钥前缀、登录日志、审计日志、系统事件
- **审计日志** — 关键操作全记录

### 🔒 安全与反滥用
- **JWT 双令牌认证** — Access Token + Refresh Token
- **验证码** — 登录 SVG 验证码，防暴力破解
- **反爬虫中间件** — 后台可开关；拦截 curl / python-requests / scrapy / go-http-client 等工具 UA，放行 Google / Bing / Baidu 等搜索引擎；含图片防盗链
- **请求速率限制** — 全局 + API 级别限流
- **内容审核** — 腾讯云审核适配器 + 本地敏感词库

### 🌐 SEO & 可发现性
- **RSS Feed** — 自动生成订阅源
- **Sitemap** — 自动 sitemap.xml
- **robots.txt** — 搜索引擎爬虫配置
- **Open Graph** — 社交分享卡片
- **Next.js ISR** — 增量静态再生，保持高性能

---

## 🏗️ 技术栈

| 层 | 技术 |
|---|------|
| **前端框架** | Next.js 14 (App Router) |
| **UI/样式** | Tailwind CSS 3.4 + Framer Motion 11 |
| **状态管理** | Zustand 5 + TanStack Query 5 |
| **图标** | Lucide React |
| **Markdown** | react-markdown + rehype-highlight + shiki |
| **后端框架** | Express.js 4.21 |
| **数据库** | SQLite (@libsql/client 0.14) |
| **ORM** | Drizzle ORM 0.36 |
| **认证** | JWT (jsonwebtoken) + bcryptjs + svg-captcha |
| **包管理** | pnpm 9.15 |
| **Monorepo** | Turborepo |
| **部署** | Docker + Nginx |
| **日志** | Pino |

---

## 📦 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm 9.x

### 安装

```bash
# 克隆仓库
git clone https://github.com/hxping7/tokenpress.git
cd tokenpress

# 安装依赖
pnpm install

# 初始化数据库
pnpm --filter @tokenpress/server dev

# 启动开发服务器
pnpm dev
```

开发服务器将在以下地址启动：

| 服务 | 地址 |
|------|------|
| **前端** | http://localhost:4000 |
| **后端 API** | http://localhost:4001 |

### 默认管理员

- **用户名**: `admin`
- **密码**: `admin123` — 首次登录后请立即修改密码！

---

## 📁 项目结构

```
tokenpress/
├── apps/
│   ├── web/                        # Next.js 前端
│   │   └── src/
│   │       ├── app/                # 页面 (App Router)
│   │       │   ├── [section]/      # 动态板块路由
│   │       │   ├── admin/          # 管理后台 (11个子页面)
│   │       │   └── auth/           # 登录页
│   │       ├── components/         # 共享组件
│   │       │   ├── ui/             # 基础UI组件
│   │       │   ├── Header.tsx      # 顶部导航
│   │       │   ├── Footer.tsx      # 底部导航
│   │       │   ├── ArticleCard.tsx # 文章卡片
│   │       │   └── MarkdownContent.tsx
│   │       ├── lib/                # 工具库 (api/i18n/cn/...)
│   │       ├── stores/             # Zustand (auth/theme/locale/layout)
│   │       └── locales/            # zh.json / en.json
│   │
│   └── server/                     # Express 后端
│       └── src/
│           ├── routes/             # 25+ 路由模块
│           ├── middleware/          # 认证/CORS/反爬虫/静态页面/错误处理
│           ├── db/                 # Schema + 数据迁移脚本（0000–0016）
│           ├── lib/contentReview/  # 内容审核核心库
│           ├── workers/            # 异步审核/广告调度Worker
│           └── utils/              # 日志/审计/参数校验
│
├── packages/
│   └── shared/                     # 共享类型/常量/工具
│
├── docker-compose.yml              # Docker 编排
├── Dockerfile                      # 多阶段构建
├── nginx.conf                      # Nginx 反向代理
└── data/                           # 运行时数据
```

---

## 🧩 API 总览

后端运行后，完整 API 可通过以下端点访问：

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 登录 (含验证码) |
| POST | `/api/v1/auth/refresh` | 刷新 JWT |
| GET | `/api/v1/auth/me` | 当前用户信息 |

### 公开内容
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/articles` | 文章列表 (公开) |
| GET | `/api/v1/articles/:id` | 文章详情 |
| GET | `/api/v1/categories` | 分类列表 |
| GET | `/api/v1/sections` | 板块列表 |
| GET | `/api/v1/search` | 全文搜索 |
| GET | `/api/v1/tags` | 标签列表 |

### AI 发布 API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/ai/publish` | AI 远程发布文章 |
| GET | `/api/v1/ai/articles` | AI 查询已发布文章 |
| DELETE | `/api/v1/ai/articles/:slug` | AI 删除文章 |
| POST | `/api/v1/media/ai` | AI 上传媒体文件 |

### 静态页面 & 远程管控
| 方法 | 路径 | 说明 |
|------|------|------|
| POST/PUT/DELETE/PATCH | `/api/v1/statichtml/folder` | 静态文件夹增删改 / 重命名 |
| POST/PUT/DELETE/PATCH | `/api/v1/statichtml/file` | 静态文件上传 / 替换 / 删除 / 重命名 |
| GET | `/api/v1/statichtml/tree` | 静态页面树形结构 |
| GET | `/api/v1/statichtml/list` | 选择器列表 |
| POST | `/api/v1/ai/articles/:slug/pin` | 远程置顶文章（全局 / 板块） |

### 管理 API (需 JWT)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST/PUT/DELETE | `/api/v1/admin/articles/*` | 文章 CRUD |
| GET/POST/PUT/DELETE | `/api/v1/users/*` | 用户管理 |
| GET/POST/PUT/DELETE | `/api/v1/tokens/*` | API Token 管理 |
| GET/POST/DELETE | `/api/v1/media/*` | 媒体管理 |
| PUT | `/api/v1/site-settings` | 系统设置 |
| GET | `/api/v1/stats` | API 统计 |
| GET | `/api/v1/logs` | 操作日志 |

---

## 🐳 Docker 部署

```bash
# 生产构建
docker compose build

# 启动服务
docker compose up -d

# 查看状态
docker compose ps
```

详见 [DEPLOY.md](./DEPLOY.md) 了解完整部署指南。

---

## 🤝 参与贡献

欢迎各种形式的贡献！提交 Issue、Pull Request，或通过 [Discussions](https://github.com/hxping7/tokenpress/discussions) 分享想法。

### 开发指引

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feat/amazing-feature`
3. 提交变更: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feat/amazing-feature`
5. 提交 Pull Request

---

## 📄 License

[MIT](./LICENSE) © [TokenPress Contributors](https://github.com/hxping7/tokenpress/graphs/contributors)

---

<p align="center">
  <sub>Built with ❤️ by AI & Human collaboration</sub>
</p>

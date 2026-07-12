# TokenPress v1.0.0

首个正式版本。TokenPress 是一个开源的 AI 内容管理系统（MIT 协议），用于聚合发布 Token 计划、AI 编程、AI 作品与博客内容。

## 核心功能

- **内容管理**：文章（板块/分类/标签）、发布状态、封面图、Markdown 正文。
- **文章置顶**：支持全局与板块级置顶，后台一键操作，可通过 API Token 远程置顶。
- **社交分享与收藏**：微信/朋友圈（二维码）、微博、QQ、QQ 空间、X、Telegram、Facebook、复制链接；分享入口位置（正文上方/结尾/右侧栏）与渠道均可后台配置。收藏引导加入浏览器收藏夹。
- **静态页面**：后台树形管理 `/statichtml/<path>` 直访页面（支持子目录、文件夹/文件重命名、扩展名防护），可嵌入板块/Hero/CTA 链接。
- **后台设置**：基础、UI、Logo、Hero、Banner、页脚导航、页脚、分析、安全（含反爬虫开关）、备份、分享、轮播等全站设置，经 API Token 远程控制并按权限隔离。
- **反爬虫防护**：后台可开关，拦截 curl / python-requests / scrapy / go-http-client 等工具 UA，放行 Google / Bing / Baidu 等搜索引擎。
- **API Token 远程控制**：19 项权限隔离（设置/友链/导航/分类/用户/备份/广告/敏感词/审核/统计/日志/静态页/文章发布/媒体 等），支持 AI 智能体远程管控。
- **管理后台**：文章批量管理、用户管理、Token 管理、静态页面管理、全站设置。

## 技术栈

- 前端：Next.js 14（App Router）+ TypeScript + Tailwind CSS
- 后端：Express.js + @libsql/client + Drizzle ORM
- 数据库：SQLite
- 部署：Docker + Nginx（多容器：backend / frontend / nginx）

## 部署

```bash
docker compose up -d --build
```

访问地址由 `docker-compose.yml` 中 nginx 配置决定（默认 HTTPS 8444 / HTTP 8081）。

## 升级说明

首次部署直接拉取 `main` 分支运行即可。数据库迁移在后端启动时自动执行（含文章置顶、articles 表重建等迁移脚本 0000–0016）。

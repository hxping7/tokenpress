---
name: tokenpress-site
description: 用一枚 API Token 幂等地搭建 / 重构 TokenPress 站点骨架——批量建板块与分类、写站点设置、配页脚导航与友链、对齐风格包导航图标，并对建好的站做一次自检（板块页可达 / 图标覆盖 / 设置形状 / 媒体引用 / 内部链接）。补齐 publisher（发内容）、style（改装修）、deploy（部署）都没覆盖的「建站动作」。当用户说"建一个站""新建站点""搭个博客""建板块/分类""配置站点信息""加友链""导航图标不对""建完自检""站点体检"时触发。需 Token 具备 sections:write / categories:write / settings:write / friendlinks:write / styles:write。
agent_created: true
---

# TokenPress 建站器（Site Builder）

把一个空站建成「有骨架、有配置、能发内容」的站点，并给出可复现的自检结果。

## 0. 与其他技能的分工（先看这张表，别越界）

| 技能 | 管什么 | 不管什么 |
|---|---|---|
| **tokenpress-site**（本技能） | **板块 / 分类 / 站点设置 / 页脚导航 / 友链 / 导航图标 / 建后自检** | 文章正文与配图 |
| tokenpress-publisher | 文章（含媒体自动上传）/ 拉取 / 置顶 / 删除 / 分类增改 | 建板块、站点设置 |
| tokenpress-style | 风格包字段（配色/布局/首页区块/激活/恢复） | 站点信息（属内容层） |
| tokenpress-deploy | 镜像构建 / 上传 / 部署 / 健康检查 | 站内数据 |

> 为什么需要本技能：**「建板块」和「配站点设置」此前只能手写脚本调 API** —— `POST /ai/publish` 不会建板块（section 不存在直接 400），而 publisher 技能只覆盖分类。踩过的坑都沉淀在本文件 §4。

## 1. 配置

复用 publisher 的约定：工作目录放 **`.token00.conf`**（从 cwd 逐级向上查找），或走环境变量 / CLI。

```json
{
  "api_base": "http://localhost:8081/api/v1",
  "token": "t00_sk_xxxxx"
}
```

优先级：`--api-base/--token` > `TP_API_BASE/TP_TOKEN` > `.token00.conf`。

> ⚠️ **别在工作目录根放一份指向生产的 `.token00.conf` 就跑本地建站** —— 会直接把板块建到线上。给本地/测试站单独建一个目录，或显式传 `--api-base`。

**所需权限**：`sections:write`、`categories:write`、`settings:write`、`friendlinks:write`、`styles:write`（导航图标要写风格包）。

## 2. 建站：`scripts/init-site.js`

写入一份计划文件 `site.json`，然后执行。**幂等**：板块按 slug、分类按 name、友链按 url、设置按 key 覆盖/跳过 —— 重复跑安全。

```bash
node scripts/init-site.js --plan site.json --dry-run     # 先看会改什么（强烈建议）
node scripts/init-site.js --plan site.json               # 执行
node scripts/init-site.js --plan site.json --only sections,categories
node scripts/init-site.js --plan site.json --api-base http://localhost:8081/api/v1 --token t00_sk_xxx
```

**计划文件结构**（`navIcons` 可填 `"auto"` 按板块名关键词猜）：

```json
{
  "stylePack": "blog",
  "site": {
    "site_name": "站名",
    "site_description": "一句话简介",
    "copyright_text": "© 2026 站名",
    "default_theme": "light",
    "footer_nav_columns": "3"
  },
  "sections": [
    { "name": "造物日志", "slug": "lab", "path": "/lab", "template": "article-grid", "sortOrder": 1, "description": "…" }
  ],
  "categories": [
    { "section": "lab", "name": "硬件改装", "slug": "gear", "sortOrder": 1 }
  ],
  "footerNav": [
    { "title": "板块", "links": [{ "name": "造物日志", "url": "/lab" }] }
  ],
  "friendLinks": [
    { "name": "Ollama", "url": "https://ollama.com/", "description": "本地模型运行时", "sortOrder": 1 }
  ],
  "hero": {
    "useArticles": true, "maxItems": 5, "interval": 5, "effect": "fade", "size": "full",
    "ctaButtons": [
      { "label": { "zh": "看日志", "en": "Lab notes" }, "href": "/lab", "variant": "primary" }
    ]
  },
  "navIcons": "auto"
}
```

**板块模板可选值**（`template`）：`article-list` / `article-grid` / `article-masonry` / `magazine` / `carousel` / `single-page` / `link-wall` / `design-gallery`。传错会被静默换成 `article-list`。

## 3. 自检：`scripts/audit-site.js`

建完站、发完内容后跑一次，逐项 ✅/❌（有 ❌ 时退出码 1）：

```bash
node scripts/audit-site.js --site http://localhost:8081
```

| 检查项 | 判据 |
|---|---|
| 板块 / 分类 / 文章 计数 | 板块为 0 直接判失败 |
| 板块页可达 | 每个 `sections.path` 返回 200 |
| 文章详情页可达 | 按列表 API 拼 `{section.path}/{slug}` 逐个请求 |
| **导航图标覆盖** | 包内 `header.nav.icons` 的键 ⊇ 全部板块 slug |
| 站点设置体检 | `site_name` 是否存在；`footer_nav` 每项是否 `{name,url}`；`footer_nav_columns` 与分组数是否一致 |
| **媒体引用完整性** | 正文与封面里的 `/api/v1/media/...` 逐个请求；并检查正文是否残留 `](./` 本地路径 |
| 内部链接 | 从首页/板块页/文章页抓 `href` 逐个请求，报告 4xx |

## 4. 契约与坑（每条都真实踩过）

| # | 事实 | 后果 / 处理 |
|---|---|---|
| 1 | **`footer_nav` 的链接字段是 `{name, url}`**（`FooterNavGroup { title, links?: NavItem[] }`） | 写成 `{label, href}` 时**页脚只渲染分组标题、链接静默消失**（无任何报错） |
| 2 | 友链字段是 `{name, url, description, sortOrder, isActive}` | 缺 name/url 直接 400 |
| 3 | **`header.nav.icons` 一旦配置就停用关键词兜底** | 未覆盖的板块**没有图标**。本脚本会自动补齐遗漏项 |
| 4 | **`POST /ai/publish` 不建板块** | section 不存在直接 400 → **先跑 init-site.js 再发内容** |
| 5 | 分类 / 标签可在发布时按需创建 | 但显式建好更可控（分类归属板块更准） |
| 6 | **封面比例必须与消费处的框比例核对** | 封面 1200×630（1.905）时，网格卡片若为 `16/10` 每侧裁约 96px（**标题首字被切**）、列表 `16/9` 裁 40px（安全）、`40/21` 零裁切。每侧裁量 = `(1 − min/max) × 源宽 ÷ 2`。比例在 `layouts.templates.<模板>.aspectRatio`（用 style 技能改） |
| 7 | 发布后前台能否**立即**生效，取决于后端能否刷到前端缓存 | 后端调 `FRONTEND_INTERNAL_URL`（compose 里应为 `http://frontend:4000`）。若它写成 `localhost:3001` 之类，所有 revalidate 都会 `fetch failed`，页面要等 ISR TTL 才更新 |
| 8 | `/api/v1/ai` 限流默认 **30 次/分钟** | 批量发布/建分类时注意；发布/列表/删除/置顶共用该额度 |
| 9 | 所有请求都要带 `User-Agent` | 缺 UA 会被反爬中间件拦；curl 命令统一带 `-A 'Mozilla/5.0'` |
| 10 | `site_name` / 简介 / 版权 / 友链导航属**内容层**（`site_settings` / `friend_links`） | 不写进风格包；风格包只管装修 |
| 11 | 清空内容有 FK 顺序要求 | `article_tags → article_likes/views/reviews → articles → categories → sections`，再清 `tags`/`friend_links`/`media`（articles→sections 是 CASCADE，删板块须先删文章） |
| 12 | 验证要查**两个维度** | ① 设置项有没有消费端 ② 取值顺序是否「后台优先、包内兜底」（`settings.x \|\| pack.x`） |

## 5. 典型流程（空站 → 可用站点）

```bash
# ① 建骨架与配置
node scripts/init-site.js --plan site.json --dry-run
node scripts/init-site.js --plan site.json

# ② 发内容（用 publisher 技能；封面 + 内文图会被自动上传）
python <publisher>/scripts/publish.py out/xxx.md      # 逐篇或传目录批量

# ③ 自检
node scripts/audit-site.js --site http://localhost:8081

# ④（可选）把这次内容导出成风格包自带的演示内容，供 /setup 勾选安装
node <repo>/scripts/export-style-demo.js <packId> /tmp/demo-out
```

## 6. 别忘了

- **改完包内内容/演示数据要重建后端镜像**（`docker compose build backend`），否则新部署环境看不到。
- **未安装的站点**前台会重定向到 `/setup`；`init-site.js` 走 API 不受影响，但页面可达性检查要等安装完成后再跑。

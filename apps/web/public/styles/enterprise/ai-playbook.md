# 科技企业官网 · 活力版（enterprise）· AI 设计 Playbook

> 本文件描述**当前生效**的企业风格包（方案 C ·「科技 + 创新 + 活力」融合，活力为骨的高对比演绎）。改包后请同步更新。

## 自带演示示例内容
本包携带 `demo.json` + `demo-media/`（36 个媒体：34 张 SVG 封面与内文插图 + 2 张联系二维码 PNG），内容是一座完整的科技企业站：

| 板块 | 路径 | 分类 | 文章 |
| --- | --- | --- | --- |
| 产品 | /product | 云平台 · 智能体 · 数据服务 | 6 |
| 解决方案 | /solution | 零售 · 制造 · 金融 | 5 |
| 企业动态 | /insights | 产品发布 · 技术洞察 · 公司新闻 | 5 |
| 关于 | /about | — | 1 |

合计 4 板块 / 9 分类 / 17 篇文章 / 42 标签 / 5 友链 / 19 项站点设置。**首次安装向导 `/setup` 里勾选「安装演示示例内容」即可装载**（幂等：按 slug / key 跳过已存在项）。后台「激活风格包」不会安装内容。

## 风格定位
高对比企业官网：暖白底（`#FFF7F2`）上叠加深色科技块，橙红主强调（`#FF5A2B`）+ 靛紫次强调（`#7C4DF0`）+ 青色科技点缀（`#0EA5B7`，经三色渐变出现）。大字号粗标题、20px 大圆角、倾斜与悬浮动效、橙色渐变 CTA。三色能量以「渐变 CTA / 指标分色 / 卡片编号」贯穿全站。

## 设计原则
1. 高对比有节奏：暖白区块与深色块（海报、Hero 媒体）交替
2. 活力为骨：大字重标题、倾斜标签、橙色渐变按钮
3. 创新为形：大圆角、柔和阴影、三色渐变点缀
4. 科技为底：数据指标、等宽数字、网格纹理藏在深色块里
5. 内容与装修分离：导航/版权/备案/简介来自 `site_settings`，包里不写

## 可配置维度（含当前值）

### `design.tokens`
| token | 当前值 | 说明 |
|---|---|---|
| `--accent-blue` | `#FF5A2B` | 主强调（活力橙红） |
| `--accent-purple` | `#7C4DF0` | 次强调（创新靛紫） |
| `--gradient-from/via/to` | `#0EA5B7 → #7C4DF0 → #FF5A2B` | 三色渐变（科技→创新→活力） |
| `--bg-primary/secondary/tertiary` | `#FFF7F2 / #FFFFFF / #FFEDE0` | 暖白三级背景 |
| `--text-primary/secondary/muted` | `#1A1206 / #6A5A49 / #A08A76` | 暖调三级文字 |
| `--radius-card` | `20px` | 大圆角卡片 |
| `--shadow-card` | `0 12px 30px rgba(255,90,43,0.14)` | 暖色投影 |
| `--content-max-width` | `1180px` | 内容宽度 |

### `header`
`sticky-glass` 吸顶 + `borderBottom: 2px solid #F1DCCB`；`nav.align: right`、`style: plain`、当前项橙色文字无底色；`actions`：language + theme（**无登录/后台入口**）。

### 首页 `layouts.homepage.sections`
1. **CustomBlock**（`size: hero`，`background: #FFEDE0`，`split 1.08/0.92`）—— 左文右图：eyebrow「科技 · 创新 · 活力」、title「让增长**跑起来**」（accent 橙色）、intro、三色 `stats[]`（99.99% 可用性·科技 / 3.4× 提速·创新 / +218% 增长·活力）、`media.src = /styles/enterprise/media/hero-poster.svg`（包内深色科技海报：网格 + 三色柱状图 + 三指标）、双 CTA（立即开始 / 看案例）
2. **Features** —— 三张能力卡（20px 圆角 + 暖投影）
3. **CTA** —— 行动召唤条
4. **ArticleList** —— 案例/文章流

> 首页门面文案（eyebrow/title/intro/stats）属装修随包走；业务文案（Features 标题等）来自 `site_settings`（`home_feature_*`），切换风格包后请自行调整。

### 板块/文章页 `layouts`
保持企业风结构：板块页 `page-sidebar-left` + 标签式二级分类；文章页单栏 + 顶部大图（`layouts.article`）。配色跟随 tokens。

### `hero`（轮播开关）
`enabled: true`（若启用轮播则替代首页 CustomBlock 位置）；CTA：立即开始 / 看案例。当前首页走 CustomBlock，轮播默认关闭时无影响。

### `footer`（含 ICP 备案）
- `variant: multi-column`，`background: #FFEDE0`，`textColor: #1A1206`，`borderTop: 2px solid #F1DCCB`
- `nav.columns: 4`，标题大写粗体、链接 0.9rem/行高2
- `bottom`: `layout: between`、`showIcp: true`（**ICP 备案链接来自 site_settings 的 `icp_number` / `icp_url`**，默认指向 beian.miit.gov.cn）、`showPoweredBy: true`
- `friendLinks.show: false`
- **联系二维码**：`footer_nav` 第 4 列为 HTML 块，并排展示「企业微信」与「飞书」两张示例二维码（PNG 存于 uploads，示范用，真实站点请换成自家二维码）。footer 本身仍是装修，导航文案与二维码内容都来自 `site_settings.footer_nav`。

### `features`
`readingProgressBar: true` / `backToTop: true` / `welcomeOverlay: true` / `languageSwitcher: icon`

## Agent 操作示例
- 「主色换成青色系」→ `design.tokens['--accent-blue']` = `"#0EA5B7"`，渐变三键同步
- 「卡片改小圆角」→ `design.tokens['--radius-card']` = `"8px"`
- 「页脚显示友链」→ `footer.friendLinks.show` = `true`
- 「恢复轮播 Hero」→ `hero.enabled` = `true` 并把首页首区块换回 `Hero`

## Agent 调用方式（API）

**鉴权**：`Authorization: Bearer t00_sk_...`，读需 `styles:read`、写需 `styles:write`。

- 读取当前全量：`GET /api/v1/styles/active`
- 单字段改：`PATCH /api/v1/styles/enterprise` body `{ "path":"design.tokens['--accent-blue']", "value":"#0EA5B7" }`
- 批量改：`PATCH /api/v1/styles/enterprise` body `{ "patch":[ {path,value}, ... ] }`
- 首页组件序列：`PATCH /api/v1/styles/enterprise/homepage-sections`
- 配色重算：`POST /api/v1/styles/enterprise/scheme`
- 切换激活：`POST /api/v1/styles/enterprise/activate`

**可 patch 根**：`design` / `header` / `footer` / `layouts` / `hero` / `features`（禁止改 `$` 元数据；站点信息属内容，走 site_settings）。

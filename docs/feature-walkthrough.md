# TokenPress 详细功能走读

## 一、后台系统设置

### 1.1 数据模型

**数据库表**: `site_settings` — 采用 EAV (Entity-Attribute-Value) 键值对模式

**文件**: `apps/server/src/db/schema.ts:126-131`

```ts
export const siteSettings = sqliteTable('site_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})
```

### 1.2 设置项一览

| DB Key | 类型 | 用途 | 默认值 | 迁移文件 |
|--------|------|------|--------|----------|
| `site_name` | string | 站点名称 | `'Token∞'` | 0005 |
| `site_description` | string | 站点描述 | `'Token 力量无限放大...'` | 0005 |
| `header_logo` | string (URL) | 头部 Logo 图片 URL | `''` | 0005 |
| `footer_logo` | string (URL) | 底部 Logo 图片 URL | `''` | 0005 |
| `footer_nav` | string (JSON) | 底部导航项 | 4项 JSON 数组 | 0005 |
| `friend_links_columns` | string | 友链列数 | `'2'` | 0005 |
| `frontend_locale` | string | 前端语言 | `'zh'` | 0006 |
| `backend_locale` | string | 后台语言 | `'zh'` | 0006 |
| `hero_slides` | string (JSON) | 首页轮播图 | (无迁移种子) | — |
| `hero_effect` | string | 轮播效果 | (无迁移种子) | — |
| `default_theme` | string | 默认主题 | (无迁移种子) | — |

### 1.3 后端 API

**文件**: `apps/server/src/routes/site-settings.ts`

| 端点 | 方法 | 认证 | 用途 |
|------|------|------|------|
| `/api/v1/site-settings` | GET | 公开 | 返回所有设置 `{ key: value }` |
| `/api/v1/site-settings` | PUT | 管理员 | 批量 upsert 设置 |
| `/api/v1/site-settings/keys/:keys` | GET | ⚠️需认证 | 按逗号分隔的 key 查询特定设置 |

> **已知问题**: `/keys/:keys` 路由定义在 `router.use(authMiddleware, adminOnly)` 之后，导致需要管理员认证，与注释声明的"公开"不符。

### 1.4 前端管理页面

**文件**: `apps/web/src/app/admin/settings/page.tsx` (927行)

#### 6个 Tab 页签

| Tab | 值 | 内容 |
|-----|-----|------|
| 基本信息 | `basic` | 站点名称 + 描述 |
| UI 设置 | `ui` | 主题选择 (night/cyber/lava/light/space)、前端语言、后台语言 |
| Logo 设置 | `logo` | 头部/底部 Logo URL + 上传 + 媒体库浏览 |
| 首页宣传页 | `hero` | 轮播图配置 + 效果选择 |
| 底部导航 | `nav` | 导航项动态列表 (名称 + URL) |
| 友情链接 | `links` | 友链 CRUD + 列数选择 |

#### 数据流

```
GET /api/v1/site-settings → settingsData.data
  → useEffect 填充各 useState 字段
  → 用户编辑
  → handleSaveAll() → PUT /api/v1/site-settings { settings: {...} }
  → React Query 失效重取
```

### 1.5 公共端设置消费

| 组件 | 查询 Key | 获取的设置 | staleTime |
|------|----------|-----------|-----------|
| `Logo.tsx` | `['site-settings', 'header_logo']` | `header_logo` | 5分钟 |
| `FooterLogo.tsx` | `['site-settings', 'footer_logo']` | `footer_logo` | 5分钟 |
| `Footer.tsx` | `['site-settings', 'footer_nav,friend_links_columns']` | 底部导航+列数 | 5分钟 |
| `page.tsx` (首页) | `['site-settings', 'hero_slides,hero_effect']` | 轮播数据 | 5分钟 |
| `LocaleInitializer.tsx` | `['site-settings']` | 全部设置 | — |

---

## 二、Logo 设置

### 2.1 存储方式

Logo 以 URL 字符串存储在 `site_settings` 表的两个 key 中：
- `header_logo` — 头部 Logo URL
- `footer_logo` — 底部 Logo URL

值为空时，前端组件渲染默认 SVG Logo。

### 2.2 管理端 Logo Tab

**文件**: `apps/web/src/app/admin/settings/page.tsx:503-586`

每个 Logo 区域提供三种设置方式：

| 方式 | 操作 | 说明 |
|------|------|------|
| URL 直接输入 | `<input type="url">` | 手动填写图片 URL |
| 从媒体库选择 | "Browse" 按钮 → 媒体库弹窗 | 从已上传文件中选择 |
| 直接上传 | "Upload" 按钮 → 文件选择器 | 上传新文件到 `data/uploads/logo/` |

#### Logo Tab 布局

```
┌─ Header Logo ─────────────────────────────────┐
│  URL: [________________] [Browse] [Upload]     │
│  预览: [img]                                   │
└────────────────────────────────────────────────┘
┌─ Footer Logo ─────────────────────────────────┐
│  URL: [________________] [Browse] [Upload]     │
│  预览: [img]                                   │
└────────────────────────────────────────────────┘
```

### 2.3 上传流程

```
用户点击 "Upload"
  → handleUploadClick(target) 设置 uploadTarget，触发隐藏 <input type="file"> 的 click
  → 用户选择文件
  → handleFileSelect() → uploadMutation.mutate(file)
  → api.uploadMedia(file, 'logo')
    → FileReader.readAsDataURL() 转 base64
    → POST /api/v1/media { file: base64, filename, mimeType, section: 'logo' }
  → 服务端写入 data/uploads/logo/{safeName}
  → INSERT media 表记录
  → 返回 URL → onSuccess 根据 uploadTarget 设置 headerLogo 或 footerLogo
  → 点击 "Save All" → PUT /api/v1/site-settings { header_logo: url, ... }
```

### 2.4 媒体库浏览流程

```
用户点击 "Browse"
  → openMediaBrowser('header' | 'footer')
  → 弹出媒体库弹窗 (仅显示图片类型)
  → 用户点击图片 → selectFromMediaBrowser(url)
  → 设置对应的 headerLogo / footerLogo
  → 关闭弹窗
```

### 2.5 公共端 Logo 渲染

#### Header Logo: `apps/web/src/components/Logo.tsx`

- 查询 `GET /site-settings/keys/header_logo`
- **有值**: 渲染 `<img src={customLogo}>` 链接到首页
- **无值**: 渲染默认 SVG — 渐变文字 "Token" + 无穷符号 + 发光效果
- 支持 `size` prop: `small` (112px) / `normal` (160px) / `large` (280px)

#### Footer Logo: `apps/web/src/components/FooterLogo.tsx`

- 查询 `GET /site-settings/keys/footer_logo`
- **有值**: 渲染 `<img src={customLogo}>` (固定 w-32 = 128px)
- **无值**: 渲染默认 SVG — 六边形图标 + "Token" + "TOKEN00.COM"

### 2.6 已知 Bug

1. **Footer 上传按钮目标错误** (`page.tsx:570`): `handleUploadClick('header')` 应为 `handleUploadClick('footer')`，导致底部 Logo 上传会错误设置到头部 Logo。
2. **媒体库弹窗内上传按钮硬编码 'header'** (`page.tsx:908`): 无论为哪个字段打开媒体库，上传新文件都会设置到 headerLogo。
3. **缓存不一致**: 管理员保存 Logo 后只失效 `['admin-site-settings']`，公共端的 `['site-settings', 'header_logo']` 等 query 不会立即更新，最长可能延迟 5 分钟。

---

## 三、首页宣传页 (Hero Carousel)

### 3.1 数据模型

```ts
interface HeroSlide {
  id: string           // 唯一标识 (Date.now().toString())
  imageUrl: string     // 宣传图 URL
  linkUrl: string      // 点击跳转 URL
  linkTarget: '_blank' | '_self'  // 新窗口/当前窗口
}
```

存储在 `site_settings` 表的两个 key：
- `hero_slides` — `HeroSlide[]` 的 JSON 序列化字符串
- `hero_effect` — 轮播效果类型: `'fade' | 'slide' | 'zoom' | 'flip'`

### 3.2 管理端配置

**文件**: `apps/web/src/app/admin/settings/page.tsx:588-705`

#### 操作功能

| 功能 | 函数 | 说明 |
|------|------|------|
| 添加轮播图 | `addHeroSlide()` | 创建空 slide 并追加到数组 |
| 更新字段 | `updateHeroSlide(index, field, value)` | 修改指定 slide 的字段 |
| 删除轮播图 | `removeHeroSlide(index)` | 按索引移除 |
| 选择图片 | `openHeroMediaBrowser(index)` | 打开媒体库为指定 slide 选图 |

#### 配置界面

```
┌─ Home Hero ───────────────────────────────────┐
│  [Add Image]                                   │
│                                                │
│  Carousel Effect: [fade ▼]                     │
│    Options: fade / slide / zoom / flip          │
│                                                │
│  ┌─ Slide 1 ──────────────── [Delete] ────────┐│
│  │ Image URL: [____] [Browse] [Upload]         ││
│  │ 预览: [img]                                 ││
│  │ Link URL: [____]                            ││
│  │ ☑ Open link in new tab                      ││
│  └─────────────────────────────────────────────┘│
│  ┌─ Slide 2 ──────────────── [Delete] ────────┐│
│  │ ...                                         ││
│  └─────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

### 3.3 首页渲染

**文件**: `apps/web/src/app/page.tsx`

#### 数据获取 (`page.tsx:28-50`)

```ts
// 获取 hero_slides + hero_effect
useQuery → GET /site-settings/keys/hero_slides,hero_effect
// 解析 JSON
heroSlides = JSON.parse(hero_slides) || []
heroEffect = hero_effect || 'fade'
```

#### 自动轮播 (`page.tsx:53-60`)

- 当 slide 数量 ≥ 2 时启动定时器
- 每 **5秒** 自动切换
- 使用 `currentSlide` state + 取模循环

#### 四种轮播效果 (`page.tsx:189-213`)

| 效果 | 机制 | 活跃状态 | 非活跃状态 | 时长 |
|------|------|----------|-----------|------|
| **fade** | CSS opacity | `opacity-100` | `opacity-0` | 700ms |
| **slide** | CSS translateX | `z-10, translateX(0%)` | `z-0, translateX(±100%)` | 700ms ease-in-out |
| **zoom** | opacity + scale | `opacity-100 scale-100` | `opacity-0 scale-90` | 700ms |
| **flip** | opacity + rotateY | `opacity-100 rotate-y-0` | `opacity-0 rotate-y-90` | 700ms |

#### 指示器圆点 (`page.tsx:240-253`)

- 仅在 2+ slides 时显示
- 点击可手动切换
- 活跃: `bg-t-accent-blue`，非活跃: `bg-t-text-muted`

#### 默认 SVG 回退 (`page.tsx:74-183`)

当无轮播图或首张图无 URL 时，渲染装饰性内联 SVG：
- 轨道椭圆 + 渐变描边
- "Token" 文字 + 发光滤镜
- 无穷符号 + 发光
- 装饰性圆点 + "TOKEN00.COM"

### 3.4 数据流

```
[管理员配置 heroSlides[] + heroEffect]
  → handleSaveAll()
  → PUT /api/v1/site-settings { hero_slides: JSON.stringify(), hero_effect }
  → site_settings 表 (upsert)

[首页渲染]
  → GET /site-settings/keys/hero_slides,hero_effect
  → JSON.parse → HeroSlide[]
  → useEffect 5s 定时器 → currentSlide 自增
  → getEffectClass() + getSlideStyle() → 渲染轮播
```

---

## 四、媒体浏览与上传功能

### 4.1 数据库 Schema

**文件**: `apps/server/src/db/schema.ts:83-97`

```ts
export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),          // 磁盘文件名 ( sanitized )
  originalName: text('original_name').notNull(), // 用户原始文件名
  mimeType: text('mime_type').notNull(),         // MIME 类型
  size: integer('size').notNull(),               // 文件大小 (bytes)
  url: text('url').notNull(),                    // 公开访问 URL
  thumbnailUrl: text('thumbnail_url'),           // 缩略图 URL (未实现, 始终 null)
  width: integer('width'),                       // 宽度 (未实现)
  height: integer('height'),                     // 高度 (未实现)
  duration: real('duration'),                    // 视频时长 (未实现)
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})
```

### 4.2 后端 API

**文件**: `apps/server/src/routes/media.ts` (205行)

#### 文件服务 (公开, 无认证)

| 端点 | 说明 |
|------|------|
| `GET /files/uploads/*` | 静态文件服务，含目录遍历防护，404检查 |

#### 上传 (两种认证方式)

| 端点 | 认证 | 说明 |
|------|------|------|
| `POST /api/v1/media` | JWT | 管理员上传 |
| `POST /api/v1/media/ai` | API Token + `media:upload` 权限 | AI/程序化上传 |

#### 上传模式

**模式 1: URL 外部媒体** (body 包含 `url` 字段)
- 不写磁盘，仅创建 DB 记录
- 用于外部托管文件 (如 AI 生成的图片)

**模式 2: Base64 文件上传** (body 包含 `file` + `filename` + `mimeType`)
- MIME 校验: 图片 (`jpeg/png/webp/gif`, 10MB) + 视频 (`mp4/webm`, 200MB)
- 大小校验: 超限返回 400
- 子目录: `section` 参数 (如 `'logo'`) → `data/uploads/{section}/`
- 文件名消毒: `sanitizeFilename()` 追加时间戳+随机后缀
- 写入磁盘: `fs.writeFileSync()`
- URL 生成: `{SITE_URL}/api/v1/media/files/uploads/{section}/{safeName}`
- DB 插入: 创建 media 记录

#### 列表与删除

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `GET /api/v1/media` | GET | JWT | 获取媒体列表 (硬编码 page=1, limit=50) |
| `DELETE /api/v1/media/:id` | DELETE | JWT | 删除媒体 (本地文件同步删除磁盘文件) |

### 4.3 前端 API 客户端

**文件**: `apps/web/src/lib/api.ts`

| 方法 | 行号 | 说明 |
|------|------|------|
| `getMedia(params)` | 204-213 | 获取媒体列表 (支持 page/limit/search/type 参数，但后端未实现) |
| `uploadMedia(file, section?)` | 215-238 | 上传文件 (File → base64 → POST /media) |
| `deleteMedia(id)` | 240-244 | 删除媒体 |

### 4.4 管理端媒体库页面

**文件**: `apps/web/src/app/admin/media/page.tsx` (182行)

```
┌─ Media Library ────────────────────────────────┐
│  [🔍 Search...]  [Type: All ▼]                 │
│                                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │ img │ │ img │ │ img │ │ img │ │ img │     │
│  │     │ │     │ │     │ │     │ │     │     │
│  │ name │ │ name │ │ name │ │ name │ │ name │     │
│  │ size │ │ size │ │ size │ │ size │ │ size │     │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     │
│  响应式网格: 2列(mobile) / 4列(md) / 6列(lg)     │
└────────────────────────────────────────────────┘
```

**功能**:
- 搜索过滤 (前端仅发送参数，后端未实现)
- 类型过滤: 全部 / 图片 / 视频
- 悬停操作: 预览 (弹窗) / 下载 (直接链接) / 删除 (确认后)
- 预览弹窗: 全屏遮罩，图片/视频播放

### 4.5 设置页内嵌媒体库弹窗

**文件**: `apps/web/src/app/admin/settings/page.tsx:875-924`

供 Logo 和 Hero 配置使用，仅显示图片类型。

```
┌─ 媒体库 ──────────────────────────── [X] ──────┐
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│  │ img │ │ img │ │ img │ │ img │              │
│  │     │ │     │ │     │ │     │              │
│  └─────┘ └─────┘ └─────┘ └─────┘              │
│  3列(mobile) / 4列(md) 网格                     │
│                                                │
│  [Upload New]  [Cancel]                        │
└────────────────────────────────────────────────┘
```

**触发入口**:
1. Header Logo "Browse" 按钮 → `openMediaBrowser('header')`
2. Footer Logo "Browse" 按钮 → `openMediaBrowser('footer')`
3. Hero Slide "Browse" 按钮 → `openHeroMediaBrowser(index)`

### 4.6 完整上传流程

```
用户点击 Upload 按钮
  → handleUploadClick(target) 设置 uploadTarget
  → 触发隐藏 <input type="file"> click
  → 用户选择文件
  → handleFileSelect()
  → uploadMutation.mutate(file)
  → api.uploadMedia(file, 'logo')
    → FileReader.readAsDataURL(file)
    → base64 = result.split(',')[1]
    → POST /api/v1/media { file: base64, filename, mimeType, section: 'logo' }
  → 服务端 handleUpload()
    → 校验 MIME 类型
    → 校验文件大小
    → sanitizeFilename() (追加时间戳+随机后缀)
    → fs.writeFileSync() 写入 data/uploads/logo/{safeName}
    → INSERT INTO media 表
    → 返回 201 { url: "/api/v1/media/files/uploads/logo/{safeName}" }
  → uploadMutation.onSuccess()
    → 失效 ['media-library'] 缓存
    → 根据 uploadTarget 设置 headerLogo / footerLogo / heroSlides[index].imageUrl
```

### 4.7 已知问题与未实现功能

| 问题 | 位置 | 说明 |
|------|------|------|
| 后端搜索/过滤未实现 | `media.ts:150-174` | 前端发送 search/type 参数但后端忽略，分页硬编码 page=1, limit=50 |
| 缩略图未生成 | `media.ts:104-112` | `thumbnailUrl` 始终 null，网格视图加载完整图片 |
| 图片尺寸未提取 | `media.ts:104-112` | `width`/`height`/`duration` 列存在但从未填充 |
| 文件服务无认证 | `media.ts:22-51` | `GET /files/uploads/*` 无需认证即可访问 |
| Footer 上传按钮 bug | `page.tsx:570` | `handleUploadClick('header')` 应为 `handleUploadClick('footer')` |
| 媒体库上传按钮硬编码 | `page.tsx:908` | 上传新文件始终设置到 headerLogo |
| Base64 上传方式 | `api.ts:215-238` | 使用 base64 JSON 而非 multipart/form-data，体积增大约 33% |
| Logo 缓存延迟 | `Logo.tsx`/`FooterLogo.tsx` | 管理员保存后公共端最长 5 分钟才更新 |

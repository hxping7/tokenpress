# 首页轮播图文章封面功能实现总结

## 完成的工作

### 1. 数据库迁移
- 创建了迁移文件 `apps/server/src/db/migrations/0014_add_hero_carousel_settings.ts`
- 添加了三个设置项：
  - `hero_carousel_use_articles`: 是否启用文章轮播图
  - `hero_carousel_article_source`: 文章来源（hot/latest）
  - `hero_carousel_max_items`: 最大轮播数量（1-10）
- 在 `apps/server/src/index.ts` 中导入并执行迁移

### 2. 后端API
- 创建了新的路由文件 `apps/server/src/routes/carousel-articles.ts`
- 实现了 GET `/api/v1/carousel-articles` API端点
- 支持查询参数：
  - `source`: 文章来源（hot/latest，默认latest）
  - `limit`: 返回数量（1-10，默认5）
- 只返回已发布且有封面图的文章
- 按来源排序：hot按viewCount降序，latest按publishedAt降序

### 3. 前端修改
- 修改了 `apps/web/src/app/page.tsx` 中的 `getHeroSlides()` 函数
- 根据设置决定使用哪种轮播图数据源：
  - 如果启用文章轮播图，从API获取文章封面图
  - 否则，使用自定义的轮播图设置
- 将文章数据转换为HeroSlide格式

### 4. 设置页面
- 在 `apps/web/src/app/admin/settings/page.tsx` 中添加了新的设置项UI
- 增加了三个状态变量：
  - `heroCarouselUseArticles`: 是否启用文章轮播图
  - `heroCarouselArticleSource`: 文章来源
  - `heroCarouselMaxItems`: 轮播数量
- 在加载设置时，初始化这些状态变量
- 在保存设置时，保存这些新的设置项
- 在hero Tab中添加了UI：
  - "启用文章轮播图"开关
  - 文章来源选择（热点文章/最新文章）
  - 轮播数量设置（1-10）

### 5. 翻译文本
- 添加了中文翻译到 `apps/web/src/locales/zh.json`
- 添加了英文翻译到 `apps/web/src/locales/en.json`

### 6. 其他修复
- 修复了 `apps/server/src/routes/ai-publish.ts` 中的TypeScript错误（coverImageUrl常量修改问题）
- 修复了数据库表结构问题（添加了view_count和section_id列）

## 测试方法

### 后端API测试
```bash
# 启动后端服务器（端口4002）
cd apps/server && PORT=4002 node dist/index.js

# 测试API
curl -s -H "User-Agent: Mozilla/5.0" "http://localhost:4002/api/v1/carousel-articles?source=latest&limit=5"
```

### 前端测试
1. 启动后端服务器（端口4002）
2. 启动前端服务器：`cd apps/web && pnpm dev`
3. 访问首页，查看轮播图是否显示文章封面图
4. 进入管理后台 > 系统设置 > 首页宣传页，测试新的设置项

## 注意事项
1. 后端API运行在端口4002（避免与之前的实例冲突）
2. 前端开发服务器默认运行在端口4000，API代理应该能正常工作
3. 如果需要修改API端口，需要修改前端代码中的API地址

## 文件列表
- `apps/server/src/db/migrations/0014_add_hero_carousel_settings.ts` (新建)
- `apps/server/src/routes/carousel-articles.ts` (新建)
- `apps/server/src/index.ts` (修改)
- `apps/server/src/routes/articles.ts` (修改，后改为新建独立路由)
- `apps/server/src/routes/ai-publish.ts` (修改)
- `apps/web/src/app/page.tsx` (修改)
- `apps/web/src/app/admin/settings/page.tsx` (修改)
- `apps/web/src/locales/zh.json` (修改)
- `apps/web/src/locales/en.json` (修改)

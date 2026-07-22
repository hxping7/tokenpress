'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { ArticleCard } from './ArticleCard'
import { Pagination } from './Pagination'
import { SectionSidebar } from './SectionSidebar'
import { MarkdownContent } from './MarkdownContent'
import { LayoutGrid, List } from 'lucide-react'
import { useStyleLayouts } from '@/components/StyleProvider'
import { resolveSectionLayout, resolveTemplateConfig, mergeLayoutConfigs, extractSectionLayouts, type SectionLayoutOverride } from '@/lib/resolveLayout'
import { isArticleTemplate } from '@/lib/templates'
import { isDesignGallerySection } from '@/lib/sections'
import { SinglePageView } from './templates/SinglePageView'
import { LinkWall } from './templates/LinkWall'
import { MagazineView } from './templates/MagazineView'
import { DesignWorksGallery } from './DesignWorksGallery'

interface SectionPageClientProps {
  section: string
  sectionPath: string
  title: string
  description: string | null
  sectionLayouts?: SectionLayoutOverride
  sectionKind?: string
  template?: string
  templateConfig?: Record<string, unknown> | null
}

function ArticleListView({
  articles,
  listCfg,
  category,
  view,
}: {
  articles: any[]
  listCfg: any
  category?: string
  view?: 'grid' | 'list'
}) {
  // view 优先（来自文章列表的 grid/list 切换按钮），否则用风格包配置的 listCfg.layout
  const listLayout = view || listCfg?.layout || 'grid'
  const columns = Math.min(Math.max(Number(listCfg?.columns) || 3, 1), 4)
  const showThumbnail = listCfg?.showThumbnail !== false
  const showExcerpt = listCfg?.showExcerpt !== false
  // 间距 / 卡片样式：来自 风格包 templates 默认 或 用户覆盖
  const gap = typeof listCfg?.gap === 'string' && listCfg.gap ? (listCfg.gap as string) : '1rem'
  const cardStyle = listCfg?.cardStyle
  const cardWrapClass =
    cardStyle === 'shadow' ? 'shadow-lg shadow-black/5' :
    cardStyle === 'zoom' ? 'group overflow-hidden rounded-xl' : ''

  if (articles.length === 0) {
    return (
      <div className="text-center py-20 text-t-text-secondary">
        {category ? '该分类下暂无文章' : '暂无文章'}
      </div>
    )
  }

  if (listLayout === 'list') {
    return (
      <div className="flex flex-col gap-4">
        {articles.map((a: any) => (
          <ArticleCard key={a.id} article={a} showThumbnail={showThumbnail} showExcerpt={showExcerpt} forceView="list" />
        ))}
      </div>
    )
  }

  if (listLayout === 'masonry') {
    return (
      <div className="w-full" style={{ columnCount: columns, columnGap: gap }}>
        {articles.map((a: any) => (
          <div key={a.id} className={`break-inside-avoid mb-4 ${cardWrapClass}`} style={{ marginBottom: gap }}>
            <ArticleCard key={a.id} article={a} showThumbnail={showThumbnail} showExcerpt={showExcerpt} forceView="grid" aspectRatio={listCfg?.aspectRatio || listCfg?.aspect} />
          </div>
        ))}
      </div>
    )
  }

  // grid
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}>
      {articles.map((a: any) => (
        <div key={a.id} className={cardWrapClass}>
          <ArticleCard key={a.id} article={a} showThumbnail={showThumbnail} showExcerpt={showExcerpt} forceView="grid" aspectRatio={listCfg?.aspectRatio || listCfg?.aspect} />
        </div>
      ))}
    </div>
  )
}

export function SectionPageClient({
  section,
  sectionPath,
  title,
  description,
  sectionLayouts,
  sectionKind,
  template,
  templateConfig,
}: SectionPageClientProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  // 文章列表视图偏好（grid/list）：仅 article-list 模板使用，默认「列表」(左缩略图+右标题描述)
  const [view, setView] = useState<'grid' | 'list'>('list')
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || undefined

  // 解析激活分类（用于分类级模板覆盖）
  const { data: catsData } = useQuery({
    queryKey: ['section-categories', section],
    queryFn: () => api.getCategories(section),
  })
  const activeCat = category ? (catsData?.data?.find((c: any) => c.slug === category) || null) : null

  // 模板解析：分类模板 > 板块模板 > 默认 article-list
  // 分类 template 为空字符串 '' → 继承板块（不覆盖）
  const sectionTpl = template || 'article-list'
  const templateKey = activeCat ? (activeCat.template || sectionTpl) : sectionTpl
  const userCfg = useMemo(() => {
    const raw = activeCat?.template ? activeCat.templateConfig : templateConfig
    if (!raw) return null
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return null }
    }
    return raw as Record<string, unknown>
  }, [activeCat, templateConfig])

  const articleFamily = isArticleTemplate(templateKey)
  const isArticleListTpl = templateKey === 'article-list'
  const isGridTpl = templateKey === 'article-grid'
  const isMasonryTpl = templateKey === 'article-masonry'
  const isMagazine = templateKey === 'magazine'

  const globalLayouts = useStyleLayouts()
  const packTemplates: Record<string, Record<string, unknown>> =
    (globalLayouts?.templates as Record<string, Record<string, unknown>>) || {}
  // 分类页：基线取 pack['category']（无则回退 pack['section']），叠加 categories.layouts 覆盖；
  // 板块页：基线取 pack['section']，叠加 sections.layouts 覆盖。
  const categoryLayouts = activeCat ? extractSectionLayouts(activeCat) : null
  const pageCfg = resolveSectionLayout(
    sectionLayouts ?? null,
    globalLayouts,
    activeCat ? 'category' : 'section',
    categoryLayouts ?? undefined,
  )
  const layout: string = String(pageCfg.layout || 'article-list')
  const heroCfg: any = pageCfg.hero || {}
  const sidebarCfg: any = pageCfg.sidebar || {}
  const listCfg: any = pageCfg.list || {}
  const heroTitle = heroCfg.titleFrom === 'section'
    ? title
    : heroCfg.titleFrom === 'category'
      ? (activeCat?.name || title)
      : (heroCfg.title || title)
  const heroDescription = activeCat?.description || description
  const isSidebarLayout = layout === 'page-sidebar-left' || layout === 'page-sidebar-right'
  const sidebarOnLeft = layout === 'page-sidebar-left'

  // 内容模板生效配置：
  // 风格包 templates[templateKey] = 出厂默认（列数/间距/卡片样式等）
  // 用户配置（分类 > 板块）= 逐字段覆盖
  const tplCfg: any = resolveTemplateConfig(packTemplates, templateKey, userCfg)
  // 骨架级 list 默认 + 内容模板默认 + 用户配置（字段级合并）
  const effectiveListCfg: any = mergeLayoutConfigs(listCfg, tplCfg)
  if (isGridTpl) effectiveListCfg.layout = 'grid'
  else if (isMasonryTpl) effectiveListCfg.layout = 'masonry'
  else if (isMagazine) effectiveListCfg.layout = 'grid'
  const magCols = Number(effectiveListCfg.columns) || 3
  const magazineLayout: 'top' | 'left' = (tplCfg?.magazineLayout as 'top' | 'left') || 'top'
  const featuredArticleId = tplCfg?.featuredArticleId ? Number(tplCfg.featuredArticleId) : undefined
  const headlineBasis: 'smart' | 'latest' | 'hot' = (tplCfg?.headlineBasis as 'smart' | 'latest' | 'hot') || 'smart'

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', section, page, search, category],
    queryFn: () => api.getArticles({ section, page, limit: 12, search: search || undefined, category }),
    enabled: articleFamily || templateKey === 'single-page',
  })

  const { data: featuredData } = useQuery({
    queryKey: ['section-featured', section],
    queryFn: () => api.getArticles({ section, limit: 1 }),
    enabled: layout === 'landing' && isArticleListTpl,
  })

  // 杂志头条「指定文章」：若指定 ID 不在当前列表（如较旧文章被分页），单独拉取
  const { data: specifiedArticleData } = useQuery({
    queryKey: ['magazine-featured-article', section, featuredArticleId],
    queryFn: () => api.getArticle(featuredArticleId as number),
    enabled: isMagazine && !!featuredArticleId,
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const articles = data?.data || []

  const emptyState = (
    <div className="text-center py-20 text-t-text-secondary">
      {search ? '没有找到匹配的文章' : (category ? '该分类下暂无文章' : '暂无文章')}
    </div>
  )
  const loadingState = <div className="text-center py-20 text-t-text-secondary">加载中...</div>
  const errorState = <div className="text-center py-20 text-red-400">加载失败，请重试</div>

  // ===== 渲染主内容区 =====
  const renderMainContent = () => {
    // 特殊模板
    if (templateKey === 'single-page') {
      return (
        <SinglePageView
          description={description}
          config={tplCfg as Record<string, unknown> | null}
          articles={articles}
        />
      )
    }
    if (templateKey === 'link-wall') {
      return <LinkWall config={tplCfg} />
    }
    if (isDesignGallerySection({ template: templateKey, kind: sectionKind })) {
        return (
          <DesignWorksGallery
            section={section}
            sectionPath={sectionPath}
            title={title}
            description={description}
            mode="embedded"
            config={tplCfg}
          />
        )
    }

    // 杂志头条
    if (isMagazine) {
      if (isLoading) return loadingState
      if (error) return errorState
      if (articles.length === 0) return emptyState
      // 头条优先级：指定 → 置顶 → 最新 → 热门
      let featured: any = null
      if (featuredArticleId) {
        featured =
          articles.find((a) => a.id === featuredArticleId) ||
          (specifiedArticleData?.data ?? null)
      } else if (headlineBasis === 'hot') {
        featured = articles.reduce(
          (best: any, a: any) => (!best || (a.viewCount || 0) > (best.viewCount || 0) ? a : best),
          null as any,
        )
      } else if (headlineBasis === 'latest') {
        featured = articles[0] || null
      } else {
        // smart：置顶优先（后端已置顶上浮，取第一篇置顶）；无置顶则取最新
        const pinned = articles.filter(
          (a: any) => a.pinnedScope === 'global' || a.pinnedScope === 'section',
        )
        featured = pinned[0] || articles[0] || null
      }
      const rest = featured ? articles.filter((a) => a.id !== featured.id) : articles
      return (
        <MagazineView
          featured={featured}
          rest={rest}
          columns={magCols}
          gap={effectiveListCfg.gap}
          sectionPath={sectionPath}
          pagination={data?.pagination}
          page={page}
          onPageChange={setPage}
          layout={magazineLayout}
        />
      )
    }

    // 文章列表（含旧版 layout 模式）
    if (isArticleListTpl) {
      // 文章列表内容模板：主内容区始终渲染「板块下全部文章」（分页）。
      // 侧栏（page-sidebar-*）仅作为分类筛选导航，不再把主区收窄为单篇精选；
      // landing 形态额外在列表上方展示首篇精选头条。
      if (isSidebarLayout || layout === 'landing') {
        if (isLoading) return loadingState
        if (error) return errorState
        if (articles.length === 0) return emptyState
        const featured = layout === 'landing' ? featuredData?.data?.[0] : null
        return (
          <div className="space-y-10">
            {featured && (
              <article className="bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-8">
                <h2 className="text-heading-2 text-t-text-primary mb-3" dangerouslySetInnerHTML={{ __html: featured.title }} />
                <div className="max-w-[var(--reading-max-width)]">
                  <MarkdownContent content={featured.content || featured.excerpt || ''} />
                </div>
              </article>
            )}
            <ArticleListView articles={articles} listCfg={effectiveListCfg} category={category} view={view} />
            {data && data.pagination.totalPages > 1 && (
              <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
            )}
          </div>
        )
      }
    }

    // 默认：文章列表 / 卡片网格 / 瀑布流
    if (isLoading) return loadingState
    if (error) return errorState
    if (articles.length === 0) return emptyState
    return (
      <>
        <ArticleListView
          articles={articles}
          listCfg={effectiveListCfg}
          category={category}
          {...(isArticleListTpl ? { view } : {})}
        />
        <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      </>
    )
  }

  // ===== 侧栏（仅 article-list 模板的 sidebar / landing 模式） =====
  const sidebarEnabled = isArticleListTpl && (
    (isSidebarLayout && sidebarCfg.enabled !== false) || (sidebarCfg.enabled === true)
  )
  const renderSidebar = () => {
    if (!sidebarEnabled) return null
    return (
      <aside className={`${sidebarCfg.sticky !== false ? 'sticky top-20' : ''} h-fit`}>
        <SectionSidebar
          sectionSlug={section}
          sectionPath={sectionPath}
          search={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          activeCategory={category}
        />
      </aside>
    )
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Hero — 按模板包配置 */}
      {heroCfg.enabled && (
        <section className="relative py-16 px-4 border-b border-t-border">
          <div className="absolute inset-0 grid-pattern opacity-50" />
          <div className="relative max-w-[var(--content-max-width)] mx-auto text-center">
            <h1 className="text-heading-1 gradient-text mb-4">{heroTitle}</h1>
            {heroCfg.description && heroDescription ? (
              <p className="text-t-text-secondary text-lg max-w-2xl mx-auto">{heroDescription}</p>
            ) : null}
          </div>
        </section>
      )}

      {/* article-list 视图切换（保留用户偏好） */}
      {isArticleListTpl && (
        <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-1 rounded-lg bg-t-bg-tertiary p-1">
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded transition-colors ${
                  view === 'grid' ? 'bg-t-bg-secondary text-t-text-primary' : 'text-t-text-muted hover:text-t-text-secondary'
                }`}
                aria-label="网格视图"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded transition-colors ${
                  view === 'list' ? 'bg-t-bg-secondary text-t-text-primary' : 'text-t-text-muted hover:text-t-text-secondary'
                }`}
                aria-label="列表视图"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {sidebarEnabled ? (
          isSidebarLayout ? (
            <div
              className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8"
              style={sidebarOnLeft ? undefined : { gridTemplateColumns: '1fr 260px' }}
            >
              {sidebarOnLeft ? (
                <>
                  {renderSidebar()}
                  <div className="min-w-0">{renderMainContent()}</div>
                </>
              ) : (
                <>
                  <div className="min-w-0">{renderMainContent()}</div>
                  {renderSidebar()}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
              <div className="min-w-0">{renderMainContent()}</div>
              <div className="hidden lg:block">{renderSidebar()}</div>
            </div>
          )
        ) : (
          <div className="min-w-0">{renderMainContent()}</div>
        )}
      </div>
    </div>
  )
}

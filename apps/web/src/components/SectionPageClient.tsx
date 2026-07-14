'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { ArticleCard } from './ArticleCard'
import { Pagination } from './Pagination'
import { SectionSidebar } from './SectionSidebar'
import { MarkdownContent } from './MarkdownContent'
import { LayoutGrid, List } from 'lucide-react'
import { useLayoutStore } from '@/stores/layout'
import { useStyleLayouts } from '@/components/StyleProvider'
import { resolveSectionLayout, type SectionLayoutOverride } from '@/lib/resolveLayout'

interface SectionPageClientProps {
  section: string
  sectionPath: string
  title: string
  description: string | null
  sectionLayouts?: SectionLayoutOverride
}

function ArticleListView({
  articles,
  listCfg,
  category,
}: {
  articles: any[]
  listCfg: any
  category?: string
}) {
  const listLayout = listCfg?.layout || 'grid'
  const columns = Math.min(Math.max(Number(listCfg?.columns) || 3, 1), 4)
  const showThumbnail = listCfg?.showThumbnail !== false
  const showExcerpt = listCfg?.showExcerpt !== false

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
      <div className="w-full" style={{ columnCount: columns, columnGap: '1rem' }}>
        {articles.map((a: any) => (
          <div key={a.id} className="break-inside-avoid mb-4">
            <ArticleCard key={a.id} article={a} showThumbnail={showThumbnail} showExcerpt={showExcerpt} forceView="grid" />
          </div>
        ))}
      </div>
    )
  }

  // grid
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {articles.map((a: any) => (
        <ArticleCard key={a.id} article={a} showThumbnail={showThumbnail} showExcerpt={showExcerpt} forceView="grid" />
      ))}
    </div>
  )
}

export function SectionPageClient({ section, sectionPath, title, description, sectionLayouts }: SectionPageClientProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { view, setView } = useLayoutStore()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || undefined

  const globalLayouts = useStyleLayouts()
  const sectionCfg = resolveSectionLayout(sectionLayouts ?? null, globalLayouts, 'section')
  const layout: string = String(sectionCfg.layout || 'article-list')
  const heroCfg: any = sectionCfg.hero || {}
  const sidebarCfg: any = sectionCfg.sidebar || {}
  const listCfg: any = sectionCfg.list || {}
  const isSidebarLayout = layout === 'page-sidebar-left' || layout === 'page-sidebar-right'
  const sidebarOnLeft = layout === 'page-sidebar-left'

  const isArticleList = layout === 'article-list'

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', section, page, search, category],
    queryFn: () => api.getArticles({ section, page, limit: 12, search: search || undefined, category }),
  })

  // 板块页「特色文章」形态：取首篇（最新）文章正文
  const { data: featuredData } = useQuery({
    queryKey: ['section-featured', section],
    queryFn: () => api.getArticles({ section, limit: 1 }),
    enabled: isSidebarLayout || layout === 'landing',
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const articles = data?.data || []

  // ===== 渲染主内容区 =====
  const renderMainContent = () => {
    // 网站子页形态（page-sidebar-*）：有分类筛选时显示列表，否则显示首篇精选正文
    if (isSidebarLayout) {
      if (category) {
        return <ArticleListView articles={articles} listCfg={listCfg} category={category} />
      }
      const featured = featuredData?.data?.[0]
      if (!featured) {
        return (
          <div className="text-center py-20 text-t-text-secondary">
            {featuredData ? '该板块暂无文章' : '加载中...'}
          </div>
        )
      }
      return (
        <article className="bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-8">
          <h2
            className="text-heading-2 text-t-text-primary mb-3"
            dangerouslySetInnerHTML={{ __html: featured.title }}
          />
          {featured.publishedAt && (
            <div className="text-sm text-t-text-muted mb-6">
              {new Date(featured.publishedAt).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
          <div className="max-w-[var(--reading-max-width)]">
            <MarkdownContent content={featured.content || featured.excerpt || ''} />
          </div>
          <div className="mt-8 pt-6 border-t border-t-border">
            <a
              href={`${featured.section?.path ?? sectionPath}/${featured.slug}`}
              className="inline-flex items-center gap-1.5 text-sm text-t-accent-blue hover:underline"
            >
              阅读全文 →
            </a>
          </div>
        </article>
      )
    }

    if (layout === 'landing') {
      const featured = featuredData?.data?.[0]
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
          <ArticleListView articles={articles} listCfg={listCfg} />
          {data && data.pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
          )}
        </div>
      )
    }

    // 默认：文章列表（article-list）
    if (isLoading) {
      return <div className="text-center py-20 text-t-text-secondary">加载中...</div>
    }
    if (error) {
      return <div className="text-center py-20 text-red-400">加载失败，请重试</div>
    }
    if (articles.length === 0) {
      return (
        <div className="text-center py-20 text-t-text-secondary">
          {search ? '没有找到匹配的文章' : '暂无文章'}
        </div>
      )
    }
    return (
      <>
        <ArticleListView articles={articles} listCfg={{ ...listCfg, layout: listCfg.layout || view }} />
        <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      </>
    )
  }

  // ===== 侧栏（仅 page-sidebar-* 与 article-list 开启了 sidebar 时） =====
  const sidebarEnabled = (isSidebarLayout && sidebarCfg.enabled !== false) || (isArticleList && sidebarCfg.enabled === true)
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
            <h1 className="text-heading-1 gradient-text mb-4">{heroCfg.titleFrom === 'section' ? title : (heroCfg.title || title)}</h1>
            {heroCfg.description && description ? (
              <p className="text-t-text-secondary text-lg max-w-2xl mx-auto">{description}</p>
            ) : null}
          </div>
        </section>
      )}

      {/* article-list 视图切换（保留用户偏好） */}
      {isArticleList && (
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
        {isSidebarLayout ? (
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
                <div className="min-w-0 order-1">{renderMainContent()}</div>
                {renderSidebar()}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
            <div className="min-w-0">{renderMainContent()}</div>
            {sidebarEnabled ? <div className="hidden lg:block">{renderSidebar()}</div> : null}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { ArticleCard } from './ArticleCard'
import { Pagination } from './Pagination'
import { LayoutGrid, List, Search } from 'lucide-react'
import { useLayoutStore } from '@/stores/layout'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'

// 全站文章列表（“查看全部”入口）。注意：此组件不过滤板块，
// 仅用于 /articles 路由；博客板块请走 /blog（动态 [section] 路由）。
export function AllArticlesClient() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { view, setView } = useLayoutStore()
  const locale = useLocaleStore((s) => s.locale)

  const { data, isLoading, error } = useQuery({
    queryKey: ['all-articles', page, search],
    queryFn: () => api.getArticles({ page, limit: 12, search: search || undefined }),
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <section className="relative py-16 px-4 border-b border-t-border">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="relative max-w-[var(--content-max-width)] mx-auto text-center">
          <h1 className="text-heading-1 gradient-text mb-4">{t('blog.title', locale)}</h1>
          <p className="text-t-text-secondary text-lg max-w-2xl mx-auto">
            {t('blog.subtitle', locale)}
          </p>
        </div>
      </section>

      {/* View Toggle + Search */}
      <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-text-secondary" size={18} />
            <input
              type="text"
              placeholder={t('blog.searchPlaceholder', locale)}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(searchInput) }}
              className="w-full pl-10 pr-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary placeholder-t-text-secondary focus:outline-none focus:border-t-accent-blue"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-t-bg-tertiary p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded transition-colors ${
                view === 'grid'
                  ? 'bg-t-bg-secondary text-t-text-primary'
                  : 'text-t-text-muted hover:text-t-text-secondary'
              }`}
              aria-label={t('blog.viewGrid', locale)}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded transition-colors ${
                view === 'list'
                  ? 'bg-t-bg-secondary text-t-text-primary'
                  : 'text-t-text-muted hover:text-t-text-secondary'
              }`}
              aria-label={t('blog.viewList', locale)}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[var(--content-max-width)] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {isLoading && (
          <div className="text-center py-20 text-t-text-secondary">{t('blog.loading', locale)}</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400">{t('blog.error', locale)}</div>
        )}

        {data && data.data.length === 0 && (
          <div className="text-center py-20 text-t-text-secondary">
            {search ? t('blog.searchEmpty', locale) : t('blog.empty', locale)}
          </div>
        )}

        {data && data.data.length > 0 && (
          <>
            <div className={view === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'flex flex-col gap-4'
            }>
              {data.data.map((article: any) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}

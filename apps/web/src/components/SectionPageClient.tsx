'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { ArticleCard } from './ArticleCard'
import { Pagination } from './Pagination'
import { SectionSidebar } from './SectionSidebar'
import { LayoutGrid, List } from 'lucide-react'
import { useLayoutStore } from '@/stores/layout'

interface SectionPageClientProps {
  section: string
  sectionPath: string
  title: string
  description: string | null
}

export function SectionPageClient({ section, sectionPath, title, description }: SectionPageClientProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { view, setView } = useLayoutStore()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || undefined

  const { data, isLoading, error } = useQuery({
    queryKey: ['articles', section, page, search, category],
    queryFn: () => api.getArticles({ section, page, limit: 12, search: search || undefined, category }),
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Hero — 仅当后台设置了 description 时才显示 */}
      {description ? (
        <section className="relative py-16 px-4 border-b border-t-border">
          <div className="absolute inset-0 grid-pattern opacity-50" />
          <div className="relative max-w-7xl mx-auto text-center">
            <h1 className="text-heading-1 gradient-text mb-4">{title}</h1>
            <p className="text-t-text-secondary text-lg max-w-2xl mx-auto">{description}</p>
          </div>
        </section>
      ) : null}

      {/* View Toggle */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-1 rounded-lg bg-t-bg-tertiary p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded transition-colors ${
                view === 'grid'
                  ? 'bg-t-bg-secondary text-t-text-primary'
                  : 'text-t-text-muted hover:text-t-text-secondary'
              }`}
              aria-label="网格视图"
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
              aria-label="列表视图"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content with Right Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8">
          {/* Main Content */}
          <div>
            {isLoading && (
              <div className="text-center py-20 text-t-text-secondary">加载中...</div>
            )}

            {error && (
              <div className="text-center py-20 text-red-400">加载失败，请重试</div>
            )}

            {data && data.data.length === 0 && (
              <div className="text-center py-20 text-t-text-secondary">
                {search ? '没有找到匹配的文章' : '暂无文章'}
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

          {/* Right Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <SectionSidebar
                sectionSlug={section}
                sectionPath={sectionPath}
                search={searchInput}
                onSearchInputChange={setSearchInput}
                onSearch={handleSearch}
                activeCategory={category}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

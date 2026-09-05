'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { SearchBar } from '@/components/SearchBar'
import { Pagination } from '@/components/Pagination'
import { useState, Suspense } from 'react'
import { Clock, ArrowRight } from 'lucide-react'

interface SearchArticle {
  id: number
  title: string
  slug: string
  excerpt: string
  coverImage: string | null
  publishedAt: string
  sectionName: string
  sectionSlug: string
  sectionPath: string
  titleHighlight: string
  contentSnippet: string
}

function SearchResults() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  const section = searchParams.get('section') || ''
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, section, page],
    queryFn: () =>
      api.get(`/search?q=${encodeURIComponent(q)}&section=${section}&page=${page}&limit=10`),
    enabled: !!q,
  })

  return (
    <div className="min-h-screen pt-[var(--header-actual-height)]">
      {/* Search Header */}
      <div className="border-b border-t-border py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-heading-2 text-t-text-primary mb-4">搜索结果</h1>
          <div className="flex justify-center">
            <SearchBar />
          </div>
          {q && (
            <p className="mt-4 text-sm text-t-text-muted">
              搜索 &quot;{q}&quot; — 找到 {data?.pagination?.total || 0} 条结果
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center text-t-text-secondary py-12 animate-pulse">搜索中...</div>
        ) : data?.data && data.data.length > 0 ? (
          <>
            <div className="flex flex-col gap-6">
              {data.data.map((article: SearchArticle) => (
                <Link
                  key={article.id}
                  href={`${article.sectionPath}/${article.slug}`}
                  className="group block p-4 rounded-xl border border-t-border transition-colors hover:border-t-accent-blue hover:bg-t-hover"
                >
                  <div className="flex items-center gap-2 text-xs text-t-text-muted mb-2">
                    <span className="px-2 py-0.5 bg-t-bg-tertiary rounded-full">
                      {article.sectionName}
                    </span>
                    {article.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(article.publishedAt).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-lg font-medium text-t-text-primary group-hover:text-t-accent-blue transition-colors mb-2"
                    dangerouslySetInnerHTML={{ __html: article.titleHighlight || article.title }}
                  />
                  {article.contentSnippet && (
                    <p
                      className="text-sm text-t-text-secondary line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: article.contentSnippet }}
                    />
                  )}
                  <div className="flex items-center gap-1 mt-3 text-xs text-t-accent-blue opacity-0 group-hover:opacity-100 transition-opacity">
                    阅读全文 <ArrowRight size={12} />
                  </div>
                </Link>
              ))}
            </div>
            {data.pagination.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={page}
                  totalPages={data.pagination.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : q ? (
          <div className="text-center py-12">
            <p className="text-t-text-secondary">未找到相关文章</p>
            <p className="text-sm text-t-text-muted mt-2">试试其他关键词？</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-t-text-secondary">输入关键词开始搜索</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-[var(--header-actual-height)] flex items-center justify-center"><div className="animate-pulse text-t-text-secondary">加载中...</div></div>}>
      <SearchResults />
    </Suspense>
  )
}

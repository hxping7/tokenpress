'use client'

import Link from 'next/link'
import { ArticleCard } from '@/components/ArticleCard'
import { Pagination } from '@/components/Pagination'

/**
 * 杂志头条模板：首篇文章作为大图头条，其余以网格展示。
 */
export function MagazineView({
  featured,
  rest,
  columns,
  gap,
  sectionPath,
  pagination,
  page,
  onPageChange,
  layout = 'top',
}: {
  featured: any
  rest: any[]
  columns: number
  gap?: string
  sectionPath: string
  pagination?: any
  page: number
  onPageChange: (p: number) => void
  /** 版式：top=上下（头条在上） / left=左右（头条在左） */
  layout?: 'top' | 'left'
}) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: typeof gap === 'string' && gap ? gap : '1rem',
  }

  const featuredBlock = featured ? (
    <Link
      href={`${featured.section?.path ?? sectionPath}/${featured.slug}`}
      className="group block rounded-2xl overflow-hidden border border-t-border bg-t-bg-primary hover:border-t-accent-blue/50 transition-colors"
    >
      <div
        className={`relative overflow-hidden bg-t-bg-secondary ${
          layout === 'left' ? 'aspect-[4/5] md:aspect-[3/4]' : 'aspect-[21/9]'
        }`}
      >
        {featured.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={featured.coverImage}
            alt={featured.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-t-text-muted">无封面</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <span className="text-xs px-2 py-0.5 rounded bg-t-accent-blue text-black mb-2 inline-block font-medium">头条</span>
          <h2
            className={`font-bold text-white leading-tight ${layout === 'left' ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}
            dangerouslySetInnerHTML={{ __html: featured.title }}
          />
          {featured.excerpt && (
            <p className="mt-2 text-sm text-white/80 line-clamp-2 max-w-2xl">{featured.excerpt}</p>
          )}
        </div>
      </div>
    </Link>
  ) : null

  const restBlock = rest.length > 0 ? (
    <div className="grid" style={gridStyle}>
      {rest.map((a: any) => (
        <ArticleCard key={a.id} article={a} forceView="grid" />
      ))}
    </div>
  ) : null

  // 左右版式：头条居左（占约 5/12），其余网格居右
  if (layout === 'left') {
    return (
      <div className="space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">{featuredBlock}</div>
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {rest.map((a: any) => (
                <ArticleCard key={a.id} article={a} forceView="grid" />
              ))}
            </div>
          </div>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <Pagination page={page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
        )}
      </div>
    )
  }

  // 上下版式（默认）：头条在上，网格在下
  return (
    <div className="space-y-10">
      {featuredBlock}
      {restBlock}
      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
      )}
    </div>
  )
}

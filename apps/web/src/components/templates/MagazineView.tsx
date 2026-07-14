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
  sectionPath,
  pagination,
  page,
  onPageChange,
}: {
  featured: any
  rest: any[]
  columns: number
  sectionPath: string
  pagination?: any
  page: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="space-y-10">
      {featured && (
        <Link
          href={`${featured.section?.path ?? sectionPath}/${featured.slug}`}
          className="group block rounded-2xl overflow-hidden border border-t-border bg-t-bg-primary hover:border-t-accent-blue/50 transition-colors"
        >
          <div className="relative aspect-[21/9] overflow-hidden bg-t-bg-secondary">
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
                className="text-2xl md:text-3xl font-bold text-white leading-tight"
                dangerouslySetInnerHTML={{ __html: featured.title }}
              />
              {featured.excerpt && (
                <p className="mt-2 text-sm text-white/80 line-clamp-2 max-w-2xl">{featured.excerpt}</p>
              )}
            </div>
          </div>
        </Link>
      )}

      {rest.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {rest.map((a: any) => (
            <ArticleCard key={a.id} article={a} forceView="grid" />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Tag } from 'lucide-react'

interface ArticleSidebarProps {
  articleId: number
  articleTags?: string[]
  sectionSlug?: string
}

export function ArticleSidebar({ articleId, articleTags = [], sectionSlug }: ArticleSidebarProps) {
  // 获取相关文章
  const { data: relatedData } = useQuery({
    queryKey: ['related-articles', articleId],
    queryFn: () => api.get(`/articles?limit=5&status=published`),
    enabled: !!articleId,
  })

  const relatedArticles = (relatedData?.data || [])
    .filter((a: any) => a.id !== articleId)
    .slice(0, 5)

  // 获取热门标签
  const { data: tagsData } = useQuery({
    queryKey: ['popular-tags'],
    queryFn: () => api.get('/tags?limit=20'),
  })

  const tags = tagsData?.data || []

  return (
    <aside className="space-y-8">
      {/* 目录（移动端不显示，由 TableOfContents 组件处理） */}
      <div className="hidden lg:block" />

      {/* 相关文章 */}
      {relatedArticles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-4">
            相关文章
          </h3>
          <div className="space-y-3">
            {relatedArticles.map((article: any) => (
              <Link
                key={article.id}
                href={`${article.section?.path || ''}/${article.slug}`}
                className="group block"
              >
                <div className="flex gap-3">
                  {article.coverImage && (
                    <div className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-t-bg-tertiary">
                      <Image
                        src={article.coverImage}
                        alt={article.title}
                        width={64}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4
                      className="text-sm text-t-text-secondary group-hover:text-t-accent-blue transition-colors line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: article.title }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 标签云 */}
      {tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-4">
            <Tag size={12} className="inline mr-1" />
            标签
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: any) => (
              <Link
                key={tag.id}
                href={`/search?q=${encodeURIComponent(tag.name)}`}
                className="px-2.5 py-1 text-xs bg-t-bg-tertiary text-t-text-secondary rounded-full hover:bg-t-hover hover:text-t-text-primary transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

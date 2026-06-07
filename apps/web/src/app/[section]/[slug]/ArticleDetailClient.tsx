'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { MarkdownContent } from '@/components/MarkdownContent'
import { TableOfContents } from '@/components/TableOfContents'
import { ArticleSidebar } from '@/components/ArticleSidebar'
import { ArticleLikeButton } from '@/components/ArticleLikeButton'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArrowLeft, Calendar, User, Tag, Clock } from 'lucide-react'
import Image from 'next/image'
import { calculateReadingTime, formatReadingTime } from '@/lib/reading-time'

const sectionLabels: Record<string, string> = {
  token_plan: 'Token 计划',
  ai_coding: 'AI 编程',
  ai_works: 'AI 作品',
  blog: '博客',
}

interface Props {
  params: Promise<{ section: string; slug: string }>
}

export function ArticleDetailClient({ params }: Props) {
  const resolvedParams = useParams()
  const slug = resolvedParams.slug as string
  const section = resolvedParams.section as string

  const { data, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: () => api.getArticle(slug),
    enabled: !!slug,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-t-text-secondary animate-pulse">加载中...</div>
      </div>
    )
  }

  if (error || !data?.data) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-t-text-primary mb-2">文章未找到</h1>
          <Link href={`/${section}`} className="text-t-accent-blue hover:underline">
            返回{sectionLabels[section] || '列表'}
          </Link>
        </div>
      </div>
    )
  }

  const article = data.data
  const readingTime = article.content
    ? calculateReadingTime(article.content)
    : 1

  return (
    <article className="min-h-screen pt-16">
      <ArticleViewTracker articleId={article.id} />
      {/* Header */}
      <header className="relative py-16 px-4 border-b border-t-border">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="relative max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href={`/${section}`}
            className="inline-flex items-center gap-1.5 text-sm text-t-text-secondary hover:text-t-text-primary transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            {sectionLabels[section] || section}
          </Link>

          <h1
            className="text-heading-1 text-t-text-primary mb-4"
            dangerouslySetInnerHTML={{ __html: article.title }}
          />

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-t-text-secondary">
            {article.author && (
              <span className="inline-flex items-center gap-1.5">
                <User size={14} />
                {article.author.displayName || article.author.username}
              </span>
            )}
            {article.publishedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                {new Date(article.publishedAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              {formatReadingTime(readingTime)}
            </span>
            {article.category && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-t-bg-tertiary rounded-full text-xs">
                {article.category.name}
              </span>
            )}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Tag size={12} className="text-t-text-muted" />
              {article.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-t-bg-tertiary text-t-text-secondary rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Like Button */}
          <div className="mt-4">
            <ArticleLikeButton articleId={article.id} />
          </div>
        </div>
      </header>

      {/* Cover Image */}
      {article.coverImage && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <Image
            src={article.coverImage}
            alt={article.title}
            width={1200}
            height={630}
            className="w-full rounded-2xl border border-t-border"
            priority
          />
        </div>
      )}

      {/* Content with Sidebar Layout */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_280px] gap-8">
          {/* Left: Table of Contents - 桌面端固定 */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TableOfContents content={article.content} />
            </div>
          </aside>

          {/* Center: Article Content */}
          <main className="min-w-0">
            <MarkdownContent content={article.content} />
          </main>

          {/* Right: Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <ArticleSidebar
                articleId={article.id}
                articleTags={article.tags}
                sectionSlug={section}
              />
            </div>
          </aside>
        </div>
      </div>
    </article>
  )
}

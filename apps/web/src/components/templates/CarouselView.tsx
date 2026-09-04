'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { ArticleCard } from '@/components/ArticleCard'
import { Pagination } from '@/components/Pagination'

/**
 * 轮播模板：顶部轮播精选文章（取板块文章前 N 篇），下方卡片网格列表。
 *
 * - 轮播：当前张淡入淡出，支持左右切换按钮 + 底部指示点 + 可选自动播放
 * - 下方：该板块全部文章（分页）以卡片网格展示，列数/间距来自风格包默认或用户覆盖
 */
export function CarouselView({
  articles,
  carouselCount = 5,
  autoplay = true,
  interval = 5000,
  columns = 3,
  gap,
  sectionPath,
  pagination,
  page,
  onPageChange,
}: {
  articles: any[]
  /** 轮播张数：取板块文章前 N 篇 */
  carouselCount?: number
  /** 是否自动播放 */
  autoplay?: boolean
  /** 自动播放间隔（毫秒），最小 2000 */
  interval?: number
  /** 下方卡片网格列数 */
  columns?: number
  gap?: string
  sectionPath: string
  pagination?: any
  page: number
  onPageChange: (p: number) => void
}) {
  const slides = (articles || []).slice(0, Math.max(1, carouselCount))
  const [current, setCurrent] = useState(0)

  const go = useCallback(
    (idx: number) => {
      if (slides.length === 0) return
      setCurrent(((idx % slides.length) + slides.length) % slides.length)
    },
    [slides.length],
  )

  useEffect(() => {
    if (!autoplay || slides.length <= 1) return
    const ms = Math.max(2000, interval)
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), ms)
    return () => clearInterval(t)
  }, [autoplay, interval, slides.length])

  // 切换轮播源（如翻页导致 articles 变化）时，钳制当前索引
  useEffect(() => {
    if (current >= slides.length) setCurrent(0)
  }, [slides.length, current])

  if (!articles || articles.length === 0) return null

  const gridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: typeof gap === 'string' && gap ? gap : '1rem',
  }

  return (
    <div className="space-y-10">
      {/* 顶部轮播 */}
      <div className="relative rounded-2xl overflow-hidden border border-t-border bg-t-bg-secondary">
        <div className="relative aspect-[21/9]">
          {slides.map((a: any, i: number) => {
            const active = i === current
            return (
              <Link
                key={a.id}
                href={`${a.section?.path ?? sectionPath}/${a.slug}`}
                aria-hidden={!active}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  active ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                {a.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.coverImage}
                    alt={a.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-t-text-muted">无封面</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <span className="text-xs px-2 py-0.5 rounded bg-t-accent-blue text-black mb-2 inline-block font-medium">
                    {a.section?.name || '精选'}
                  </span>
                  <h2
                    className="font-bold text-white leading-tight text-2xl md:text-4xl"
                    dangerouslySetInnerHTML={{ __html: a.title }}
                  />
                  {a.excerpt && (
                    <p className="mt-2 text-sm text-white/80 line-clamp-2 max-w-2xl">{a.excerpt}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* 左右切换 + 指示点 */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(current - 1)}
              aria-label="上一张"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white grid place-items-center hover:bg-black/60 transition"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(current + 1)}
              aria-label="下一张"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white grid place-items-center hover:bg-black/60 transition"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`第 ${i + 1} 张`}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    i === current ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 下方卡片文章网格（板块全部文章） */}
      <div className="grid" style={gridStyle}>
        {articles.map((a: any) => (
          <ArticleCard key={a.id} article={a} forceView="grid" />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
      )}
    </div>
  )
}

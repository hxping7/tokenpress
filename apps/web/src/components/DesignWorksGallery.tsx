'use client'

import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { parseArticleMeta } from '@/lib/articleMeta'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { designCategoryLabel } from '@/lib/designCategory'

interface Props {
  section: string
  sectionPath: string
  title: string
  description: string | null
  mode?: 'standalone' | 'embedded'
  /** 风格包 templates.design-gallery 默认 + 用户覆盖（columns/aspect/gap） */
  config?: Record<string, unknown> | null
}

interface WorkItem {
  id: number
  title: string
  slug: string
  coverImage: string | null
  excerpt: string | null
  section?: { path?: string }
  meta?: any
}

export function DesignWorksGallery({ section, sectionPath, title, description, mode = 'standalone', config }: Props) {
  const isEmbedded = mode === 'embedded'
  const { locale } = useLocaleStore()
  const cfg = config || {}
  const dColumns = Math.min(Math.max(Number(cfg.columns) || 3, 1), 6)
  const dAspectRaw = (typeof cfg.aspect === 'string' && cfg.aspect)
    ? cfg.aspect
    : (typeof cfg.aspectRatio === 'string' && cfg.aspectRatio ? cfg.aspectRatio : '4/3')
  const dAspect = dAspectRaw as string
  const dGap = typeof cfg.gap === 'string' && cfg.gap ? (cfg.gap as string) : '1.5rem'
  const [works, setWorks] = useState<WorkItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (cat: string | null) => {
      setLoading(true)
      try {
        const res = await api.getArticles({ section, limit: 24, status: 'published' })
        let rows: WorkItem[] = res.data || []
        if (cat) {
          rows = rows.filter((w) => parseArticleMeta(w.meta).category === cat)
        }
        setWorks(rows)
      } catch {
        setWorks([])
      } finally {
        setLoading(false)
      }
    },
    [section]
  )

  useEffect(() => {
    load(null)
  }, [load])

  // 分类从作品 meta.category 推导
  useEffect(() => {
    api
      .getArticles({ section, limit: 100, status: 'published' })
      .then((r) => {
        const cats = Array.from(
          new Set((r.data || []).map((w) => parseArticleMeta(w.meta).category).filter(Boolean))
        ) as string[]
        setCategories(cats)
      })
      .catch(() => setCategories([]))
  }, [section])

  const onSelectCat = (cat: string | null) => {
    setActiveCat(cat)
    load(cat)
  }

  return (
    <div className="min-h-screen bg-t-bg-primary">
      {/* 头部：标题 + 简介（sspai 风：大留白、克制） */}
      {!isEmbedded && (
        <div className="max-w-[1200px] mx-auto px-4 pt-20 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-t-text-primary tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-t-text-secondary max-w-2xl">{description}</p>
          )}

          {/* 分类筛选（sspai 式小药丸） */}
          {categories.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              <FilterPill active={activeCat === null} onClick={() => onSelectCat(null)}>
                {t('designWorks.all', locale)}
              </FilterPill>
              {categories.map((c) => (
                <FilterPill key={c} active={activeCat === c} onClick={() => onSelectCat(c)}>
                  {designCategoryLabel(c, locale)}
                </FilterPill>
              ))}
            </div>
          )}
        </div>
      )}

      {/* embedded 模式：只保留分类筛选，紧凑顶部 */}
      {isEmbedded && categories.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            <FilterPill active={activeCat === null} onClick={() => onSelectCat(null)}>
              {t('designWorks.all', locale)}
            </FilterPill>
            {categories.map((c) => (
              <FilterPill key={c} active={activeCat === c} onClick={() => onSelectCat(c)}>
                {designCategoryLabel(c, locale)}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* 作品卡片网格 */}
      <div className="max-w-[1200px] mx-auto px-4 pb-16">
        {loading ? (
          <div
            className="design-grid"
            style={{ '--dg-cols': dColumns, '--dg-gap': dGap } as CSSProperties}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-t-bg-secondary animate-pulse h-72" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-24 text-t-text-muted text-sm">暂无作品</div>
        ) : (
          <div
            className="design-grid"
            style={{ '--dg-cols': dColumns, '--dg-gap': dGap } as CSSProperties}
          >
            {works.map((w) => (
              <WorkCard key={w.id} work={w} sectionPath={sectionPath} aspect={dAspect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
        active
          ? 'bg-t-accent-blue text-black border-t-accent-blue'
          : 'bg-t-bg-secondary text-t-text-secondary border-t-border hover:text-t-text-primary hover:border-t-accent-blue/50'
      }`}
    >
      {children}
    </button>
  )
}

function WorkCard({ work, sectionPath, aspect = '4/3' }: { work: WorkItem; sectionPath: string; aspect?: string }) {
  const { locale } = useLocaleStore()
  const meta = parseArticleMeta(work.meta)
  return (
    <Link
      href={`${sectionPath}/${work.slug}`}
      className="group block rounded-xl overflow-hidden bg-t-bg-secondary border border-t-border hover:border-t-accent-blue/50 hover:shadow-lg transition-all duration-200"
    >
      {/* 封面：比例由风格包 templates.design-gallery.aspect 决定 */}
      <div className="relative overflow-hidden bg-t-bg-primary" style={{ aspectRatio: aspect }}>
        {work.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.coverImage}
            alt={work.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-t-text-muted text-sm">
            无封面
          </div>
        )}
        {meta.category && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-xs rounded-md bg-black/55 text-white backdrop-blur-sm">
            {designCategoryLabel(meta.category, locale)}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-t-text-primary line-clamp-1 group-hover:text-t-accent-blue transition-colors">
          {work.title}
        </h3>
        {work.excerpt && (
          <p className="mt-1.5 text-sm text-t-text-secondary line-clamp-2 leading-relaxed">
            {work.excerpt}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {meta.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={meta.authorAvatar} alt={meta.authorName || ''} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-t-accent-blue/20 flex items-center justify-center text-xs text-t-accent-blue">
              {(meta.authorName || '?').charAt(0)}
            </span>
          )}
          <span className="text-xs text-t-text-muted">{meta.authorName || '匿名'}</span>
        </div>
      </div>
    </Link>
  )
}

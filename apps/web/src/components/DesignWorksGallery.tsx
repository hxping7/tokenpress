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
  /** 外层已渲染筛选侧栏（page-sidebar-* 布局）时隐藏自带分类 pill，避免重复 */
  hideFilters?: boolean
  /** 外层侧栏控制分类时传入的当前分类（URL `?category=`）；仅在 hideFilters 时生效 */
  activeCategory?: string | null
}

interface WorkItem {
  id: number
  title: string
  slug: string
  coverImage: string | null
  excerpt: string | null
  publishedAt?: string | null
  section?: { path?: string }
  meta?: any
}

export function DesignWorksGallery({ section, sectionPath, title, description, mode = 'standalone', config, hideFilters = false, activeCategory = null }: Props) {
  const isEmbedded = mode === 'embedded'
  const { locale } = useLocaleStore()
  const cfg = config || {}
  const dColumns = Math.min(Math.max(Number(cfg.columns) || 3, 1), 6)
  /** layout:'masonry' → 瀑布流（CSS 多列，卡片高度可不等），否则用 design-grid 等距网格 */
  const isMasonry = String(cfg.layout || '') === 'masonry'
  const dAspectRaw = (typeof cfg.aspect === 'string' && cfg.aspect)
    ? cfg.aspect
    : (typeof cfg.aspectRatio === 'string' && cfg.aspectRatio ? cfg.aspectRatio : '4/3')
  const dAspect = dAspectRaw as string
  const dGap = typeof cfg.gap === 'string' && cfg.gap ? (cfg.gap as string) : '1.5rem'
  /** 卡片元信息（N° 编号 + 日期）与 tags 胶囊，风格包 templates.design-gallery 可关 */
  const dShowMeta = cfg.showMeta !== false
  const dShowTags = cfg.showTags !== false
  const dShowExcerpt = cfg.showExcerpt !== false
  const dShowAuthor = cfg.showAuthor !== false
  const dNumberPrefix = typeof cfg.numberPrefix === 'string' && cfg.numberPrefix ? (cfg.numberPrefix as string) : 'N°'
  /** 卡片形态：boxed（圆角描边卡片，默认） / flat（无边框无底色） */
  const dCardStyle = cfg.cardStyle === 'flat' ? 'flat' : 'boxed'
  /** 编号呈现：badge（封面右上角标，默认） / watermark（封面中央大字） */
  const dNumberStyle = cfg.numberStyle === 'watermark' ? 'watermark' : 'badge'
  const dShowCategoryBadge = cfg.showCategoryBadge !== false
  /** 逐卡轮换的封面比例（如 ["3/4","1/1","4/5"]）营造瀑布节奏；未配则统一用 aspect */
  const dAspectCycle = Array.isArray(cfg.aspectCycle)
    ? (cfg.aspectCycle as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []
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

  /** 外层侧栏控制分类时以传入的 activeCategory 为准，否则用组件内 pill 的自身状态 */
  const effectiveCat = hideFilters ? (activeCategory || null) : activeCat

  useEffect(() => {
    load(effectiveCat)
  }, [load, effectiveCat])

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

      {/* embedded 模式：只保留分类筛选，紧凑顶部（外层已有筛选侧栏时隐藏） */}
      {isEmbedded && !hideFilters && categories.length > 0 && (
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
          isMasonry ? (
            <div style={{ columnCount: dColumns, columnGap: dGap }}>
              {works.map((w, i) => (
                <div key={w.id} className="break-inside-avoid" style={{ marginBottom: dGap }}>
                  <WorkCard
                    work={w}
                    sectionPath={sectionPath}
                    aspect={dAspectCycle.length ? dAspectCycle[i % dAspectCycle.length] : dAspect}
                    index={i}
                    numberPrefix={dNumberPrefix}
                    showMeta={dShowMeta}
                    showTags={dShowTags}
                    showExcerpt={dShowExcerpt}
                    showAuthor={dShowAuthor}
                    cardStyle={dCardStyle}
                    numberStyle={dNumberStyle}
                    showCategoryBadge={dShowCategoryBadge}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className="design-grid"
              style={{ '--dg-cols': dColumns, '--dg-gap': dGap } as CSSProperties}
            >
              {works.map((w, i) => (
                <WorkCard
                  key={w.id}
                  work={w}
                  sectionPath={sectionPath}
                  aspect={dAspectCycle.length ? dAspectCycle[i % dAspectCycle.length] : dAspect}
                  index={i}
                  numberPrefix={dNumberPrefix}
                  showMeta={dShowMeta}
                  showTags={dShowTags}
                  showExcerpt={dShowExcerpt}
                  showAuthor={dShowAuthor}
                  cardStyle={dCardStyle}
                  numberStyle={dNumberStyle}
                  showCategoryBadge={dShowCategoryBadge}
                />
              ))}
            </div>
          )
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

interface WorkCardProps {
  work: WorkItem
  sectionPath: string
  aspect?: string
  /** 在列表中的位置（派生 N° 编号用） */
  index?: number
  numberPrefix?: string
  showMeta?: boolean
  showTags?: boolean
  showExcerpt?: boolean
  showAuthor?: boolean
  /** 卡片形态：boxed = 圆角描边卡片；flat = 无边框无底色，直接落在页面上 */
  cardStyle?: 'boxed' | 'flat'
  /** 编号呈现：badge = 封面右上小角标；watermark = 封面中央大字水印 */
  numberStyle?: 'badge' | 'watermark'
  /** 封面上是否显示分类角标 */
  showCategoryBadge?: boolean
}

/** 作品日期格式化为 2026.07.20（原型风格） */
function formatPieceDate(v?: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

function WorkCard({
  work,
  sectionPath,
  aspect = '4/3',
  index = 0,
  numberPrefix = 'N°',
  showMeta = true,
  showTags = true,
  showExcerpt = true,
  showAuthor = true,
  cardStyle = 'boxed',
  numberStyle = 'badge',
  showCategoryBadge = true,
}: WorkCardProps) {
  const { locale } = useLocaleStore()
  const meta = parseArticleMeta(work.meta)
  // 作品编号：meta.number 优先（数据侧可指定），否则按列表顺序派生 01 / 02 / …
  const pieceNo =
    meta.number != null && String(meta.number).trim() !== ''
      ? String(meta.number).padStart(2, '0')
      : String(index + 1).padStart(2, '0')
  const dateLabel = formatPieceDate(work.publishedAt)
  const tags = meta.tags || []
  // aspect:'auto' → 由图片原始比例决定高度（瀑布流更自然）；无封面时退回 4/3 占位
  const isAutoAspect = aspect === 'auto'
  const imgBoxStyle = !isAutoAspect
    ? ({ aspectRatio: aspect } as CSSProperties)
    : !work.coverImage
      ? ({ aspectRatio: '4/3' } as CSSProperties)
      : undefined

  const isFlat = cardStyle === 'flat'
  const isWatermark = numberStyle === 'watermark'

  return (
    <Link
      href={`${sectionPath}/${work.slug}`}
      className={
        isFlat
          ? 'group block'
          : 'group block rounded-xl overflow-hidden bg-t-bg-secondary border border-t-border hover:border-t-accent-blue/50 hover:shadow-lg transition-all duration-200'
      }
    >
      {/* 封面：比例由风格包 templates.design-gallery.aspect 决定 */}
      <div
        className={`relative overflow-hidden ${isFlat ? 'bg-t-bg-secondary' : 'bg-t-bg-primary'}`}
        style={imgBoxStyle}
      >
        {work.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.coverImage}
            alt={work.title}
            loading="lazy"
            className={`w-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ${isAutoAspect ? 'h-auto' : 'h-full'}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-t-text-muted text-sm">
            无封面
          </div>
        )}
        {showCategoryBadge && meta.category && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-xs rounded-md bg-black/55 text-white backdrop-blur-sm">
            {designCategoryLabel(meta.category, locale)}
          </span>
        )}
        {/* 编号：badge = 右上角标；watermark = 封面中央大字 */}
        {showMeta && !isWatermark && (
          <span className="absolute top-3 right-3 px-2 py-0.5 text-xs rounded-md bg-black/55 text-white backdrop-blur-sm tabular-nums">
            {numberPrefix} {pieceNo}
          </span>
        )}
        {showMeta && isWatermark && (
          <span
            className="absolute inset-0 flex items-center justify-center text-white/90 text-[clamp(2.5rem,6vw,4.5rem)] leading-none tracking-wide"
            style={{
              fontFamily: 'var(--brand-font, ui-serif, Georgia, "Songti SC", serif)',
              textShadow: '0 1px 12px rgba(0,0,0,.45)',
            }}
          >
            {numberPrefix} {pieceNo}
          </span>
        )}
      </div>

      <div className={isFlat ? 'pt-3' : 'p-4'}>
        {/* N° 编号 · 日期 元信息行（风格包 showMeta 可关） */}
        {showMeta && (
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-t-text-muted tabular-nums">
            {numberPrefix} {pieceNo}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </div>
        )}

        <h3 className="text-base font-semibold text-t-text-primary line-clamp-2 group-hover:text-t-accent-blue transition-colors">
          {work.title}
        </h3>

        {/* tags 胶囊（来自 meta.tags，风格包 showTags 可关） */}
        {showTags && tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] font-medium rounded-full bg-t-bg-primary border border-t-border text-t-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {showExcerpt && work.excerpt && (
          <p className="mt-2 text-sm text-t-text-secondary line-clamp-2 leading-relaxed">
            {work.excerpt}
          </p>
        )}

        {showAuthor && (
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
        )}
      </div>
    </Link>
  )
}

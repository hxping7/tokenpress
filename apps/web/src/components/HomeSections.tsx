'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HeroCarousel, type HeroCtaButton } from '@/components/HeroCarousel'
import { ArticleCard } from '@/components/ArticleCard'
import { SearchBar } from '@/components/SearchBar'
import { ViewToggle } from '@/components/ViewToggle'
import { HomeBanner, type HomeBannerConfig } from '@/components/HomeBanner'
import { Icon } from '@/components/Header'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLocaleStore } from '@/stores'
import { useStyleLayouts } from '@/components/StyleProvider'

interface HeroSlide { id: string; imageUrl: string; linkUrl: string; linkTarget: '_blank' | '_self' }
interface Article { id: number; title: string; slug: string; excerpt: string | null; coverImage: string | null; publishedAt: string; section: { name: string; path: string } }
interface SectionItem { id: number; name: string; slug: string; path: string; externalUrl: string | null }

function HeroSection({ slides, size, interval, ctaButtons, variant, autoplay, showCTA }: {
  slides: HeroSlide[]; size: string; interval: number; ctaButtons: HeroCtaButton[]; variant?: string
  autoplay?: boolean; showCTA?: boolean
}) {
  // size 取自 siteSettings（p.size > heroSize 回退），variant 仅控制展示风格（如 split-image-right）
  const heroSize = size || 'standard'
  return (
    <HeroCarousel slides={slides} size={heroSize as any} interval={interval} ctaButtons={ctaButtons} autoplay={autoplay} showCTA={showCTA} />
  )
}

function FeaturesSection({ variant }: { variant?: string }) {
  const { locale } = useLocaleStore()
  const { data } = useQuery({ queryKey: ['sections'], queryFn: () => api.get('/sections') })
  const sections = (data?.data || []) as SectionItem[]
  const cols = variant === '3-col-cards' ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'
  return (
    <section className="py-12 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        <h2 className="text-2xl font-bold text-t-text-primary mb-8 text-center">
          {locale === 'en' ? 'What we offer' : '我们的能力'}
        </h2>
        <div className={`grid grid-cols-1 ${cols} gap-6`}>
          {sections.slice(0, 6).map((s) => (
            <Link
              key={s.id}
              href={s.externalUrl || s.path}
              className="card-surface card-surface-hover rounded-2xl p-6 block transition-all"
            >
              <div className="text-lg font-semibold text-t-text-primary mb-2">{s.name}</div>
              <div className="text-sm text-t-text-muted">{locale === 'en' ? 'Explore' : '了解更多'} →</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function ArticleListSection({ articles, columns = 3, limit, showViewToggle = true, variant, source }: {
  articles: Article[]; columns?: number; limit?: number; showViewToggle?: boolean; variant?: string; source?: string
}) {
  const { locale } = useLocaleStore()
  // source:featured → 仅取精选；无精选时回退到全部，避免空白
  const sourceFiltered = source === 'featured'
    ? articles.filter((a) => (a as any).featured)
    : articles
  const list = sourceFiltered.length > 0 ? sourceFiltered : articles
  const shown = limit ? list.slice(0, limit) : list

  const isMasonry = variant === 'masonry'
  const colCount = variant === 'grid-2' ? 2 : variant === 'grid-4' ? 4 : columns

  const heading = (
    <div className="flex items-center justify-between mb-8">
      <h2 className="text-2xl font-bold text-t-text-primary">{locale === 'en' ? 'Latest articles' : '最新文章'}</h2>
      <div className="flex items-center gap-4">
        <SearchBar />
        {showViewToggle && <ViewToggle />}
        <Link href="/articles" className="text-sm text-t-accent-blue hover:underline">{locale === 'en' ? 'View all →' : '查看全部 →'}</Link>
      </div>
    </div>
  )

  // 瀑布流：CSS 多列，卡片不被截断
  if (isMasonry) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-[var(--content-max-width)] mx-auto">
          {heading}
          <div className="w-full" style={{ columnCount: colCount, columnGap: '1.5rem' }}>
            {shown.map((a) => (
              <div key={a.id} className="break-inside-avoid mb-6">
                <ArticleCard article={a} />
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const colClass = colCount === 2 ? 'md:grid-cols-2' : colCount === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'
  return (
    <section className="py-8 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        {heading}
        <div className={`grid grid-cols-1 ${colClass} gap-6`}>
          {shown.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      </div>
    </section>
  )
}

function CtaSection({ variant }: { variant?: string }) {
  const { locale } = useLocaleStore()
  // banner 变体：实色 accent 底（去渐变），白字 + 白底反色按钮
  if (variant === 'banner') {
    return (
      <section className="py-10 px-4">
        <div className="max-w-[var(--content-max-width)] mx-auto">
          <div className="rounded-2xl p-10 text-center bg-t-accent-blue">
            <h2 className="text-2xl font-bold text-white mb-4">{locale === 'en' ? 'Ready to start?' : '准备好了吗？'}</h2>
            <Link
              href="/blog"
              className="inline-flex items-center px-6 py-3 bg-white text-t-accent-blue font-medium hover:opacity-90 transition-opacity"
              style={{ borderRadius: 'var(--btn-radius)' }}
            >
              {locale === 'en' ? 'Read the blog' : '阅读博客'}
            </Link>
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="py-10 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        <div className="card-surface rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-t-text-primary mb-4">{locale === 'en' ? 'Ready to start?' : '准备好了吗？'}</h2>
          <Link href="/blog" className="btn-pack-primary px-6 py-3">
            {locale === 'en' ? 'Read the blog' : '阅读博客'}
          </Link>
        </div>
      </div>
    </section>
  )
}

// ===== 声明式自定义区块（CustomBlock）=====
// 纯 JSON 驱动，AI agent / 用户无需改代码即可拼装全新首页段落：
//   eyebrow / title / intro / columns / background
//   items: [{ icon, title, text, href }]
//   cta:   { label, href, style }
function sanitizeHref(href?: string): string {
  if (!href || typeof href !== 'string') return '#'
  const h = href.trim()
  if (h.startsWith('/') || h.startsWith('http://') || h.startsWith('https://') || h.startsWith('//') || h.startsWith('#')) {
    return h
  }
  return '#'
}

function resolveLabel(label: any, locale: string): string {
  if (!label) return ''
  if (typeof label === 'string') return label
  if (typeof label === 'object') return locale === 'en' ? (label.en ?? label.zh ?? '') : (label.zh ?? label.en ?? '')
  return ''
}

function CustomBlockSection({ block }: { block: any }) {
  const { locale } = useLocaleStore()
  const p = block || {}
  const columns = Math.min(4, Math.max(2, Number(p.columns || 3)))
  const colClass = columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
  const items: any[] = Array.isArray(p.items) ? p.items : []
  const cta = p.cta && typeof p.cta === 'object' ? p.cta : null
  // cta2：可选第二按钮（企业官网风：主按钮 + 次按钮并排）
  const cta2 = p.cta2 && typeof p.cta2 === 'object' ? p.cta2 : null
  const bg = typeof p.background === 'string' && p.background.trim() ? p.background : undefined
  // size:'hero' → 超大标题首屏（企业官网风，参考 Tezign 居中超大黑标题）
  const isHero = p.size === 'hero'

  return (
    <section className={`${isHero ? 'pt-24 pb-20 md:pt-32 md:pb-28' : 'py-12'} px-4`} style={bg ? { background: bg } : undefined}>
      <div className="max-w-[var(--content-max-width)] mx-auto">
        {(p.eyebrow || p.title || p.intro) && (
          <div className={`text-center ${isHero ? 'mb-0' : 'mb-10'}`}>
            {p.eyebrow && (
              <div className="text-xs font-semibold tracking-widest uppercase text-t-accent-blue mb-2">{p.eyebrow}</div>
            )}
            {p.title && (
              <h2 className={`font-bold text-t-text-primary ${isHero ? 'text-4xl md:text-6xl tracking-tight leading-tight max-w-4xl mx-auto' : 'text-2xl md:text-3xl'}`}>
                {p.title}
              </h2>
            )}
            {p.intro && (
              <p className={`text-t-text-secondary mx-auto ${isHero ? 'mt-6 text-base md:text-lg max-w-2xl' : 'mt-3 max-w-2xl'}`}>
                {p.intro}
              </p>
            )}
            {(cta || cta2) && (
              <div className={`flex justify-center gap-3 flex-wrap ${isHero ? 'mt-10' : 'mt-6'}`}>
                {cta && (
                  <Link
                    href={sanitizeHref(cta.href)}
                    className={`px-6 py-3 ${cta.style === 'outline' ? 'btn-pack-outline' : 'btn-pack-primary'}`}
                  >
                    {resolveLabel(cta.label, locale)}
                  </Link>
                )}
                {cta2 && (
                  <Link
                    href={sanitizeHref(cta2.href)}
                    className={`px-6 py-3 ${cta2.style === 'primary' ? 'btn-pack-primary' : 'btn-pack-outline'}`}
                  >
                    {resolveLabel(cta2.label, locale)}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
        {items.length > 0 && (
          <div className={`grid grid-cols-1 ${colClass} gap-6`}>
            {items.map((it, i) => {
              const href = sanitizeHref(it.href)
              const inner = (
                <>
                  {it.icon && (
                    <div className="mb-3 text-t-accent-blue">
                      <Icon name={it.icon} size={28} />
                    </div>
                  )}
                  {it.title && <div className="text-lg font-semibold text-t-text-primary mb-1">{it.title}</div>}
                  {it.text && <div className="text-sm text-t-text-secondary">{it.text}</div>}
                </>
              )
              return href === '#' ? (
                <div key={i} className="card-surface card-surface-hover rounded-2xl p-6 block transition-all">
                  {inner}
                </div>
              ) : (
                <Link key={i} href={href} className="card-surface card-surface-hover rounded-2xl p-6 block transition-all" target={it.target === '_blank' ? '_blank' : undefined} rel={it.target === '_blank' ? 'noopener noreferrer' : undefined}>
                  {inner}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ===== 首页组件插件式注册表 =====
// 渲染器按组件名动态装配；新增类型只需在此登记（或经后端白名单扩展）。
interface HomeCtx {
  heroSlides: HeroSlide[]
  heroSize: string
  heroInterval: number
  ctaButtons: HeroCtaButton[]
  heroEnabled?: boolean
  heroAutoplay?: boolean
  heroShowCTA?: boolean
  recentArticles: Article[]
  homeBanners?: HomeBannerConfig[]
}

const HOMEPAGE_REGISTRY: Record<string, (sec: any, ctx: HomeCtx) => JSX.Element | null> = {
  Hero: (sec, ctx) => {
    if (ctx.heroEnabled === false) return null
    return (
      <HeroSection
        slides={ctx.heroSlides}
        size={sec.props?.size || (sec.variant === 'fullscreen' ? 'fullscreen' : ctx.heroSize)}
        interval={ctx.heroInterval}
        ctaButtons={ctx.ctaButtons}
        variant={sec.variant}
        autoplay={ctx.heroAutoplay}
        showCTA={ctx.heroShowCTA}
      />
    )
  },
  Features: (sec) => <FeaturesSection variant={sec.variant} />,
  ArticleList: (sec, ctx) => (
    <ArticleListSection
      articles={ctx.recentArticles}
      columns={sec.props?.columns || 3}
      limit={sec.props?.limit}
      showViewToggle={sec.props?.showViewToggle !== false}
      variant={sec.variant}
      source={sec.props?.source}
    />
  ),
  CTA: (sec) => <CtaSection variant={sec.variant} />,
  Banner: (sec, ctx) => {
    const id = sec.id as string | undefined
    const cfg = id
      ? ctx.homeBanners?.find((b) => b.id === id && b.enabled)
      : ctx.homeBanners?.find((b) => b.enabled)
    return cfg ? <HomeBanner config={cfg} /> : null
  },
  CustomBlock: (sec) => <CustomBlockSection block={sec.props || {}} />,
}

export function HomeSections({
  heroSlides,
  heroSize,
  heroInterval,
  ctaButtons,
  heroEnabled,
  heroAutoplay,
  heroShowCTA,
  recentArticles,
  homeBanners,
}: {
  heroSlides: HeroSlide[]
  heroSize: string
  heroInterval: number
  ctaButtons: HeroCtaButton[]
  heroEnabled?: boolean
  heroAutoplay?: boolean
  heroShowCTA?: boolean
  recentArticles: Article[]
  homeBanners?: HomeBannerConfig[]
}) {
  const layouts = useStyleLayouts()
  const homepage = layouts?.homepage
  const sections = homepage?.sections as
    | { component: string; variant?: string; props?: any; id?: string }[]
    | undefined

  const ctx: HomeCtx = { heroSlides, heroSize, heroInterval, ctaButtons, heroEnabled, heroAutoplay, heroShowCTA, recentArticles, homeBanners }

  // 无配置时回退到经典布局（保持向后兼容）
  if (!sections || sections.length === 0) {
    return (
      <>
        {heroEnabled !== false && (
          <HeroSection slides={heroSlides} size={heroSize} interval={heroInterval} ctaButtons={ctaButtons} autoplay={heroAutoplay} showCTA={heroShowCTA} />
        )}
        <ArticleListSection articles={recentArticles} />
      </>
    )
  }

  return (
    <>
      {sections.map((sec, i) => {
        const Renderer = HOMEPAGE_REGISTRY[sec.component]
        if (!Renderer) return null
        // 注册表渲染器签名为 (sec, ctx)，必须作为函数调用传入两个参数；
        // 若用 JSX <Renderer sec ctx />，React 只会把二者合并为单个 props 传入，导致 ctx 丢失。
        return <Fragment key={i}>{Renderer(sec, ctx)}</Fragment>
      })}
    </>
  )
}

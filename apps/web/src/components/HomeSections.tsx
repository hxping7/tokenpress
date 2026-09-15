'use client'

import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
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

/**
 * Hero 的「左文右图」形态（区块 variant: 'split'）。
 *
 * 关键约束：**后台的宣传页设置必须继续生效** —— 右侧就是后台配置的轮播
 * （hero_slides 手动图 / 文章封面填补 / 轮播数量 / 间隔 / 尺寸），左侧是风格包
 * 提供的门面文案。未配置任何轮播图时，右侧回退到包内媒体（props.media.src）。
 */
function HeroSplitSection({
  props,
  slides,
  size,
  interval,
  ctaButtons,
  autoplay,
}: {
  props: any
  slides: HeroSlide[]
  size: string
  interval: number
  ctaButtons: HeroCtaButton[]
  autoplay?: boolean
}) {
  const { locale } = useLocaleStore()
  const title = String(props?.title || '')
  const accent = String(props?.titleAccent || '')
  const titleParts = accent && title.includes(accent) ? title.split(accent) : [title, '']
  const stats = Array.isArray(props?.stats) ? props.stats.slice(0, 3) : []
  const media = props?.media || {}
  const hasSlides = slides.length > 0

  return (
    <section
      className="py-16 md:py-20 px-4"
      style={props?.background ? { background: props.background } : undefined}
    >
      <div className="max-w-[var(--content-max-width)] mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center">
        {/* 左：门面文案（装修，来自风格包） */}
        <div>
          {props?.eyebrow && (
            <div className="text-xs tracking-[0.18em] uppercase text-t-accent-blue mb-4">{props.eyebrow}</div>
          )}
          {title && (
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-t-text-primary leading-[1.15]">
              {titleParts[0]}
              {accent && titleParts[1] !== undefined && (
                <span className="text-t-accent-blue">
                  {accent}
                  {titleParts.slice(2).join(accent)}
                </span>
              )}
            </h1>
          )}
          {props?.intro && (
            <p className="mt-5 text-base md:text-lg leading-relaxed text-t-text-secondary max-w-[34rem]">{props.intro}</p>
          )}
          {stats.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((s: any, i: number) => (
                <div key={i}>
                  <div className="text-2xl font-extrabold text-t-accent-blue tabular-nums">{s?.value}</div>
                  <div className="text-xs text-t-text-muted mt-1">{s?.label}</div>
                </div>
              ))}
            </div>
          )}
          {ctaButtons.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {ctaButtons.map((b, i) => {
                const isSecondary = b.variant === 'ghost'
                const primary = !isSecondary && (b.variant === 'primary' || i === 0)
                return (
                  <Link
                    key={i}
                    href={b.href || '#'}
                    target={b.target === '_blank' ? '_blank' : undefined}
                    rel={b.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className={
                      primary
                        ? 'inline-flex items-center px-6 py-3 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90'
                        : 'inline-flex items-center px-6 py-3 rounded-full text-sm font-bold border-2 border-t-border text-t-text-primary hover:bg-t-hover transition-colors'
                    }
                    style={
                      primary
                        ? { background: 'linear-gradient(100deg, var(--accent-blue), var(--accent-purple))' }
                        : undefined
                    }
                  >
                    {typeof b.label === 'string' ? b.label : (b.label as any)?.[locale] || '按钮'}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 右：后台配置的轮播（设置生效处）；无图时回退包内媒体 */}
        <div>
          {hasSlides ? (
            <HeroCarousel
              slides={slides}
              size={size as any}
              interval={interval}
              ctaButtons={[]}
              autoplay={autoplay}
              showCTA={false}
            />
          ) : media?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.src}
              alt={props?.title || 'hero'}
              className="w-full h-auto rounded-[var(--radius-card)]"
              style={{ aspectRatio: String(media.aspect || '3/2').replace('/', ' / '), objectFit: media.fit === 'cover' ? 'cover' : 'contain' }}
            />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function HeroSection({ slides, size, interval, ctaButtons, variant, autoplay, showCTA, props }: {
  slides: HeroSlide[]; size: string; interval: number; ctaButtons: HeroCtaButton[]; variant?: string
  autoplay?: boolean; showCTA?: boolean; props?: any
}) {
  // variant === 'split'：左文右图（右侧仍是后台配置的轮播）
  if (variant === 'split') {
    return (
      <HeroSplitSection
        props={props}
        slides={slides}
        size={size}
        interval={interval}
        ctaButtons={showCTA === false ? [] : ctaButtons}
        autoplay={autoplay}
      />
    )
  }
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

function ArticleListSection({ articles, columns = 3, limit, showViewToggle = true, variant, source, heading }: {
  articles: Article[]; columns?: number; limit?: number; showViewToggle?: boolean; variant?: string; source?: string; heading?: any
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

  // 风格包配了 heading 就用区块标题（可自定义 label/title/more）；否则回退默认「最新文章」
  const headingNode = heading ? (
    <BlockHeading
      cfg={heading}
      locale={locale}
      right={
        <>
          <SearchBar />
          {showViewToggle && <ViewToggle />}
        </>
      }
    />
  ) : (
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
          {headingNode}
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
        {headingNode}
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

/**
 * 通用区块标题（风格包可配）：{ label, title, more:{ label, href } }
 * 任何首页区块都可通过 sec.heading 声明；未配则各区块回退自身默认标题。
 */
function BlockHeading({ cfg, locale, right }: { cfg?: any; locale: string; right?: ReactNode }) {
  if (!cfg) return null
  const label = resolveLabel(cfg.label, locale)
  const title = resolveLabel(cfg.title, locale)
  const more = cfg.more && typeof cfg.more === 'object' ? cfg.more : null
  if (!label && !title && !more && !right) return null
  return (
    <div className="mb-8 pb-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          {label && (
            <div className="text-xs font-semibold tracking-[0.2em] uppercase text-t-accent-blue">{label}</div>
          )}
          {title && (
            <h2
              className="mt-1.5 text-2xl md:text-3xl text-t-text-primary"
              style={{
                fontFamily: 'var(--brand-font, inherit)',
                fontWeight: 'var(--heading-weight, 700)',
                letterSpacing: 'var(--heading-tracking, inherit)',
              }}
            >
              {title}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-4">
          {right}
          {more && (
            <Link href={sanitizeHref(more.href)} className="text-sm text-t-accent-blue hover:underline">
              {resolveLabel(more.label, locale) || (locale === 'en' ? 'View all' : '查看全部')} →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

/** 标题内斜体强调：把 titleAccent 命中的子串渲染为 accent 色斜体 */
function renderTitle(title: string, accent?: string) {
  const a = typeof accent === 'string' ? accent : ''
  if (!a || !title.includes(a)) return <>{title}</>
  const i = title.indexOf(a)
  return (
    <>
      {title.slice(0, i)}
      <em className="italic" style={{ color: 'var(--accent-blue)' }}>{a}</em>
      {title.slice(i + a.length)}
    </>
  )
}

function CustomBlockSection({ block, ctx, heading }: { block: any; ctx?: HomeCtx; heading?: any }) {
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

  // ===== Showcase：左文右图首屏（手办设计师原型风格）=====
  // split:  { enabled, ratio: "1/1.4", reverse }  → 左右分栏
  // media:  { src|url, source:'latest', section, aspect, alt, badge, caption:{ over, title } }
  // stats:  [{ value, label }]                    → 统计数字组
  // titleAccent: 标题中需要斜体 accent 强调的子串
  const split = p.split && typeof p.split === 'object' && p.split.enabled ? p.split : null
  const media = p.media && typeof p.media === 'object' ? p.media : null
  const stats: any[] = Array.isArray(p.stats) ? p.stats : []
  const mediaSrc: string | null =
    (typeof media?.src === 'string' && media.src) ||
    (typeof media?.url === 'string' && media.url) ||
    (media?.source === 'latest'
      ? (ctx?.recentArticles?.find((a: any) => a.coverImage)?.coverImage as string) || null
      : null)
  const mediaAspect = typeof media?.aspect === 'string' ? media.aspect : '4/5'
  // fit：'cover'（默认，填满裁切）/ 'contain'（完整显示，留白由容器底色兜）。
  // 文章封面多为 1200×630 横版，若媒体框配成竖版（如 4/5），cover 会把图上文字
  // 裁掉——此时应改配 contain。
  const mediaFit = media?.fit === 'contain' ? 'object-contain' : 'object-cover'
  const splitRatio = typeof split?.ratio === 'string' ? split.ratio : '1/1.4'
  const [l, r] = splitRatio.split('/')
  const splitCols = `${l || '1'}fr ${r || '1.4'}fr`

  const titleNode = p.title ? (
    <h2
      className={`font-bold text-t-text-primary ${isHero ? 'text-4xl md:text-6xl' : 'text-2xl md:text-3xl'} tracking-tight leading-tight ${split ? '' : 'max-w-4xl mx-auto'}`}
      style={{ fontFamily: 'var(--brand-font, inherit)', fontWeight: 'var(--heading-weight, 700)' }}
    >
      {renderTitle(p.title, p.titleAccent)}
    </h2>
  ) : null

  const introNode = p.intro ? (
    <p className={`text-t-text-secondary ${split ? '' : 'mx-auto'} ${isHero ? 'mt-6 text-base md:text-lg max-w-2xl' : 'mt-3 max-w-2xl'}`}>
      {p.intro}
    </p>
  ) : null

  const statsNode = stats.length > 0 ? (
    <div
      className={`flex flex-wrap gap-8 mt-8 pt-6 ${split ? '' : 'justify-center'}`}
      style={{ borderTop: '1px solid var(--border-color)' }}
    >
      {stats.map((s: any, i: number) => (
        <div key={i} className={split ? '' : 'text-center'}>
          <div className="text-xl md:text-2xl text-t-text-primary" style={{ fontFamily: 'var(--brand-font, inherit)' }}>
            {String(s.value ?? '')}
          </div>
          <div className="mt-1 text-xs tracking-wide text-t-text-muted">{resolveLabel(s.label, locale)}</div>
        </div>
      ))}
    </div>
  ) : null

  const ctasNode = (cta || cta2) ? (
    <div className={`flex gap-3 flex-wrap ${split ? '' : 'justify-center'} ${isHero ? 'mt-10' : 'mt-6'}`}>
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
  ) : null

  const mediaNode = mediaSrc ? (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: mediaAspect, background: 'var(--bg-tertiary)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaSrc} alt={resolveLabel(media?.alt, locale) || ''} className={`w-full h-full ${mediaFit}`} />
      {media?.badge && (
        <div
          className="absolute top-4 left-4 px-3 py-1.5 text-[10px] font-semibold uppercase"
          style={{ background: 'var(--bg-secondary)', color: 'var(--accent-blue)', letterSpacing: '0.2em' }}
        >
          {resolveLabel(media.badge, locale)}
        </div>
      )}
      {(media?.caption?.over || media?.caption?.title) && (
        <div
          className="absolute bottom-0 left-0 right-0 p-6"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.8), rgba(0,0,0,0))', color: '#fff' }}
        >
          {media.caption.over && (
            <div className="mb-1.5 text-[11px] uppercase opacity-80" style={{ letterSpacing: '0.2em' }}>
              {resolveLabel(media.caption.over, locale)}
            </div>
          )}
          {media.caption.title && (
            <div className="text-lg md:text-xl" style={{ fontFamily: 'var(--brand-font, inherit)' }}>
              {resolveLabel(media.caption.title, locale)}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null

  // signature：斜体 accent 签名（设计师资历/个人站常用，如 "— HXP"）
  const signatureNode = p.signature ? (
    <div
      className={`mt-8 italic text-xl md:text-2xl ${split ? '' : 'text-center'}`}
      style={{ fontFamily: 'var(--brand-font, inherit)', color: 'var(--accent-blue)' }}
    >
      {resolveLabel(p.signature, locale)}
    </div>
  ) : null

  const hasText = !!(p.eyebrow || p.title || p.intro || stats.length > 0 || cta || cta2)
  const textInner = (
    <div className={split ? '' : `text-center ${isHero ? 'mb-0' : 'mb-10'}`}>
      {p.eyebrow && (
        <div className="text-xs font-semibold tracking-widest uppercase text-t-accent-blue mb-2">{p.eyebrow}</div>
      )}
      {titleNode}
      {introNode}
      {statsNode}
      {ctasNode}
      {signatureNode}
    </div>
  )

  return (
    <section className={`${isHero ? 'pt-24 pb-20 md:pt-32 md:pb-28' : 'py-12'} px-4`} style={bg ? { background: bg } : undefined}>
      <div className="max-w-[var(--content-max-width)] mx-auto">
        {heading && <BlockHeading cfg={heading} locale={locale} />}
        {split ? (
          <div
            className="grid items-center gap-10 md:gap-16 md:grid-cols-[var(--split-cols)]"
            style={{ ['--split-cols' as any]: splitCols }}
          >
            {split.reverse ? (
              <>
                {mediaNode}
                {hasText ? textInner : null}
              </>
            ) : (
              <>
                {hasText ? textInner : null}
                {mediaNode}
              </>
            )}
          </div>
        ) : (
          <>
            {hasText ? textInner : null}
            {mediaNode}
          </>
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
        props={sec.props}
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
      heading={sec.heading}
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
  CustomBlock: (sec, ctx) => <CustomBlockSection block={sec.props || {}} ctx={ctx} heading={sec.heading} />,
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

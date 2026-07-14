'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { HeroCarousel, type HeroCtaButton } from '@/components/HeroCarousel'
import { ArticleCard } from '@/components/ArticleCard'
import { SearchBar } from '@/components/SearchBar'
import { ViewToggle } from '@/components/ViewToggle'
import { HomeBanner, type HomeBannerConfig } from '@/components/HomeBanner'
import { api } from '@/lib/api'
import { t } from '@/lib/i18n'
import { useLocaleStore } from '@/stores'
import { useStyleLayouts } from '@/components/StyleProvider'

interface HeroSlide { id: string; imageUrl: string; linkUrl: string; linkTarget: '_blank' | '_self' }
interface Article { id: number; title: string; slug: string; excerpt: string | null; coverImage: string | null; publishedAt: string; section: { name: string; path: string } }
interface SectionItem { id: number; name: string; slug: string; path: string; externalUrl: string | null }

function HeroSection({ slides, size, interval, ctaButtons, variant }: {
  slides: HeroSlide[]; size: string; interval: number; ctaButtons: HeroCtaButton[]; variant?: string
}) {
  // size 取自 siteSettings（p.size > heroSize 回退），variant 仅控制展示风格（如 split-image-right）
  const heroSize = size || 'standard'
  return (
    <HeroCarousel slides={slides} size={heroSize as any} interval={interval} ctaButtons={ctaButtons} />
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

function ArticleListSection({ articles, columns = 3, limit, showViewToggle = true }: {
  articles: Article[]; columns?: number; limit?: number; showViewToggle?: boolean
}) {
  const { locale } = useLocaleStore()
  const list = limit ? articles.slice(0, limit) : articles
  const colClass = columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'
  return (
    <section className="py-8 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-t-text-primary">{locale === 'en' ? 'Latest articles' : '最新文章'}</h2>
          <div className="flex items-center gap-4">
            <SearchBar />
            {showViewToggle && <ViewToggle />}
            <Link href="/articles" className="text-sm text-t-accent-blue hover:underline">{locale === 'en' ? 'View all →' : '查看全部 →'}</Link>
          </div>
        </div>
        <div className={`grid grid-cols-1 ${colClass} gap-6`}>
          {list.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      </div>
    </section>
  )
}

function CtaSection({ variant }: { variant?: string }) {
  const { locale } = useLocaleStore()
  return (
    <section className="py-10 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        <div className={`card-surface rounded-2xl p-10 text-center ${variant === 'banner' ? 'bg-gradient-accent' : ''}`}>
          <h2 className="text-2xl font-bold text-t-text-primary mb-4">{locale === 'en' ? 'Ready to start?' : '准备好了吗？'}</h2>
          <Link href="/blog" className="inline-flex items-center px-6 py-3 rounded-lg bg-t-accent-blue text-white font-medium hover:opacity-90 transition-opacity">
            {locale === 'en' ? 'Read the blog' : '阅读博客'}
          </Link>
        </div>
      </div>
    </section>
  )
}

export function HomeSections({
  heroSlides,
  heroSize,
  heroInterval,
  ctaButtons,
  recentArticles,
  homeBanner,
}: {
  heroSlides: HeroSlide[]
  heroSize: string
  heroInterval: number
  ctaButtons: HeroCtaButton[]
  recentArticles: Article[]
  homeBanner?: HomeBannerConfig
}) {
  const layouts = useStyleLayouts()
  const homepage = layouts?.homepage
  const sections = homepage?.sections as
    | { component: string; variant?: string; props?: any }[]
    | undefined

  // 无配置时回退到经典布局（保持向后兼容）
  if (!sections || sections.length === 0) {
    return (
      <>
        <HeroSection slides={heroSlides} size={heroSize} interval={heroInterval} ctaButtons={ctaButtons} />
        <ArticleListSection articles={recentArticles} />
      </>
    )
  }

  return (
    <>
      {sections.map((sec, i) => {
        const p = sec.props || {}
        switch (sec.component) {
          case 'Hero':
            return <HeroSection key={i} slides={heroSlides} size={p.size || heroSize} interval={heroInterval} ctaButtons={ctaButtons} variant={sec.variant} />
          case 'Features':
            return <FeaturesSection key={i} variant={sec.variant} />
          case 'ArticleList':
            return (
              <ArticleListSection
                key={i}
                articles={recentArticles}
                columns={p.columns || 3}
                limit={p.limit}
                showViewToggle={p.showViewToggle !== false}
              />
            )
          case 'CTA':
            return <CtaSection key={i} variant={sec.variant} />
          case 'Banner':
            return homeBanner?.enabled ? <HomeBanner key={i} config={homeBanner} /> : null
          default:
            return null
        }
      })}
    </>
  )
}

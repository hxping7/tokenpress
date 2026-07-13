import Link from 'next/link'
import { api } from '@/lib/api'
import { Suspense } from 'react'
import { HeroCarousel, type HeroCtaButton } from '@/components/HeroCarousel'
import { HomeBanner, type HomeBannerConfig, type HomeBannerType, type HomeBannerPosition } from '@/components/HomeBanner'
import { ArticleCard } from '@/components/ArticleCard'
import { t } from '@/lib/i18n'
import { ViewToggle } from '@/components/ViewToggle'
import { SearchBar } from '@/components/SearchBar'

interface HeroSlide {
  id: string
  imageUrl: string
  linkUrl: string
  linkTarget: '_blank' | '_self'
}

interface Article {
  id: number
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  publishedAt: string
  section: {
    name: string
    path: string
  }
}

interface HeroResult {
  slides: HeroSlide[]
  size: string
  interval: number
  ctaButtons: HeroCtaButton[]
}

// ISR: 每 60 秒重新生成
export const dynamic = 'force-dynamic'
export const revalidate = 60

async function getHeroSlides(): Promise<HeroResult> {
  try {
    // 服务器端：使用 BACKEND_URL（Docker内网）或默认地址
    // 客户端：使用空字符串（相对路径，走 nginx 代理）
    const baseUrl = typeof window === 'undefined' 
      ? `${process.env.BACKEND_URL || 'http://localhost:4001'}`
      : ''
    
    // 获取所有相关的设置项
    const settingsRes = await fetch(`${baseUrl}/api/v1/site-settings/keys/hero_slides,hero_effect,hero_size,hero_carousel_use_articles,hero_carousel_article_source,hero_carousel_max_items,hero_carousel_interval,hero_cta_buttons`, { next: { revalidate: 60 } })
    if (!settingsRes.ok) return { slides: [], size: 'default', interval: 5, ctaButtons: [] }
    
    const settingsJson = await settingsRes.json()
    const settings = settingsJson.data || {}
    
    const heroSize = settings.hero_size || 'default'
    const useArticles = settings.hero_carousel_use_articles === 'true'
    const interval = parseInt(settings.hero_carousel_interval) || 5

    // 解析可配置的 CTA 按钮
    let ctaButtons: HeroCtaButton[] = []
    if (settings.hero_cta_buttons) {
      try {
        const parsed = JSON.parse(settings.hero_cta_buttons)
        if (Array.isArray(parsed)) ctaButtons = parsed
      } catch {
        ctaButtons = []
      }
    }
    
      // 如果启用了文章轮播图，从API获取文章封面图
      if (useArticles) {
        const source = settings.hero_carousel_article_source || 'latest'
        const limit = parseInt(settings.hero_carousel_max_items) || 5
        
        const articlesRes = await fetch(`${baseUrl}/api/v1/carousel-articles?source=${source}&limit=${limit}`, { next: { revalidate: 60 } })
      if (!articlesRes.ok) return { slides: [], size: heroSize, interval, ctaButtons }
      
      const articlesJson = await articlesRes.json()
      const articles = articlesJson.data || []
      
      // 将文章数据转换为HeroSlide格式
      const slides: HeroSlide[] = articles.map((article: any) => ({
        id: `article-${article.id}`,
        imageUrl: article.coverImage,
        linkUrl: `${article.section?.path || '/blog'}/${article.slug}`,
        linkTarget: '_blank' as const,  // 在新窗口打开
      }))
      
      return { slides, size: heroSize, interval, ctaButtons }
    }
    
    // 否则，使用自定义的轮播图设置
    const heroSlidesValue = settings.hero_slides
    let slides: HeroSlide[] = []
    if (heroSlidesValue) {
      try {
        const parsedSlides = JSON.parse(heroSlidesValue)
        // 为每个 slide 添加默认的 linkTarget（如果没有设置）
        slides = parsedSlides.map((slide: any) => ({
          ...slide,
          linkTarget: slide.linkTarget || '_blank',  // 默认在新窗口打开
        }))
      } catch {
        slides = []
      }
    }
    
    return { slides, size: heroSize, interval, ctaButtons }
  } catch {
    return { slides: [], size: 'default', interval: 5, ctaButtons: [] }
  }
}

async function getHomeBanner(): Promise<HomeBannerConfig> {
  try {
    const baseUrl = typeof window === 'undefined'
      ? `${process.env.BACKEND_URL || 'http://localhost:4001'}`
      : ''
    const res = await fetch(
      `${baseUrl}/api/v1/site-settings/keys/home_banner_enabled,home_banner_type,home_banner_position,home_banner_cta,home_banner_cards,home_banner_image,home_banner_notice`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return { enabled: false, type: 'cta', position: 'after_hero' }
    const s = (await res.json()).data || {}
    const enabled = s.home_banner_enabled === 'true'
    const type = (s.home_banner_type as HomeBannerType) || 'cta'
    const position = (s.home_banner_position as HomeBannerPosition) || 'after_hero'
    let cta: HomeBannerConfig['cta']
    let cards: HomeBannerConfig['cards']
    let image: HomeBannerConfig['image']
    let notice: HomeBannerConfig['notice']
    if (s.home_banner_cta) try { cta = JSON.parse(s.home_banner_cta) } catch {}
    if (s.home_banner_cards) try { cards = JSON.parse(s.home_banner_cards) } catch {}
    if (s.home_banner_image) try { image = JSON.parse(s.home_banner_image) } catch {}
    if (s.home_banner_notice) try { notice = JSON.parse(s.home_banner_notice) } catch {}
    return { enabled, type, position, cta, cards, image, notice }
  } catch {
    return { enabled: false, type: 'cta', position: 'after_hero' }
  }
}

async function getRecentArticles(): Promise<Article[]> {
  try {
    const data = await api.get('/articles?limit=6&status=published')
    return data.data || []
  } catch {
    return []
  }
}

function HeroFallback() {
  return (
    <section className="relative pt-8 pb-4 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 grid-pattern" />
      <div className="relative z-10 text-center px-4 w-full max-w-3xl mx-auto">
        <div className="h-64 bg-t-bg-tertiary rounded-xl animate-pulse" />
      </div>
    </section>
  )
}

export default async function HomePage() {
  const [
    { slides: heroSlides, size: heroSize, interval: heroInterval, ctaButtons },
    homeBanner,
    recentArticles,
  ] = await Promise.all([
    getHeroSlides(),
    getHomeBanner(),
    getRecentArticles(),
  ])

  return (
    <>
      {/* Hero - 宣传页图片轮播或默认 SVG */}
      <Suspense fallback={<HeroFallback />}>
        <HeroCarousel
          slides={heroSlides}
          size={heroSize as 'default' | 'fullscreen' | 'wide'}
          interval={heroInterval}
          ctaButtons={ctaButtons}
        />
      </Suspense>

      {/* 中部 banner 区（位置：Hero 之后） */}
      {homeBanner.enabled && homeBanner.position === 'after_hero' && (
        <HomeBanner config={homeBanner} />
      )}

      {/* 搜索栏 */}
      <section className="py-4 px-4 border-b border-t-border">
        <div className="max-w-[var(--content-max-width)] mx-auto flex items-center justify-between gap-4">
          <div className="flex-1" />
          <SearchBar />
        </div>
      </section>

      {/* 最近发布 */}
      {recentArticles.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-[var(--content-max-width)] mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-t-text-primary">最新文章</h2>
              <div className="flex items-center gap-4">
                <ViewToggle />
                <Link
                  href="/articles"
                  className="text-sm text-t-accent-blue hover:underline"
                >
                  查看全部 →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 中部 banner 区（位置：文章列表之后） */}
      {homeBanner.enabled && homeBanner.position === 'after_articles' && (
        <HomeBanner config={homeBanner} />
      )}
    </>
  )
}

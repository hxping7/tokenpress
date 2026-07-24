import { api } from '@/lib/api'
import { HomeSections } from '@/components/HomeSections'
import { type HeroCtaButton } from '@/components/HeroCarousel'
import { HomeBanner, type HomeBannerConfig, type HomeBannerType, type HomeBannerPosition } from '@/components/HomeBanner'
import { WelcomeOverlay } from '@/components/WelcomeOverlay'

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

    const heroSize = settings.hero_size || 'standard'
    const useArticles = settings.hero_carousel_use_articles === 'true'
    const interval = parseInt(settings.hero_carousel_interval) || 5
    const maxItems = Math.min(10, Math.max(1, parseInt(settings.hero_carousel_max_items) || 5))

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

    // 手动添加的宣传图（hero_slides）：始终优先、始终包含
    let manualSlides: HeroSlide[] = []
    if (settings.hero_slides) {
      try {
        const parsedSlides = JSON.parse(settings.hero_slides)
        if (Array.isArray(parsedSlides)) {
          manualSlides = parsedSlides.map((slide: any) => ({
            ...slide,
            linkTarget: slide.linkTarget || '_blank',
          }))
        }
      } catch {
        manualSlides = []
      }
    }

    // 剩余名额用于文章封面图
    const remaining = Math.max(0, maxItems - manualSlides.length)

    let articleSlides: HeroSlide[] = []
    if (useArticles && remaining > 0) {
      const source = settings.hero_carousel_article_source || 'latest'
      const articlesRes = await fetch(`${baseUrl}/api/v1/carousel-articles?source=${source}&limit=${remaining}`, { next: { revalidate: 60 } })
      if (articlesRes.ok) {
        const articlesJson = await articlesRes.json()
        const articles = articlesJson.data || []
        // 将文章数据转换为 HeroSlide 格式（排在手动宣传图之后）
        articleSlides = articles.map((article: any) => ({
          id: `article-${article.id}`,
          imageUrl: article.coverImage,
          linkUrl: `${article.section?.path || '/blog'}/${article.slug}`,
          linkTarget: '_blank',
        }))
      }
    }

    // 手动宣传图在前，文章封面填补剩余名额，总数不超过 maxItems
    const slides = [...manualSlides, ...articleSlides].slice(0, maxItems)

    return { slides, size: heroSize, interval, ctaButtons }
  } catch {
    return { slides: [], size: 'default', interval: 5, ctaButtons: [] }
  }
}

async function getHomeBanners(): Promise<HomeBannerConfig[]> {
  try {
    const baseUrl = typeof window === 'undefined'
      ? `${process.env.BACKEND_URL || 'http://localhost:4001'}`
      : ''
    const res = await fetch(
      `${baseUrl}/api/v1/site-settings/keys/home_banners,home_banner_enabled,home_banner_type,home_banner_position,home_banner_cta,home_banner_cards,home_banner_image,home_banner_notice`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    const s = (await res.json()).data || {}
    // 新结构：home_banners 为 JSON 数组
    if (s.home_banners) {
      try {
        const arr = JSON.parse(s.home_banners)
        if (Array.isArray(arr)) {
          return arr.map((b: any, i: number) => ({ ...b, id: b.id || `banner-${i + 1}` }))
        }
      } catch {}
    }
    // 旧结构回退：单条 home_banner_* 字段
    const enabled = s.home_banner_enabled === 'true'
    if (!enabled) return []
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
    return [{ id: 'default', enabled, type, position, cta, cards, image, notice }]
  } catch {
    return []
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

async function getWelcomePage(): Promise<{ enabled: boolean; htmlPath: string }> {
  try {
    const baseUrl = typeof window === 'undefined'
      ? `${process.env.BACKEND_URL || 'http://localhost:4001'}`
      : ''
    const res = await fetch(
      `${baseUrl}/api/v1/site-settings/keys/welcome_page_enabled,welcome_page_html`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return { enabled: false, htmlPath: '' }
    const s = (await res.json()).data || {}
    const enabled = s.welcome_page_enabled === 'true'
    const htmlPath = s.welcome_page_html || ''
    return { enabled, htmlPath }
  } catch {
    return { enabled: false, htmlPath: '' }
  }
}

function HeroFallback() {
  return (
    <section className="relative pt-8 pb-4 flex items-center justify-center overflow-hidden">
      <div className="relative z-10 text-center px-4 w-full max-w-3xl mx-auto">
        <div className="h-64 bg-t-bg-tertiary rounded-xl animate-pulse" />
      </div>
    </section>
  )
}

export default async function HomePage() {
  const [
    { slides: heroSlides, size: heroSize, interval: heroInterval, ctaButtons },
    homeBanners,
    recentArticles,
    welcomePage,
  ] = await Promise.all([
    getHeroSlides(),
    getHomeBanners(),
    getRecentArticles(),
    getWelcomePage(),
  ])

  return (
    <>
      <WelcomeOverlay enabled={welcomePage.enabled} htmlPath={welcomePage.htmlPath} />
      <HomeSections
        heroSlides={heroSlides}
        heroSize={heroSize}
        heroInterval={heroInterval}
        ctaButtons={ctaButtons}
        recentArticles={recentArticles}
        homeBanners={homeBanners}
      />
    </>
  )
}

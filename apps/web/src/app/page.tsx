import Link from 'next/link'
import { api } from '@/lib/api'
import { Suspense } from 'react'
import { HeroCarousel } from '@/components/HeroCarousel'
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

// ISR: 每 60 秒重新生成
export const dynamic = 'force-dynamic'
export const revalidate = 60

async function getHeroSlides(): Promise<{ slides: HeroSlide[]; size: string }> {
  try {
    // 服务器端：使用 BACKEND_URL（Docker内网）或默认地址
    // 客户端：使用空字符串（相对路径，走 nginx 代理）
    const baseUrl = typeof window === 'undefined' 
      ? `${process.env.BACKEND_URL || 'http://localhost:4001'}`
      : ''
    
    // 获取所有相关的设置项
    const settingsRes = await fetch(`${baseUrl}/api/v1/site-settings/keys/hero_slides,hero_effect,hero_size,hero_carousel_use_articles,hero_carousel_article_source,hero_carousel_max_items`, { next: { revalidate: 60 } })
    if (!settingsRes.ok) return { slides: [], size: 'default' }
    
    const settingsJson = await settingsRes.json()
    const settings = settingsJson.data || {}
    
    const heroSize = settings.hero_size || 'default'
    const useArticles = settings.hero_carousel_use_articles === 'true'
    
      // 如果启用了文章轮播图，从API获取文章封面图
      if (useArticles) {
        const source = settings.hero_carousel_article_source || 'latest'
        const limit = parseInt(settings.hero_carousel_max_items) || 5
        
        const articlesRes = await fetch(`${baseUrl}/api/v1/carousel-articles?source=${source}&limit=${limit}`, { next: { revalidate: 60 } })
      if (!articlesRes.ok) return { slides: [], size: heroSize }
      
      const articlesJson = await articlesRes.json()
      const articles = articlesJson.data || []
      
      // 将文章数据转换为HeroSlide格式
      const slides: HeroSlide[] = articles.map((article: any) => ({
        id: `article-${article.id}`,
        imageUrl: article.coverImage,
        linkUrl: `${article.section?.path || '/blog'}/${article.slug}`,
        linkTarget: '_self' as const,
      }))
      
      return { slides, size: heroSize }
    }
    
    // 否则，使用自定义的轮播图设置
    const heroSlidesValue = settings.hero_slides
    let slides: HeroSlide[] = []
    if (heroSlidesValue) {
      try {
        slides = JSON.parse(heroSlidesValue)
      } catch {
        slides = []
      }
    }
    
    return { slides, size: heroSize }
  } catch {
    return { slides: [], size: 'default' }
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
  const [{ slides: heroSlides, size: heroSize }, recentArticles] = await Promise.all([
    getHeroSlides(),
    getRecentArticles(),
  ])

  return (
    <>
      {/* Hero - 宣传页图片轮播或默认 SVG */}
      <Suspense fallback={<HeroFallback />}>
        <HeroCarousel slides={heroSlides} size={heroSize as 'default' | 'fullscreen' | 'wide'} />
      </Suspense>

      {/* 搜索栏 */}
      <section className="py-4 px-4 border-b border-t-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex-1" />
          <SearchBar />
        </div>
      </section>

      {/* 最近发布 */}
      {recentArticles.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-t-text-primary">最新文章</h2>
              <div className="flex items-center gap-4">
                <ViewToggle />
                <Link
                  href="/blog"
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
    </>
  )
}

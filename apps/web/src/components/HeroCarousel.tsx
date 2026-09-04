'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocaleStore } from '@/stores'

interface HeroSlide {
  id: string
  imageUrl: string
  linkUrl: string
  linkTarget: '_blank' | '_self'
}

export type HeroCtaVariant = 'primary' | 'secondary' | 'ghost'

export interface HeroCtaButton {
  label: string
  href: string
  target?: '_blank' | '_self'
  variant?: HeroCtaVariant
}

export const DEFAULT_HERO_CTA: HeroCtaButton[] = [
  { label: 'Token 套餐', href: '/token-plan', target: '_self', variant: 'primary' },
  { label: '查看 AI 作品', href: '/ai-works', target: '_self', variant: 'secondary' },
]

interface HeroCarouselProps {
  slides: HeroSlide[]
  size?: 'standard' | 'wide' | 'ultrawide' | 'full' | 'default' | 'fullscreen'
  interval?: number // 切换间隔，单位：秒，默认5秒
  ctaButtons?: HeroCtaButton[] // 可后台配置的 CTA 按钮，未配置时回退到默认值
  autoplay?: boolean // 自动轮播开关（默认 true）；false 时仅手动切换
  showCTA?: boolean // CTA 按钮区开关（默认 true）
}

// 轮播尺寸 → 容器最大宽度 / 圆角 / 比例 / 图片 sizes。
// 与后台「全局宽屏设置」(WIDTH_PRESETS) 四档一一对应：标准1280 / 宽屏1536 / 超宽1920 / 全宽(100%)。
// 同时兼容历史存储值 default（=标准）、fullscreen（=全宽）。
const HERO_SIZE_STYLES: Record<string, { container: string; inner: string; aspect: string; imgSizes: string }> = {
  standard: { container: 'max-w-[1280px] mx-auto', inner: 'rounded-2xl', aspect: 'aspect-[16/9] md:aspect-[21/9]', imgSizes: '(max-width: 768px) 100vw, 1280px' },
  wide: { container: 'max-w-[1536px] mx-auto', inner: 'rounded-2xl', aspect: 'aspect-[16/9] md:aspect-[21/9]', imgSizes: '(max-width: 768px) 100vw, 1536px' },
  ultrawide: { container: 'max-w-[1920px] mx-auto', inner: 'rounded-2xl', aspect: 'aspect-[16/9] md:aspect-[21/9]', imgSizes: '(max-width: 768px) 100vw, 1920px' },
  full: { container: 'w-full', inner: '', aspect: 'aspect-[2/1]', imgSizes: '100vw' },
  // 历史值兼容
  default: { container: 'max-w-[1280px] mx-auto', inner: 'rounded-2xl', aspect: 'aspect-[16/9] md:aspect-[21/9]', imgSizes: '(max-width: 768px) 100vw, 1280px' },
  fullscreen: { container: 'w-full', inner: '', aspect: 'aspect-[2/1]', imgSizes: '100vw' },
}

// CTA 按钮：实色令牌化（去 AI 风渐变/发光），圆角随 --btn-radius
const CTA_VARIANT_CLASS: Record<HeroCtaVariant, string> = {
  primary: 'btn-pack-primary px-6 py-3 text-sm',
  secondary: 'px-6 py-3 border border-t-border text-t-text-primary font-medium text-sm hover:border-t-accent-blue/50 transition-all [border-radius:var(--btn-radius)]',
  ghost: 'px-6 py-3 text-t-text-secondary font-medium text-sm hover:text-t-text-primary hover:bg-t-hover transition-all [border-radius:var(--btn-radius)]',
}

// 需要硬跳转（非 Next.js 客户端路由）的链接：静态页面、上传资源、外链
function isHardLink(url: string): boolean {
  return (
    url.startsWith('/statichtml') ||
    url.startsWith('/uploads') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('//')
  )
}

export function HeroCarousel({ slides, size = 'default', interval = 5, ctaButtons, autoplay = true, showCTA = true }: HeroCarouselProps) {
  const { locale } = useLocaleStore()
  // 归一化 CTA：兼容编辑器/风格包写入的 {label:{zh,en}, style:'outline'} 形状（样式包 schema），
  // 也兼容原有 {label:string, variant:'secondary'}；label 对象按当前语言解析，style 映射到渲染形态。
  const rawCtaList: any[] = ctaButtons && ctaButtons.length > 0 ? ctaButtons : DEFAULT_HERO_CTA
  const ctaList: HeroCtaButton[] = rawCtaList.map((b) => {
    const lbl = b?.label
    const label =
      typeof lbl === 'string'
        ? lbl
        : lbl && typeof lbl === 'object'
          ? locale === 'en'
            ? lbl.en || lbl.zh || ''
            : lbl.zh || lbl.en || ''
          : ''
    const s: string = b?.style
    const variant: HeroCtaVariant =
      b?.variant === 'primary' || b?.variant === 'secondary' || b?.variant === 'ghost'
        ? b.variant
        : s === 'outline'
          ? 'secondary'
          : s === 'ghost'
            ? 'ghost'
            : 'primary'
    return { label, href: b?.href || '#', target: b?.target, variant }
  })
  const resolved = HERO_SIZE_STYLES[size] || HERO_SIZE_STYLES.standard
  const isFull = size === 'full' || size === 'fullscreen'
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % Math.max(slides.length, 1))
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % Math.max(slides.length, 1))
  }, [slides.length])

  // 自动播放（autoplay=false 时不启动定时器，仅手动切换）
  useEffect(() => {
    if (!autoplay || slides.length <= 1 || isPaused) return

    const timer = setInterval(nextSlide, interval * 1000)
    return () => clearInterval(timer)
  }, [autoplay, slides.length, isPaused, nextSlide, interval])

  // 使用默认 SVG
  const useDefaultSvg = slides.length === 0 || !slides[0]?.imageUrl

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden ${
        isFull ? 'pt-16' : 'pt-20 pb-4'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`relative z-10 text-center w-full ${isFull ? 'px-0' : 'px-4'} ${resolved.container}`}>
        {useDefaultSvg ? (
          // 默认 SVG Logo
          <DefaultHeroSvg />
        ) : (
          // 轮播图
          <div className={`relative overflow-hidden bg-t-bg-secondary ${isFull ? '' : 'border border-t-border'} ${resolved.inner}`}>
            {/* Slides */}
            <div className={`relative ${resolved.aspect}`}>
              {slides.map((slide, index) => {
                const isActive = index === currentSlide
                const isSvg = slide.imageUrl?.toLowerCase().endsWith('.svg')
                const slideHref = slide.linkUrl || '#'
                const slideHard = isHardLink(slideHref)
                const linkTarget = slide.linkTarget === '_blank' ? '_blank' : '_self'

                const linkInner = (
                  <Image
                    src={slide.imageUrl}
                    alt={`轮播图 ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    sizes={resolved.imgSizes}
                    unoptimized
                  />
                )

                return slideHard ? (
                  <a
                    key={slide.id}
                    href={slideHref}
                    target={linkTarget}
                    rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    onClick={(e) => {
                      if (!slide.linkUrl) e.preventDefault()
                    }}
                  >
                    {linkInner}
                  </a>
                ) : (
                  <Link
                    key={slide.id}
                    href={slideHref}
                    target={linkTarget}
                    rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    onClick={(e) => {
                      if (!slide.linkUrl) e.preventDefault()
                    }}
                  >
                    {linkInner}
                  </Link>
                )
              })}
            </div>

            {/* 导航按钮 */}
            {slides.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.preventDefault(); prevSlide() }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                  aria-label="上一张"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); nextSlide() }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                  aria-label="下一张"
                >
                  <ChevronRight size={20} />
                </button>

                {/* 指示器 */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => { e.preventDefault(); setCurrentSlide(index) }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentSlide
                          ? 'bg-t-accent-blue w-6'
                          : 'bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`跳转到第 ${index + 1} 张`}
                    />
                  ))}
                </div>

                {/* 进度条 */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div
                    className="h-full bg-t-accent-blue transition-all duration-500"
                    style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* CTA 按钮 */}
        {showCTA && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          {ctaList.map((cta, idx) => {
            const variant = cta.variant || 'secondary'
            const target = cta.target || '_self'
            const ctaHref = cta.href || '#'
            const ctaHard = isHardLink(ctaHref)
            const ctaInner = cta.label
            return ctaHard ? (
              <a
                key={`${cta.href}-${idx}`}
                href={ctaHref}
                className={CTA_VARIANT_CLASS[variant]}
                target={target === '_blank' ? '_blank' : undefined}
                rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!cta.href) e.preventDefault()
                }}
              >
                {ctaInner}
              </a>
            ) : (
              <Link
                key={`${cta.href}-${idx}`}
                href={ctaHref}
                className={CTA_VARIANT_CLASS[variant]}
                target={target === '_blank' ? '_blank' : undefined}
                rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!cta.href) e.preventDefault()
                }}
              >
                {ctaInner}
              </Link>
            )
          })}
        </div>
        )}
      </div>
    </section>
  )
}

// 默认 Hero SVG 组件（令牌化配色，去霓虹渐变/发光，随风格包主题变化）
function DefaultHeroSvg() {
  return (
    <svg
      viewBox="0 0 560 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Token 文字 */}
      <text
        x="280" y="158"
        textAnchor="middle"
        fontFamily="var(--font-inter), 'Segoe UI', Arial, sans-serif"
        fontSize="88"
        fontWeight="800"
        letterSpacing="-2"
        fill="var(--text-primary)"
      >
        Token
      </text>

      {/* ∞ 符号（accent 单色） */}
      <g transform="translate(280, 208)">
        <path
          d="M 68 0 C 68 -34, 26 -34, 0 0 C -26 34, -68 34, -68 0 C -68 -34, -26 -34, 0 0 C 26 34, 68 34, 68 0 Z"
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>

      {/* 域名 */}
      <text
        x="280" y="296"
        textAnchor="middle"
        fontFamily="var(--font-inter), Arial, sans-serif"
        fontSize="13"
        fontWeight="400"
        letterSpacing="8"
        fill="var(--text-muted)"
      >
        TOKEN00.COM
      </text>
    </svg>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface HeroSlide {
  id: string
  imageUrl: string
  linkUrl: string
  linkTarget: '_blank' | '_self'
}

interface HeroCarouselProps {
  slides: HeroSlide[]
  size?: 'default' | 'fullscreen' | 'wide'
  interval?: number // 切换间隔，单位：秒，默认5秒
}

export function HeroCarousel({ slides, size = 'default', interval = 5 }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % Math.max(slides.length, 1))
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % Math.max(slides.length, 1))
  }, [slides.length])

  // 自动播放
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return

    const timer = setInterval(nextSlide, interval * 1000)
    return () => clearInterval(timer)
  }, [slides.length, isPaused, nextSlide, interval])

  // 使用默认 SVG
  const useDefaultSvg = slides.length === 0 || !slides[0]?.imageUrl

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden ${
        size === 'fullscreen' ? 'pt-14' : 'pt-20 pb-4'
      }`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background grid pattern */}
      <div className="absolute inset-0 grid-pattern" />

      <div className={`relative z-10 text-center px-4 w-full ${
        size === 'fullscreen' ? '' : size === 'wide' ? 'max-w-6xl mx-auto' : 'max-w-3xl mx-auto'
      }`}>
        {useDefaultSvg ? (
          // 默认 SVG Logo
          <DefaultHeroSvg />
        ) : (
          // 轮播图
          <div className={`relative overflow-hidden border border-t-border bg-t-bg-secondary ${
            size === 'fullscreen' ? '' : 'rounded-2xl'
          }`}>
            {/* Slides */}
            <div className={`relative ${
              size === 'fullscreen'
                ? 'aspect-[2/1]'
                : size === 'wide'
                  ? 'aspect-[16/9] md:aspect-[21/9]'
                  : 'aspect-[16/9] md:aspect-[21/9]'
            }`}>
              {slides.map((slide, index) => {
                const isActive = index === currentSlide
                const isSvg = slide.imageUrl?.toLowerCase().endsWith('.svg')

                return (
                  <Link
                    key={slide.id}
                    href={slide.linkUrl || '#'}
                    target={slide.linkTarget === '_blank' ? '_blank' : '_self'}
                    rel={slide.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    onClick={(e) => {
                      if (!slide.linkUrl) e.preventDefault()
                    }}
                  >
                    <Image
                      src={slide.imageUrl}
                      alt={`轮播图 ${index + 1}`}
                      fill
                      className="object-cover"
                      priority={index === 0}
                      sizes={size === 'fullscreen' ? '100vw' : '(max-width: 768px) 100vw, 800px'}
                      unoptimized
                    />
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
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <Link
            href="/token-plan"
            className="btn-glow px-6 py-3 bg-gradient-accent text-white font-medium rounded-xl text-sm transition-transform hover:scale-105"
          >
            探索 Token 计划
          </Link>
          <Link
            href="/ai-works"
            className="px-6 py-3 border border-t-border text-t-text-primary font-medium rounded-xl text-sm hover:border-t-accent-blue/30 transition-all"
          >
            查看 AI 作品
          </Link>
        </div>
      </div>
    </section>
  )
}

// 默认 Hero SVG 组件
function DefaultHeroSvg() {
  return (
    <svg
      viewBox="0 0 560 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient id="heroRingGrad" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0" />
          <stop offset="25%" stopColor="#00d4ff" />
          <stop offset="75%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="heroTextGrad" x1="80" y1="0" x2="480" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60c0ff" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b088ff" />
        </linearGradient>
        <linearGradient id="heroInfGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
        <filter id="heroTextGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="heroInfGlow">
          <feGaussianBlur stdDeviation="7" result="blur1" />
          <feGaussianBlur stdDeviation="3" result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 轨道椭圆 */}
      <ellipse cx="280" cy="155" rx="248" ry="110" fill="none" stroke="url(#heroRingGrad)" strokeWidth="0.8" opacity="0.4" />
      <ellipse cx="280" cy="155" rx="228" ry="95" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="1.2" />
      <ellipse cx="280" cy="155" rx="208" ry="80" fill="none" stroke="rgba(124,58,237,0.05)" strokeWidth="0.8" />

      {/* 扫描线 */}
      <line x1="10" y1="155" x2="80" y2="155" stroke="#00d4ff" strokeWidth="0.8" opacity="0.5" />
      <line x1="480" y1="155" x2="550" y2="155" stroke="#7c3aed" strokeWidth="0.8" opacity="0.5" />
      <circle cx="10" cy="155" r="3.5" fill="#00d4ff" opacity="0.7" />
      <circle cx="550" cy="155" r="3.5" fill="#7c3aed" opacity="0.7" />

      {/* Token 文字 */}
      <text
        x="280" y="148"
        textAnchor="middle"
        fontFamily="var(--font-inter), 'Segoe UI', Arial, sans-serif"
        fontSize="88"
        fontWeight="800"
        letterSpacing="-2"
        fill="url(#heroTextGrad)"
        filter="url(#heroTextGlow)"
      >
        Token
      </text>

      {/* ∞ 符号 */}
      <g transform="translate(280, 202)" filter="url(#heroInfGlow)">
        <path
          d="M 68 0 C 68 -34, 26 -34, 0 0 C -26 34, -68 34, -68 0 C -68 -34, -26 -34, 0 0 C 26 34, 68 34, 68 0 Z"
          fill="none"
          stroke="url(#heroInfGrad)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx="-68" cy="0" r="5" fill="#00d4ff" opacity="0.9" />
        <circle cx="68" cy="0" r="5" fill="#7c3aed" opacity="0.9" />
      </g>

      {/* 域名 */}
      <text
        x="280" y="296"
        textAnchor="middle"
        fontFamily="var(--font-inter), Arial, sans-serif"
        fontSize="13"
        fontWeight="400"
        letterSpacing="8"
        fill="#1a4060"
        opacity="0.9"
      >
        TOKEN00.COM
      </text>
    </svg>
  )
}

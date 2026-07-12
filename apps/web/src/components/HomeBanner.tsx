'use client'

import Link from 'next/link'
import Image from 'next/image'

export type HomeBannerType = 'cta' | 'cards' | 'image' | 'notice'
export type HomeBannerPosition = 'after_hero' | 'after_articles'

export interface HomeBannerCta {
  title: string
  subtitle?: string
  buttonText: string
  buttonLink: string
  buttonTarget?: '_blank' | '_self'
  bgImage?: string
  gradient?: string // CSS 渐变字符串，如 linear-gradient(135deg,#0ea5e9,#7c3aed)
  align?: 'left' | 'center'
}

export interface HomeBannerCard {
  icon?: string
  title: string
  desc?: string
  link: string
  target?: '_blank' | '_self'
}

export interface HomeBannerImage {
  url: string
  link?: string
  target?: '_blank' | '_self'
  alt?: string
}

export interface HomeBannerNotice {
  text: string
  link?: string
  target?: '_blank' | '_self'
  marquee?: boolean
}

export interface HomeBannerConfig {
  enabled: boolean
  type: HomeBannerType
  position: HomeBannerPosition
  cta?: HomeBannerCta
  cards?: HomeBannerCard[]
  image?: HomeBannerImage
  notice?: HomeBannerNotice
}

interface HomeBannerProps {
  config: HomeBannerConfig
}

// 默认渐变（未选择背景图且未选渐变时使用）
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0ea5e9 140%)'

function targetProps(target?: '_blank' | '_self') {
  if (target === '_blank') return { target: '_blank' as const, rel: 'noopener noreferrer' as const }
  return {}
}

export function HomeBanner({ config }: HomeBannerProps) {
  if (!config.enabled) return null

  switch (config.type) {
    case 'cta':
      return <CtaBanner data={config.cta} />
    case 'cards':
      return <CardsBanner data={config.cards} />
    case 'image':
      return <ImageBanner data={config.image} />
    case 'notice':
      return <NoticeBanner data={config.notice} />
    default:
      return null
  }
}

function CtaBanner({ data }: { data?: HomeBannerCta }) {
  if (!data || !data.title) return null
  const align = data.align || 'center'
  const isCenter = align === 'center'
  const bgStyle: React.CSSProperties = data.bgImage
    ? { backgroundImage: `url("${data.bgImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: data.gradient || DEFAULT_GRADIENT }

  return (
    <section className="py-6 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        <div
          className={`relative overflow-hidden rounded-2xl border border-t-border px-6 py-10 md:px-12 md:py-14 ${
            isCenter ? 'text-center' : 'text-left'
          }`}
          style={bgStyle}
        >
          {data.bgImage && <div className="absolute inset-0 bg-black/40" />}
          <div className={`relative z-10 ${isCenter ? 'flex flex-col items-center' : 'flex flex-col items-start'}`}>
            <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-sm">{data.title}</h3>
            {data.subtitle && (
              <p className="mt-3 text-sm md:text-base text-white/80 max-w-2xl">{data.subtitle}</p>
            )}
            {data.buttonText && (
              <Link
                href={data.buttonLink || '#'}
                className="btn-glow mt-6 px-6 py-3 bg-gradient-accent text-white font-medium rounded-xl text-sm transition-transform hover:scale-105"
                {...targetProps(data.buttonTarget)}
                onClick={(e) => { if (!data.buttonLink) e.preventDefault() }}
              >
                {data.buttonText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CardsBanner({ data }: { data?: HomeBannerCard[] }) {
  if (!data || data.length === 0) return null
  return (
    <section className="py-6 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.map((card, idx) => (
          <Link
            key={`${card.link}-${idx}`}
            href={card.link || '#'}
            className="group block p-5 rounded-2xl border border-t-border bg-t-bg-primary hover:border-t-accent-blue/40 transition-all"
            {...targetProps(card.target)}
            onClick={(e) => { if (!card.link) e.preventDefault() }}
          >
            {card.icon && (
              <div className="w-10 h-10 rounded-xl bg-t-bg-secondary flex items-center justify-center text-xl mb-3">
                {card.icon}
              </div>
            )}
            <h4 className="font-semibold text-t-text-primary group-hover:text-t-accent-blue transition-colors">
              {card.title}
            </h4>
            {card.desc && <p className="mt-1.5 text-sm text-t-text-secondary">{card.desc}</p>}
          </Link>
        ))}
      </div>
    </section>
  )
}

function ImageBanner({ data }: { data?: HomeBannerImage }) {
  if (!data || !data.url) return null
  const inner = (
    <span className="relative block w-full overflow-hidden rounded-2xl border border-t-border" style={{ aspectRatio: '21 / 9' }}>
      <Image
        src={data.url}
        alt={data.alt || ''}
        fill
        className="object-cover"
        unoptimized
        sizes="100vw"
      />
    </span>
  )
  if (data.link) {
    return (
      <section className="py-6 px-4">
        <div className="max-w-[var(--content-max-width)] mx-auto">
          <Link href={data.link} {...targetProps(data.target)} onClick={(e) => { if (!data.link) e.preventDefault() }}>
            {inner}
          </Link>
        </div>
      </section>
    )
  }
  return (
    <section className="py-6 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">{inner}</div>
    </section>
  )
}

function NoticeBanner({ data }: { data?: HomeBannerNotice }) {
  if (!data || !data.text) return null
  const content = (
    <span className="text-sm text-t-text-primary">
      {data.text}
      {data.link && <span className="ml-2 text-t-accent-blue underline">→</span>}
    </span>
  )
  const body = data.marquee ? (
    <div className="overflow-hidden whitespace-nowrap">
      <div className="inline-block animate-[marquee_20s_linear_infinite]">{content}</div>
    </div>
  ) : (
    <div className="flex items-center justify-center">{content}</div>
  )
  return (
    <section className="py-2 px-4">
      <div className="max-w-[var(--content-max-width)] mx-auto">
        {data.link ? (
          <Link
            href={data.link}
            className="block px-4 py-2.5 rounded-xl bg-t-bg-secondary border border-t-border hover:border-t-accent-blue/40 transition-all"
            {...targetProps(data.target)}
            onClick={(e) => { if (!data.link) e.preventDefault() }}
          >
            {body}
          </Link>
        ) : (
          <div className="block px-4 py-2.5 rounded-xl bg-t-bg-secondary border border-t-border">{body}</div>
        )}
      </div>
    </section>
  )
}

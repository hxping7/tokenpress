'use client'

import { useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSiteSettings } from '@/lib/useSiteSettings'

export function Logo({
  size = 'normal',
  asLink = true,
  height: heightProp,
}: {
  size?: 'small' | 'normal' | 'large'
  asLink?: boolean
  height?: number
}) {
  const widthClass = {
    small: 'w-20 sm:w-28', // 80 / 112
    normal: 'w-28 sm:w-40', // 112 / 160
    large: 'w-40 sm:w-64', // 160 / 256
  }[size]

  // Fetch custom logo from settings（与全站设置共用去重后的单一请求）
  const { data: settingsData } = useSiteSettings()

  const customLogo = settingsData?.data?.header_logo
  const heightMap = { small: 28, normal: 36, large: 56 }
  const logoHeight = heightProp ?? heightMap[size]

  // 默认 logo（开源仓库名 TokenPress）渲染为内联 SVG，文字/描边取主题 CSS 变量，
  // 随明暗主题与各配色皮肤（含风格包自定义 themeVariants）自动适应，无需改源码。
  // 用户经后台 header_logo 上传的专属 logo 优先级最高，仍按原图固定显示。
  const gradientId = useId().replace(/:/g, '')
  const DefaultMark = (
    <svg
      viewBox="0 0 390 72"
      role="img"
      aria-label="TokenPress"
      className="h-full w-auto"
      style={{ height: logoHeight, width: 'auto' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`tp-grad-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" style={{ stopColor: 'var(--gradient-from, var(--accent-blue, #00d4ff))' }} />
          <stop offset="55%" style={{ stopColor: 'var(--gradient-via, var(--accent-blue, #00d4ff))' }} />
          <stop offset="100%" style={{ stopColor: 'var(--gradient-to, var(--accent-purple, #7c3aed))' }} />
        </linearGradient>
      </defs>
      <text
        x="6"
        y="52"
        fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
        fontSize="48"
        fontWeight="700"
        letterSpacing="-1"
        fill={`url(#tp-grad-${gradientId})`}
      >
        TokenPress
      </text>
      <line
        x1="6"
        y1="62"
        x2="384"
        y2="62"
        stroke="var(--accent-blue, #00d4ff)"
        strokeWidth="0.5"
        opacity="0.3"
      />
    </svg>
  )

  let inner: React.ReactNode
  if (customLogo) {
    inner = (
      <Image
        src={customLogo}
        alt="Logo"
        width={200}
        height={logoHeight}
        unoptimized
        className="h-full w-auto object-contain"
        style={{ height: '100%', width: 'auto' }}
      />
    )
  } else {
    inner = DefaultMark
  }

  // asLink=false：仅返回品牌标视觉，外层链接由调用方提供（避免嵌套 <Link>）
  if (!asLink) {
    if (customLogo) {
      return <span className="flex items-center relative" style={{ height: logoHeight }}>{inner}</span>
    }
    return <span className={`flex items-center ${widthClass}`}>{inner}</span>
  }

  return (
    <Link
      href="/"
      className={customLogo ? 'flex items-center relative' : `flex items-center ${widthClass}`}
      style={customLogo ? { height: logoHeight } : undefined}
    >
      {inner}
    </Link>
  )
}

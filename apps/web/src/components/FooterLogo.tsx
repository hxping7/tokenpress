'use client'

import { useId } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSiteSettings } from '@/lib/useSiteSettings'

export function FooterLogo() {
  // Fetch custom footer logo from settings（与全站设置共用去重后的单一请求）
  const { data: settingsData } = useSiteSettings()
  const uid = useId().replace(/:/g, '')

  const customLogo = settingsData?.data?.footer_logo

  // If custom logo URL is set, use it（用户专属 logo 优先级最高，固定显示）
  if (customLogo) {
    return (
      <Link href="/" className="flex items-center gap-3 h-9 relative">
        <Image
          src={customLogo}
          alt="Logo"
          width={200}
          height={36}
          unoptimized
          className="h-full w-auto object-contain"
          style={{ height: '100%', width: 'auto' }}
        />
      </Link>
    )
  }

  // 默认页脚 logo（开源仓库名 TokenPress）：内联 SVG，配色取自主题 CSS 变量，
  // 随明暗主题与风格包配色（含自定义 themeVariants）自动适应。
  const hexBorder = `fHexBorder-${uid}`
  const infGrad = `fInfGrad-${uid}`
  const textGrad = `fTextGrad-${uid}`

  return (
    <Link href="/" className="flex items-center gap-3">
      <svg
        viewBox="0 0 480 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-32 h-auto"
      >
        <defs>
          <linearGradient id={hexBorder} x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" style={{ stopColor: 'var(--accent-blue, #00d4ff)' }} />
            <stop offset="50%" style={{ stopColor: 'var(--accent-purple, #7c3aed)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent-blue, #00d4ff)' }} />
          </linearGradient>
          <linearGradient id={infGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--gradient-from, var(--accent-blue, #00d4ff))' }} />
            <stop offset="50%" style={{ stopColor: 'var(--gradient-to, var(--accent-purple, #7c3aed))' }} />
            <stop offset="100%" style={{ stopColor: 'var(--gradient-from, var(--accent-blue, #00d4ff))' }} />
          </linearGradient>
          <linearGradient id={textGrad} x1="160" y1="0" x2="480" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" style={{ stopColor: 'var(--gradient-from, var(--accent-blue, #00d4ff))' }} />
            <stop offset="100%" style={{ stopColor: 'var(--gradient-to, var(--accent-purple, #7c3aed))' }} />
          </linearGradient>
          <filter id={`fHexGlow-${uid}`}>
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`fTextGlow-${uid}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* 六边形图标（填充随主题底色，描边随强调色） */}
        <polygon
          points="70,8 121,38 121,102 70,132 19,102 19,38"
          fill="var(--bg-tertiary, #111d32)"
          stroke={`url(#${hexBorder})`}
          strokeWidth="2.5"
        />
        <polygon
          points="70,16 113,42 113,98 70,124 27,98 27,42"
          fill="none"
          stroke="var(--accent-blue, #00d4ff)"
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />
        <g transform="translate(70,70)" filter={`url(#fHexGlow-${uid})`}>
          <path
            d="M 34 0 C 34 -18, 13 -18, 0 0 C -13 18, -34 18, -34 0 C -34 -18, -13 -18, 0 0 C 13 18, 34 18, 34 0 Z"
            fill="none"
            stroke={`url(#${infGrad})`}
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="3.5" fill="rgba(255,255,255,0.6)" />
        </g>
        <circle cx="70" cy="8" r="3" fill="var(--accent-blue, #00d4ff)" opacity="0.7" />
        <circle cx="121" cy="38" r="2.5" fill="var(--accent-purple, #7c3aed)" opacity="0.6" />
        <circle cx="121" cy="102" r="2.5" fill="var(--accent-blue, #00d4ff)" opacity="0.5" />

        {/* 文字 */}
        <text
          x="154" y="88"
          fontFamily="'Segoe UI', 'SF Pro Display', Arial, sans-serif"
          fontSize="64"
          fontWeight="700"
          letterSpacing="1"
          fill={`url(#${textGrad})`}
          filter={`url(#fTextGlow-${uid})`}
        >
          Token
        </text>
        <text
          x="158" y="114"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="14"
          fontWeight="400"
          letterSpacing="6"
          fill="var(--text-secondary, #7a8ba8)"
        >
          PRESS
        </text>
      </svg>
    </Link>
  )
}
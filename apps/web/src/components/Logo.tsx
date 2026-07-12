'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function Logo({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  const widthClass = {
    small: 'w-20 sm:w-28', // 80 / 112
    normal: 'w-28 sm:w-40', // 112 / 160
    large: 'w-40 sm:w-64', // 160 / 256
  }[size]

  // Fetch custom logo from settings
  const { data: settingsData } = useQuery({
    queryKey: ['site-settings', 'header_logo'],
    queryFn: () => api.get('/site-settings/keys/header_logo'),
    staleTime: 5 * 60 * 1000,
  })

  const customLogo = settingsData?.data?.header_logo

  // If custom logo URL is set, use it
  if (customLogo) {
    const heightMap = { small: 28, normal: 36, large: 56 }
    const logoHeight = heightMap[size]
    return (
      <Link href="/" className="flex items-center relative" style={{ height: logoHeight }}>
        <Image
          src={customLogo}
          alt="Logo"
          width={200}
          height={logoHeight}
          unoptimized
          className="h-full w-auto object-contain"
          style={{ height: '100%', width: 'auto' }}
        />
      </Link>
    )
  }

  return (
    <Link href="/" className={`flex items-center ${widthClass}`}>
      <svg
        viewBox="0 0 560 144"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
      >
        <defs>
          <linearGradient id="logoTextGrad" x1="16" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5ab8ff" />
            <stop offset="55%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="logoInfGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
          <filter id="logoGlow" x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="logoInfGlow" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="3" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Logo 内容整体右移 50px 以在 viewBox 中居中 */}
        <g transform="translate(50, 0)">
          {/* Token 文字 */}
          <text
            x="16" y="100"
            fontFamily="'Segoe UI', 'SF Pro Display', Arial, sans-serif"
            fontSize="92"
            fontWeight="700"
            letterSpacing="-2"
            fill="url(#logoTextGrad)"
            filter="url(#logoGlow)"
          >
            Token
          </text>

          {/* ∞ 符号 */}
          <g transform="translate(368, 72)" filter="url(#logoInfGlow)">
          <path
            d="M 70 0 C 70 -36, 28 -36, 0 0 C -28 36, -70 36, -70 0 C -70 -36, -28 -36, 0 0 C 28 36, 70 36, 70 0 Z"
            fill="none"
            stroke="url(#logoInfGrad)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 50 0 C 50 -24, 20 -24, 0 0 C -20 24, -50 24, -50 0 C -50 -24, -20 -24, 0 0 C 20 24, 50 24, 50 0 Z"
            fill="none"
            stroke="rgba(0,212,255,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="4" fill="rgba(255,255,255,0.5)" />
        </g>
        </g>
      </svg>
    </Link>
  )
}
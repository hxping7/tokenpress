'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function FooterLogo() {
  // Fetch custom footer logo from settings
  const { data: settingsData } = useQuery({
    queryKey: ['site-settings', 'footer_logo'],
    queryFn: () => api.get('/site-settings/keys/footer_logo'),
    staleTime: 5 * 60 * 1000,
  })

  const customLogo = settingsData?.data?.footer_logo

  // If custom logo URL is set, use it
  if (customLogo) {
    return (
      <Link href="/" className="flex items-center gap-3 h-9">
        <img src={customLogo} alt="Logo" className="h-full w-auto object-contain" />
      </Link>
    )
  }

  return (
    <Link href="/" className="flex items-center gap-3">
      <svg
        viewBox="0 0 480 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-32 h-auto"
      >
        <defs>
          <linearGradient id="fHexBg" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f2448" />
            <stop offset="100%" stopColor="#1a0840" />
          </linearGradient>
          <linearGradient id="fHexBorder" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
          <linearGradient id="fInfGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00ffea" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
          <linearGradient id="fTextGrad" x1="160" y1="0" x2="480" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e0f4ff" />
            <stop offset="100%" stopColor="#b0d8ff" />
          </linearGradient>
          <filter id="fHexGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fTextGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* 六边形图标 */}
        <polygon
          points="70,8 121,38 121,102 70,132 19,102 19,38"
          fill="url(#fHexBg)"
          stroke="url(#fHexBorder)"
          strokeWidth="2.5"
        />
        <polygon
          points="70,16 113,42 113,98 70,124 27,98 27,42"
          fill="none"
          stroke="rgba(0,212,255,0.1)"
          strokeWidth="1.5"
        />
        <g transform="translate(70,70)" filter="url(#fHexGlow)">
          <path
            d="M 34 0 C 34 -18, 13 -18, 0 0 C -13 18, -34 18, -34 0 C -34 -18, -13 -18, 0 0 C 13 18, 34 18, 34 0 Z"
            fill="none"
            stroke="url(#fInfGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="3.5" fill="rgba(255,255,255,0.6)" />
        </g>
        <circle cx="70" cy="8" r="3" fill="#00d4ff" opacity="0.7" />
        <circle cx="121" cy="38" r="2.5" fill="#7c3aed" opacity="0.6" />
        <circle cx="121" cy="102" r="2.5" fill="#00d4ff" opacity="0.5" />

        {/* 文字 */}
        <text
          x="154" y="88"
          fontFamily="'Segoe UI', 'SF Pro Display', Arial, sans-serif"
          fontSize="64"
          fontWeight="700"
          letterSpacing="1"
          fill="url(#fTextGrad)"
          filter="url(#fTextGlow)"
        >
          Token
        </text>
        <text
          x="158" y="114"
          fontFamily="'Segoe UI', Arial, sans-serif"
          fontSize="14"
          fontWeight="400"
          letterSpacing="6"
          fill="#1a4a6a"
        >
          TOKEN00.COM
        </text>
      </svg>
    </Link>
  )
}
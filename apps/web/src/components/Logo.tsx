'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useThemeStore } from '@/stores'
import { useSiteSettings } from '@/lib/useSiteSettings'

export function Logo({
  size = 'normal',
  asLink = true,
}: {
  size?: 'small' | 'normal' | 'large'
  asLink?: boolean
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
  const logoHeight = heightMap[size]
  // 默认 logo（V1 纯字标）按主题明暗切换变体：深色主题用浅色字（白心渐变），浅色主题用深蓝字
  const { theme } = useThemeStore()
  const isLight = theme === 'light'

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
    // V1 纯字标（无发光 / 无毛边），按主题明暗切换变体以匹配背景
    inner = (
      <Image
        src={isLight ? '/logo-light.svg' : '/logo-dark.svg'}
        alt="TokenPress"
        width={390}
        height={72}
        unoptimized
        className="h-full w-auto object-contain"
        style={{ height: '100%', width: 'auto' }}
      />
    )
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
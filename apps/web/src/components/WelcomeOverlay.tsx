'use client'

import { useEffect, useRef, useState } from 'react'
import { useStyleFeatures } from '@/components/StyleProvider'

const SEEN_KEY = 'token00_welcome_seen'

interface WelcomeOverlayProps {
  enabled: boolean
  htmlPath: string
}

/**
 * 首页欢迎页遮罩：首次访问（按浏览器 localStorage 记忆）展示科幻欢迎页。
 * 欢迎页内点「进入」会通过 postMessage({type:'welcome:close'}) 通知此处关闭。
 * 需同时满足：站点设置 welcome 开启 且 风格包 features.welcomeOverlay !== false。
 */
export function WelcomeOverlay({ enabled, htmlPath }: WelcomeOverlayProps) {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const closedByUser = useRef(false)
  const features = useStyleFeatures() || {}
  const featureOn = features.welcomeOverlay !== false

  useEffect(() => {
    if (!enabled || !featureOn || !htmlPath) return
    let seen = false
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1'
    } catch {}
    if (!seen && !closedByUser.current) setShow(true)
  }, [enabled, featureOn, htmlPath])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === 'welcome:close') close()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const close = () => {
    setLeaving(true)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {}
    setTimeout(() => setShow(false), 600)
  }

  if (!show || !htmlPath) return null

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black transition-opacity duration-500"
      style={{ opacity: leaving ? 0 : 1 }}
      aria-hidden={leaving}
    >
      {/* 跳过（手动关闭，同样标记为已看） */}
      <button
        onClick={close}
        className="absolute top-4 right-4 z-10 px-3 py-1.5 text-xs rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
      >
        跳过 ›
      </button>
      <iframe
        src={htmlPath}
        title="Token00 欢迎页"
        className="w-full h-full border-0"
        allow="autoplay"
      />
    </div>
  )
}

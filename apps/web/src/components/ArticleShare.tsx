'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Copy,
  Twitter,
  Facebook,
  Send,
  MessageCircle,
  Images,
  Megaphone,
  MessageSquare,
  Sparkles,
  Check,
  Share2,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import type { SharePlatform } from '@/lib/share-config'

interface ArticleShareProps {
  title: string
  summary?: string
  /** 仅显示这些平台（key 列表）；不传则显示全部 */
  platforms?: SharePlatform[]
  /** 右侧窄栏场景：分享标题独占一行，图标在下方排布，避免窄列下换行错乱 */
  aside?: boolean
}

type ShareKind = 'qr' | 'url' | 'copy'

interface ShareTarget {
  key: string
  name: string
  color: string
  icon: LucideIcon
  kind: ShareKind
  hint?: string
  build?: (ctx: { url: string; title: string; summary: string }) => string
}

const enc = (v: string) => encodeURIComponent(v)

// 微信/朋友圈无浏览器直连分享 API，唯一可行方案是二维码 + 手机微信扫码后手动分享。
// 其余平台使用官方 web share 端点；复制链接走剪贴板。
const TARGETS: ShareTarget[] = [
  {
    key: 'wechat',
    name: '微信',
    color: '#07C160',
    icon: MessageCircle,
    kind: 'qr',
    hint: '打开微信，扫一扫二维码，点击右上角 ··· 分享给好友',
  },
  {
    key: 'moments',
    name: '朋友圈',
    color: '#07C160',
    icon: Images,
    kind: 'qr',
    hint: '打开微信扫一扫，识别二维码后点击右上角 ··· 分享到朋友圈',
  },
  {
    key: 'weibo',
    name: '微博',
    color: '#E6162D',
    icon: Megaphone,
    kind: 'url',
    build: (c) =>
      `https://service.weibo.com/share/share.php?url=${enc(c.url)}&title=${enc(c.title)}`,
  },
  {
    key: 'qq',
    name: 'QQ',
    color: '#12B7F5',
    icon: MessageSquare,
    kind: 'url',
    build: (c) =>
      `https://connect.qq.com/widget/shareqq/index.html?url=${enc(c.url)}&title=${enc(
        c.title
      )}&summary=${enc(c.summary)}&site=Token00`,
  },
  {
    key: 'qzone',
    name: 'QQ空间',
    color: '#FFB300',
    icon: Sparkles,
    kind: 'url',
    build: (c) =>
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${enc(
        c.url
      )}&title=${enc(c.title)}&summary=${enc(c.summary)}`,
  },
  {
    key: 'twitter',
    name: 'X',
    color: '#000000',
    icon: Twitter,
    kind: 'url',
    build: (c) => `https://twitter.com/intent/tweet?url=${enc(c.url)}&text=${enc(c.title)}`,
  },
  {
    key: 'telegram',
    name: 'Telegram',
    color: '#0088CC',
    icon: Send,
    kind: 'url',
    build: (c) => `https://t.me/share/url?url=${enc(c.url)}&text=${enc(c.title)}`,
  },
  {
    key: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: Facebook,
    kind: 'url',
    build: (c) => `https://www.facebook.com/sharer/sharer.php?u=${enc(c.url)}`,
  },
  {
    key: 'copy',
    name: '复制链接',
    color: '#6B7280',
    icon: Copy,
    kind: 'copy',
  },
]

function getShareUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

function stripHtml(html?: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '').trim()
}

export function ArticleShare({ title, summary, platforms, aside }: ArticleShareProps) {
  const [qrTarget, setQrTarget] = useState<ShareTarget | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const cleanTitle = stripHtml(title)
  const cleanSummary = stripHtml(summary)

  const visibleTargets = platforms
    ? TARGETS.filter((t) => platforms.includes(t.key as SharePlatform))
    : TARGETS

  const handleClick = (target: ShareTarget) => {
    const url = getShareUrl()
    const ctx = { url, title: cleanTitle, summary: cleanSummary }

    if (target.kind === 'qr') {
      setQrTarget(target)
      return
    }

    if (target.kind === 'copy') {
      if (!url) return
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopiedKey('copy')
          toast.success('链接已复制')
          setTimeout(() => setCopiedKey(null), 1500)
        })
        .catch(() => toast.error('复制失败，请手动复制'))
      return
    }

    // url
    if (target.build) {
      const shareUrl = target.build(ctx)
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=640,height=640')
    }
  }

  const shareUrl = qrTarget ? getShareUrl() : ''

  const shareButtons = visibleTargets.map((t) => {
    const Icon = copiedKey === t.key ? Check : t.icon
    const isCopied = copiedKey === t.key
    return (
      <button
        key={t.key}
        type="button"
        onClick={() => handleClick(t)}
        title={t.name}
        aria-label={`分享到${t.name}`}
        className="group flex flex-col items-center gap-1.5 focus:outline-none"
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-105 group-active:scale-95"
          style={{ backgroundColor: isCopied ? '#07C160' : t.color }}
        >
          <Icon size={20} />
        </span>
        <span className="text-xs text-t-text-secondary transition-colors group-hover:text-t-text-primary">
          {isCopied ? '已复制' : t.name}
        </span>
      </button>
    )
  })

  return (
    <>
      {aside ? (
        // 右侧窄栏：标题独占一行，图标在下方排布
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-t-text-secondary">
            <Share2 size={14} />
            分享
          </div>
          <div className="flex flex-wrap gap-3">{shareButtons}</div>
        </div>
      ) : (
        // 正文上方/结尾：标签与图标同行
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-t-text-secondary">
            <Share2 size={14} />
            分享
          </span>
          {shareButtons}
        </div>
      )}

      <Modal
        open={!!qrTarget}
        onClose={() => setQrTarget(null)}
        title={qrTarget ? `分享到${qrTarget.name}` : '分享'}
      >
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-t-border bg-white p-3">
            <QRCodeSVG value={shareUrl || ' '} size={200} level="M" />
          </div>
          {qrTarget?.hint && (
            <p className="max-w-xs text-center text-sm text-t-text-secondary">{qrTarget.hint}</p>
          )}
          {shareUrl && (
            <p className="max-w-xs break-all text-center text-xs text-t-text-muted">{shareUrl}</p>
          )}
        </div>
      </Modal>
    </>
  )
}

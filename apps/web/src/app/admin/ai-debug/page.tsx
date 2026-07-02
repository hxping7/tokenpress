'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import {
  Play, Send, Trash2, Copy, Check, AlertCircle,
  CheckCircle, Clock, Key, Image as ImageIcon, Upload, Bold, Palette, Shuffle, X, Loader2
} from 'lucide-react'

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  DELETE: 'text-red-400',
}

// Title color options
const titleColors = [
  { value: '', labelKey: 'common.default' },
  { value: '#60c0ff', labelKey: 'color.blue' },
  { value: '#7c3aed', labelKey: 'color.purple' },
  { value: '#10b981', labelKey: 'color.green' },
  { value: '#f59e0b', labelKey: 'color.orange' },
  { value: '#ef4444', labelKey: 'color.red' },
  { value: '#ec4899', labelKey: 'color.pink' },
]

interface Token {
  id: number
  name: string
  token: string
  permissions: string[]
  is_active: boolean
}

interface HistoryItem {
  id: string
  timestamp: string
  method: string
  endpoint: string
  status: number
  duration: number
  request: any
  response: any
}

// Generate formatted title HTML
const formatTitle = (rawTitle: string, bold: boolean, color: string): string => {
  if (!bold && !color) return rawTitle
  let styled = rawTitle
  if (color) {
    styled = `<span style="color:${color}">${styled}</span>`
  }
  if (bold) {
    styled = `<strong>${styled}</strong>`
  }
  return styled
}

export default function AIDebugPage() {
  const { token: authToken } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''

  // Form state
  const [selectedToken, setSelectedToken] = useState<string>('')
  const [title, setTitle] = useState(t('aiDebug.title_label', backendLocale) + ' - AI Publish Debug')
  const [titleBold, setTitleBold] = useState(false)
  const [titleColor, setTitleColor] = useState('')
  const [content, setContent] = useState(`# Test Article

This is a test article created via AI Publish Debug.

## Features Test

- Item 1
- Item 2
- Item 3

\`\`\`javascript
console.log('Hello, Token00!')
\`\`\`

## Summary

This is an article for testing the API publish feature.`)
  const [section, setSection] = useState('blog')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [tags, setTags] = useState('test, AI')
  const [coverImage, setCoverImage] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  // UI state
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])

  const coverInputRef = useRef<HTMLInputElement>(null)

  // Fetch tokens
  const { data: tokensData } = useQuery({
    queryKey: ['admin-tokens'],
    queryFn: () => api.getTokens(),
  })

  const tokens = tokensData?.data || []

  // Fetch sections from API
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections'),
  })

  const sections = (sectionsData?.data || []).map((s: { slug: string; name: string }) => ({
    value: s.slug,
    label: s.name,
  }))

  // Media library data
  const { data: mediaData } = useQuery({
    queryKey: ['cover-media'],
    queryFn: () => api.getMedia({ limit: 50 }),
  })

  // Cover image upload
  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true)
    try {
      const res = await api.uploadMedia(file)
      setCoverImage(res.data.url)
    } catch (err) {
      console.error('Upload failed:', err)
      alert(t('aiDebug.uploadFailed', backendLocale))
    } finally {
      setUploadingCover(false)
    }
  }

  // Random cover service
  const getRandomCover = () => {
    const randomUrl = `https://picsum.photos/1200/630?random=${Date.now()}`
    setCoverImage(randomUrl)
  }

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selectedToken) throw new Error(t('aiDebug.selectTokenFirst', backendLocale))

      const startTime = Date.now()
      const token = tokens.find((t: Token) => t.id === Number(selectedToken))
      if (!token) throw new Error(t('aiDebug.tokenNotExist', backendLocale))

      // Generate formatted title
      const formattedTitle = formatTitle(title, titleBold, titleColor)

      const response = await fetch(`${baseUrl}/api/v1/ai/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.token}`,
        },
        body: JSON.stringify({
          title: formattedTitle,
          content,
          section,
          status,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          coverImage: coverImage || undefined,
        }),
      })

      const duration = Date.now() - startTime
      const data = await response.json()

      return {
        status: response.status,
        duration,
        data,
        request: { title: formattedTitle, content, section, status, tags, coverImage },
      }
    },
    onSuccess: (result) => {
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        method: 'POST',
        endpoint: '/ai/publish',
        status: result.status,
        duration: result.duration,
        request: result.request,
        response: result.data,
      }
      setHistory(prev => [historyItem, ...prev].slice(0, 20))
    },
  })

  // Delete article mutation
  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      if (!selectedToken) throw new Error(t('aiDebug.selectTokenFirst', backendLocale))

      const token = tokens.find((t: Token) => t.id === Number(selectedToken))
      if (!token) throw new Error(t('aiDebug.tokenNotExist', backendLocale))

      const response = await fetch(`${baseUrl}/api/v1/ai/articles/${slug}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.token}`,
        },
      })

      return { status: response.status, data: await response.json() }
    },
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t('aiDebug.title', backendLocale)}</h1>
        <p className="text-t-text-secondary mt-1">{t('aiDebug.desc', backendLocale)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Request Form */}
        <div className="space-y-4">
          {/* Token Selection */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Key size={16} />
              API Token
            </label>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
            >
              <option value="">{t('aiDebug.selectToken', backendLocale)}</option>
              {tokens.map((tk: Token) => (
                <option key={tk.id} value={tk.id} disabled={!tk.is_active}>
                  {tk.name} {!tk.is_active ? t('aiDebug.tokenDisabled', backendLocale) : ''}
                </option>
              ))}
            </select>
            {selectedToken && (
              <p className="mt-2 text-xs text-t-text-secondary">
                {t('aiDebug.permissions', backendLocale)}: {tokens.find((tk: Token) => tk.id === Number(selectedToken))?.permissions?.join(', ') || '-'}
              </p>
            )}
          </div>

          {/* Article Form */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl p-4 space-y-4">
            {/* Title with formatting */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('aiDebug.title_label', backendLocale)}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                placeholder={t('aiDebug.titlePlaceholder', backendLocale)}
                style={{ fontWeight: titleBold ? 'bold' : 'normal', color: titleColor || undefined }}
              />
              {/* Title formatting toolbar */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTitleBold(!titleBold)}
                  className={`p-1.5 rounded transition-colors ${titleBold ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'}`}
                  title={t('aiDebug.title_label', backendLocale)}
                >
                  <Bold size={16} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className={`p-1.5 rounded transition-colors ${titleColor ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'}`}
                    title={t('aiDebug.title_label', backendLocale)}
                  >
                    <Palette size={16} />
                  </button>
                  <select
                    value={titleColor}
                    onChange={(e) => setTitleColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {titleColors.map(c => (
                      <option key={c.value} value={c.value}>{c.labelKey}</option>
                    ))}
                  </select>
                </div>
                {titleColor && (
                  <div
                    className="w-5 h-5 rounded border border-t-border"
                    style={{ backgroundColor: titleColor }}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('aiDebug.section_label', backendLocale)}</label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                >
                  {sections.map((s: { value: string; label: string }) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('aiDebug.status_label', backendLocale)}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                >
                  <option value="draft">{t('aiDebug.draft', backendLocale)}</option>
                  <option value="published">{t('aiDebug.published', backendLocale)}</option>
                </select>
              </div>
            </div>

            {/* Markdown Editor */}
            <div className="min-h-[300px]">
              <label className="text-sm font-medium mb-2 block">{t('aiDebug.content', backendLocale)}</label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                placeholder={t('aiDebug.contentPlaceholder', backendLocale)}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('aiDebug.tags', backendLocale)}</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                placeholder={t('aiDebug.tagsPlaceholder', backendLocale)}
              />
            </div>

            {/* Cover Image */}
            <div>
              <label className="text-sm font-medium mb-2 block">{t('aiDebug.coverImage', backendLocale)}</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder={t('aiDebug.coverPlaceholder', backendLocale)}
                  className="flex-1 px-3 py-2 text-sm bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
              </div>
              <div className="flex gap-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCoverUpload(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors disabled:opacity-50"
                >
                  {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {t('aiDebug.localUpload', backendLocale)}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker(true)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
                >
                  <ImageIcon size={14} />
                  {t('aiDebug.mediaLibrary', backendLocale)}
                </button>
                <button
                  type="button"
                  onClick={getRandomCover}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
                >
                  <Shuffle size={14} />
                  {t('aiDebug.random', backendLocale)}
                </button>
              </div>
              {coverImage && (
                <img src={coverImage} alt={t('aiDebug.coverImage', backendLocale)} className="mt-2 w-full h-24 object-cover rounded-lg" />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => publishMutation.mutate()}
                disabled={!selectedToken || !title || !content || publishMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    {t('aiDebug.publishing', backendLocale)}
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {t('aiDebug.publishArticle', backendLocale)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Response & History */}
        <div className="space-y-4">
          {/* Current Response */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-t-border flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                {publishMutation.isSuccess ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : publishMutation.isError ? (
                  <AlertCircle size={16} className="text-red-400" />
                ) : (
                  <Play size={16} className="text-t-text-secondary" />
                )}
                {t('aiDebug.responseResult', backendLocale)}
              </h3>
              {publishMutation.data && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={publishMutation.data.status < 300 ? 'text-green-400' : 'text-red-400'}>
                    {publishMutation.data.status}
                  </span>
                  <span className="text-t-text-secondary">{publishMutation.data.duration}ms</span>
                </div>
              )}
            </div>
            <div className="p-4">
              {publishMutation.data ? (
                <pre className="text-sm font-mono text-t-text-secondary overflow-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(publishMutation.data.data, null, 2)}
                </pre>
              ) : publishMutation.isError ? (
                <div className="text-red-400 text-sm">
                  {publishMutation.error?.message || t('aiDebug.requestFailed', backendLocale)}
                </div>
              ) : (
                <div className="text-t-text-secondary text-sm text-center py-8">
                  {t('aiDebug.sendToView', backendLocale)}
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-t-border flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Clock size={16} />
                {t('aiDebug.requestHistory', backendLocale)}
              </h3>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-t-text-secondary hover:text-red-400"
                >
                  {t('aiDebug.clear', backendLocale)}
                </button>
              )}
            </div>
            <div className="divide-y divide-t-border max-h-96 overflow-y-auto">
              {history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-t-hover">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-sm ${methodColors[item.method]}`}>
                          {item.method}
                        </span>
                        <span className="text-sm font-mono text-t-text-secondary">{item.endpoint}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={item.status < 300 ? 'text-green-400' : 'text-red-400'}>
                          {item.status}
                        </span>
                        <span className="text-t-text-secondary">{item.duration}ms</span>
                      </div>
                    </div>
                    <div className="text-sm text-t-text-secondary">
                      {item.response?.data?.slug && (
                        <span className="mr-3">/{item.response.data.slug}</span>
                      )}
                      {item.response?.data?.action && (
                        <span className="px-2 py-0.5 bg-t-bg-secondary rounded text-xs">
                          {item.response.data.action}
                        </span>
                      )}
                    </div>
                    {item.response?.data?.url && (
                      <a
                        href={item.response.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-t-accent-blue hover:underline mt-1 inline-block"
                      >
                        {t('aiDebug.viewArticle', backendLocale)}
                      </a>
                    )}
                    {item.response?.data?.slug && (
                      <button
                        onClick={() => deleteMutation.mutate(item.response.data.slug)}
                        className="text-xs text-red-400 hover:text-red-300 ml-3"
                      >
                        {t('common.delete', backendLocale)}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-t-text-secondary text-sm">
                  {t('aiDebug.noHistory', backendLocale)}
                </div>
              )}
            </div>
          </div>

          {/* cURL Example */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">{t('aiDebug.curlExample', backendLocale)}</h3>
              <button
                onClick={() => copyToClipboard(`curl -X POST ${baseUrl}/api/v1/ai/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "${title}",
    "content": "Markdown content...",
    "section": "${section}",
    "status": "${status}"
  }'`)}
                className="flex items-center gap-1 text-xs text-t-text-secondary hover:text-t-text-primary"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? t('aiDebug.copied', backendLocale) : t('aiDebug.copy', backendLocale)}
              </button>
            </div>
            <pre className="text-xs font-mono text-t-text-secondary overflow-auto whitespace-pre-wrap">
{`curl -X POST ${baseUrl}/api/v1/ai/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "${title}",
    "content": "...",
    "section": "${section}",
    "status": "${status}"
  }'`}
            </pre>
          </div>
        </div>
      </div>

      {/* Cover Media Picker Modal */}
      {showCoverPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCoverPicker(false)} />
          <div className="relative w-full max-w-4xl max-h-[80vh] bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{t('aiDebug.selectCover', backendLocale)}</h2>
              <button onClick={() => setShowCoverPicker(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {mediaData?.data?.length === 0 ? (
                <div className="text-center py-12 text-t-text-secondary">
                  <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
                  <p>{t('aiDebug.mediaEmpty', backendLocale)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {mediaData?.data?.map((media: any) => (
                    <button
                      key={media.id}
                      onClick={() => {
                        setCoverImage(media.url)
                        setShowCoverPicker(false)
                      }}
                      className="aspect-square bg-t-bg-secondary rounded-lg overflow-hidden hover:ring-2 hover:ring-t-accent-blue transition-all group relative"
                    >
                      {media.mimeType?.startsWith('image/') ? (
                        <img
                          src={media.thumbnailUrl || media.url}
                          alt={media.originalName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-t-text-secondary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Check size={20} className="text-t-accent-blue" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

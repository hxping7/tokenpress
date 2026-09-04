'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { StylePackForm, type StyleDraft } from '@/components/style-pack/StylePackForm'
import { StylePreviewMock } from '@/components/style-pack/StylePreviewMock'

const DRAFT_KEY = (id: string) => `style-preview-draft:${id}`

export function StylePreviewPage({ styleId, builtin }: { styleId: string; builtin: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<StyleDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 优先使用编辑器暂存的未保存草稿
      let loaded: StyleDraft | null = null
      try {
        const stash = sessionStorage.getItem(DRAFT_KEY(styleId))
        if (stash) loaded = JSON.parse(stash)
      } catch { /* ignore */ }
      if (!loaded) {
        try {
          const res = await api.getStyle(styleId)
          const d = res.data
          const rawStyle = d.style && typeof d.style === 'object' ? d.style : null
          loaded = {
            manifest: { name: d.manifest?.name || '', description: d.manifest?.description || '', version: d.manifest?.version || '' },
            theme: typeof d.theme === 'string' ? d.theme : '',
            layouts: d.layouts || {},
            header: d.header || {},
            footer: d.footer || null,
            hero: rawStyle?.hero && typeof rawStyle.hero === 'object' ? rawStyle.hero : {},
            features: rawStyle?.features && typeof rawStyle.features === 'object' ? rawStyle.features : {},
          }
        } catch (e: any) {
          if (!cancelled) setSaveError(e?.message || '加载失败')
        }
      }
      if (!cancelled) {
        setDraft(loaded)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [styleId])

  const handleSave = async (apply: boolean) => {
    if (!draft) return
    setSaveError('')
    setSaving(true)
    try {
      await api.updateStyle(styleId, {
        manifest: draft.manifest,
        theme: draft.theme || undefined,
        layouts: draft.layouts,
        header: draft.header,
        footer: draft.footer,
        hero: draft.hero || {},
        features: draft.features || {},
      })
      try { sessionStorage.removeItem(DRAFT_KEY(styleId)) } catch { /* ignore */ }
      if (apply) await api.setActiveStyle(styleId)
      setSavedAt(Date.now())
    } catch (e: any) {
      setSaveError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具条 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-t-border bg-t-bg-primary">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/admin/settings?tab=style')}
            className="p-2 rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover"
            title="返回风格设置"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-t-text-primary truncate">
              实时设计预览：{draft?.manifest.name || styleId}
            </p>
            <p className="text-xs text-t-text-muted">左侧调整，右侧即时预览 · 改即所见</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAt > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check size={14} /> 已保存
            </span>
          )}
          {saveError && (
            <span className="text-xs text-red-400 flex items-center gap-1 max-w-[200px] truncate">
              <AlertCircle size={14} /> {saveError}
            </span>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-t-border text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 保存
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-t-accent-blue text-black hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} 保存并应用
          </button>
        </div>
      </div>

      {/* 主体：左表单 + 右预览 */}
      <div className="flex-1 flex min-h-0">
        <div className="w-[420px] shrink-0 border-r border-t-border bg-t-bg-primary min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-t-text-secondary">
              <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
            </div>
          ) : (
            <StylePackForm draft={draft!} onChange={setDraft} />
          )}
        </div>
        <div className="flex-1 min-h-0 bg-t-bg-secondary">
          {loading || !draft ? (
            <div className="flex items-center justify-center h-full text-t-text-secondary">加载预览…</div>
          ) : (
            <StylePreviewMock draft={draft} />
          )}
        </div>
      </div>
    </div>
  )
}

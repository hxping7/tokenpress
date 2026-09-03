'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Save, Trash2, AlertCircle, Loader2, Eye } from 'lucide-react'
import { api } from '@/lib/api'
import { StylePackForm, type StyleDraft } from '@/components/style-pack/StylePackForm'

interface Props {
  styleId: string
  builtin: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const DRAFT_KEY = (id: string) => `style-preview-draft:${id}`

export function StyleEditorModal({ styleId, builtin, onClose, onSaved, onDeleted }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<StyleDraft | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getStyle(styleId)
        const d = res.data
        if (cancelled) return
        // 站点覆盖等「原始值」取 d.style（顶层 d.site 是已与 site_settings 合并的解析值，不可回写）
        const rawStyle = d.style && typeof d.style === 'object' ? d.style : null
        setDraft({
          manifest: {
            name: d.manifest?.name || '',
            description: d.manifest?.description || '',
            version: d.manifest?.version || '',
            themeVariants: d.manifest?.themeVariants,
            themeOptions: d.manifest?.themeOptions,
          },
          theme: typeof d.theme === 'string' ? d.theme : '',
          layouts: d.layouts || {},
          header: d.header || {},
          footer: d.footer || null,
          site: rawStyle?.site && typeof rawStyle.site === 'object' ? rawStyle.site : {},
          hero: rawStyle?.hero && typeof rawStyle.hero === 'object' ? rawStyle.hero : {},
          features: rawStyle?.features && typeof rawStyle.features === 'object' ? rawStyle.features : {},
        })
        setLoadError('')
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || '加载模板包配置失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [styleId])

  const handleSave = async () => {
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
        site: draft.site || {},
        hero: draft.hero || {},
        features: draft.features || {},
      })
      onSaved()
    } catch (e: any) {
      setSaveError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`确定删除模板包「${draft?.manifest.name || styleId}」？此操作不可恢复。`)) return
    setDeleting(true)
    try {
      await api.deleteStyle(styleId)
      onDeleted()
    } catch (e: any) {
      setSaveError(e?.message || '删除失败')
      setDeleting(false)
    }
  }

  const handlePreview = () => {
    if (!draft) return
    try {
      sessionStorage.setItem(DRAFT_KEY(styleId), JSON.stringify(draft))
    } catch { /* ignore quota */ }
    router.push(`/admin/style-preview/${styleId}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-3xl bg-t-bg-primary border-l border-t-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-t-text-primary truncate">
              编辑模板包：{draft?.manifest.name || styleId}
            </h2>
            {builtin && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-t-bg-tertiary text-t-text-secondary">
                内置
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover transition-colors">
            <X size={18} />
          </button>
        </div>

        {builtin && (
          <div className="px-6 pt-3">
            <p className="text-xs text-t-text-muted">
              提示：修改内置模板包后内容会持久保存（重建容器也不会被出厂文件覆盖）。
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-t-text-secondary">
              <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-red-400 py-20 justify-center">
              <AlertCircle size={18} /> {loadError}
            </div>
          ) : (
            <StylePackForm draft={draft!} onChange={setDraft} />
          )}
        </div>

        <div className="border-t border-t-border px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {!builtin && (
              <button
                onClick={handleDelete}
                disabled={deleting || loading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={15} /> {deleting ? '删除中...' : '删除此模板包'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-red-400 flex items-center gap-1 max-w-[220px] truncate">
                <AlertCircle size={14} /> {saveError}
              </span>
            )}
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-t-border text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover transition-colors"
            >
              <Eye size={15} /> 进入实时预览
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-t-text-secondary hover:bg-t-hover transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

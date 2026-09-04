'use client'

import { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, Copy } from 'lucide-react'
import { api } from '@/lib/api'

interface Props {
  onClose: () => void
  onCreated: (id: string) => void
}

const ID_RE = /^[a-z0-9-]+$/

export function NewStyleModal({ onClose, onCreated }: Props) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [baseId, setBaseId] = useState('blog')
  const [bases, setBases] = useState<{ id: string; name: string }[]>([])
  const [loadingBases, setLoadingBases] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getStyles()
        if (!cancelled) setBases((res.data || []).map((s: any) => ({ id: s.id, name: s.name || s.id })))
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingBases(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const idError = id
    ? ID_RE.test(id)
      ? (id.length < 2 || id.length > 32 ? 'id 长度需 2~32' : '')
      : 'id 只能含小写字母、数字与连字符'
    : '必填'

  const handleCreate = async () => {
    setError('')
    if (idError) { setError(idError); return }
    setSaving(true)
    try {
      let theme: string | undefined
      let layouts: any
      let header: any
      let footer: any
      if (baseId && baseId !== 'blank') {
        try {
          const base = await api.getStyle(baseId)
          theme = typeof base.data.theme === 'string' ? base.data.theme : undefined
          layouts = base.data.layouts || {}
          header = base.data.header || {}
          footer = base.data.footer ?? null
        } catch {
          /* 基包读取失败则用空白 */
        }
      }
      await api.createStyle({
        id,
        manifest: { name: name || id, description, version },
        theme,
        layouts,
        header,
        footer,
      })
      onCreated(id)
    } catch (e: any) {
      setError(e?.message || '创建失败')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-lg bg-t-bg-primary border-l border-t-border shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <h2 className="font-semibold text-t-text-primary">新建风格包</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs text-t-text-muted">
            新建后会作为“自定义包”保存（可编辑/删除/激活）。建议基于现有包克隆后再改，避免空白不可渲染。
          </p>

          <div>
            <label className="block text-sm font-medium text-t-text-primary mb-1">包 ID（slug）</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value.trim().toLowerCase())}
              placeholder="如 my-brutalist"
              className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-t-text-primary focus:outline-none focus:border-t-accent-blue"
            />
            {id && idError && <p className="text-xs text-red-400 mt-1">{idError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-t-text-primary mb-1">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="我的风格"
              className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-t-text-primary focus:outline-none focus:border-t-accent-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-t-text-primary mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="一句话说明这套风格的定位"
              className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-t-text-primary focus:outline-none focus:border-t-accent-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-t-text-primary mb-1">版本</label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-t-text-primary focus:outline-none focus:border-t-accent-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-t-text-primary mb-1 flex items-center gap-1.5">
              <Copy size={14} /> 基于已有包克隆
            </label>
            {loadingBases ? (
              <div className="text-sm text-t-text-secondary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> 加载中...</div>
            ) : (
              <select
                value={baseId}
                onChange={(e) => setBaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-t-text-primary focus:outline-none focus:border-t-accent-blue"
              >
                <option value="blank">空白（仅最小配置）</option>
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}（{b.id}）</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="border-t border-t-border px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {error && (
              <span className="text-xs text-red-400 flex items-center gap-1 max-w-[260px] truncate">
                <AlertCircle size={14} /> {error}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-t-text-secondary hover:bg-t-hover transition-colors">
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !!idError}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? '创建中...' : '创建风格包'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

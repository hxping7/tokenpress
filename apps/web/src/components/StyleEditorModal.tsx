'use client'

import { useState, useEffect } from 'react'
import { X, Save, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Props {
  styleId: string
  builtin: boolean
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const SECTION_COMPONENTS = ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner']

export function StyleEditorModal({ styleId, builtin, onClose, onSaved, onDeleted }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('')
  const [theme, setTheme] = useState('')
  const [layoutsText, setLayoutsText] = useState('')
  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.getStyle(styleId)
        const d = res.data
        if (cancelled) return
        setName(d.manifest?.name || '')
        setDescription(d.manifest?.description || '')
        setVersion(d.manifest?.version || '')
        setTheme(typeof d.theme === 'string' ? d.theme : '')
        setLayoutsText(d.layouts ? JSON.stringify(d.layouts, null, 2) : '')
        setHeaderText(d.header ? JSON.stringify(d.header, null, 2) : '')
        setFooterText(d.footer ? JSON.stringify(d.footer, null, 2) : '')
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
    setSaveError('')
    let layouts: any = undefined
    let header: any = undefined
    let footer: any = undefined
    try {
      layouts = layoutsText.trim() ? JSON.parse(layoutsText) : undefined
    } catch {
      setSaveError('首页布局 layouts.json 不是合法 JSON，请检查括号与引号。')
      return
    }
    try {
      header = headerText.trim() ? JSON.parse(headerText) : undefined
    } catch {
      setSaveError('Header header.json 不是合法 JSON，请检查括号与引号。')
      return
    }
    try {
      footer = footerText.trim() ? JSON.parse(footerText) : undefined
    } catch {
      setSaveError('Footer footer.json 不是合法 JSON，请检查括号与引号。')
      return
    }

    setSaving(true)
    try {
      await api.updateStyle(styleId, {
        manifest: { name, description, version },
        theme: theme || undefined,
        layouts,
        header,
        footer,
      })
      onSaved()
    } catch (e: any) {
      setSaveError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`确定删除模板包「${name || styleId}」？此操作不可恢复。`)) return
    setDeleting(true)
    try {
      await api.deleteStyle(styleId)
      onDeleted()
    } catch (e: any) {
      setSaveError(e?.message || '删除失败')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-2xl bg-t-bg-primary border-l border-t-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-t-text-primary truncate">
              编辑模板包：{name || styleId}
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
          <div className="px-6 pt-4">
            <p className="text-xs text-t-text-muted">
              提示：修改内置模板包后，内容会持久保存（重建容器也不会被出厂文件覆盖）。
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-t-text-secondary">
              <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 text-red-400 py-20 justify-center">
              <AlertCircle size={18} /> {loadError}
            </div>
          ) : (
            <>
              {/* 基本信息 */}
              <section>
                <h3 className="text-sm font-medium text-t-text-primary mb-3">基本信息</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-t-text-muted mb-1">名称</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-t-text-muted mb-1">描述</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-t-text-muted mb-1">版本</label>
                    <input
                      value={version}
                      onChange={e => setVersion(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue"
                    />
                  </div>
                </div>
              </section>

              {/* 配色主题 */}
              <section>
                <h3 className="text-sm font-medium text-t-text-primary mb-3">配色主题（theme.css）</h3>
                <textarea
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-xs text-t-text-primary font-mono outline-none focus:border-t-accent-blue resize-y leading-relaxed"
                />
                <p className="text-[11px] text-t-text-muted mt-1">
                  必须以 <code className="font-mono">:root &#123; ... &#125;</code> 开头，仅允许 CSS 变量声明，禁止 @import / url() / 脚本。
                </p>
              </section>

              {/* 首页布局 */}
              <section>
                <h3 className="text-sm font-medium text-t-text-primary mb-3">首页布局（layouts.json）</h3>
                <textarea
                  value={layoutsText}
                  onChange={e => setLayoutsText(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-xs text-t-text-primary font-mono outline-none focus:border-t-accent-blue resize-y leading-relaxed"
                />
                <p className="text-[11px] text-t-text-muted mt-1">
                  可用首页组件：{SECTION_COMPONENTS.join('、')}（注意大小写）。
                </p>
              </section>

              {/* Header */}
              <section>
                <h3 className="text-sm font-medium text-t-text-primary mb-3">页眉（header.json）</h3>
                <textarea
                  value={headerText}
                  onChange={e => setHeaderText(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-xs text-t-text-primary font-mono outline-none focus:border-t-accent-blue resize-y leading-relaxed"
                />
                <p className="text-[11px] text-t-text-muted mt-1 leading-relaxed">
                  右上角操作按钮由 <code className="font-mono">actions</code> 数组定义（数组顺序即从左到右位置）。每项：<br />
                  <code className="font-mono">type</code>: theme | language | admin | login | logout | link；<br />
                  <code className="font-mono">icon</code>: palette/globe/dashboard/user/login/logout/settings/...；<br />
                  <code className="font-mono">style</code>: icon | text | ghost | outline | primary | pill；<br />
                  <code className="font-mono">label</code>: 字符串或 {'{zh,en}'}；<code className="font-mono">showWhen</code>: always | loggedIn | loggedOut；<br />
                  <code className="font-mono">href</code>（type=link 时必填）。不写 actions 则回退经典按钮组。
                </p>
              </section>

              {/* Footer */}
              <section>
                <h3 className="text-sm font-medium text-t-text-primary mb-3">页脚（footer.json）</h3>
                <textarea
                  value={footerText}
                  onChange={e => setFooterText(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-xs text-t-text-primary font-mono outline-none focus:border-t-accent-blue resize-y leading-relaxed"
                />
              </section>
            </>
          )}
        </div>

        {/* Footer actions */}
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
              <span className="text-xs text-red-400 flex items-center gap-1 max-w-[240px] truncate">
                <AlertCircle size={14} /> {saveError}
              </span>
            )}
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

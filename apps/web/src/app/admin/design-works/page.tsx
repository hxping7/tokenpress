'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import type { DesignWork } from '@/lib/api'

interface FormState {
  id: number | null
  title: string
  slug: string
  coverImage: string
  summary: string
  content: string
  authorName: string
  authorAvatar: string
  category: string
  tags: string
  externalUrl: string
  galleryImages: string
  status: 'published' | 'draft'
  sortOrder: number
}

const EMPTY: FormState = {
  id: null, title: '', slug: '', coverImage: '', summary: '', content: '',
  authorName: '', authorAvatar: '', category: '', tags: '', externalUrl: '',
  galleryImages: '', status: 'published', sortOrder: 0,
}

export default function AdminDesignWorksPage() {
  const [works, setWorks] = useState<DesignWork[]>([])
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const loadWorks = async () => {
    try {
      const res = await api.get<{ data: DesignWork[] }>(`/design-works/manage?section=design-works`)
      setWorks(res.data || [])
    } catch {
      setWorks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.get<{ data: any[] }>('/sections').then((r) => {
      const s = (r.data || []).find((x) => x.slug === 'design-works')
      setSectionId(s?.id ?? null)
    }).catch(() => {})
    loadWorks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => { setForm(EMPTY); setShowForm(true) }
  const openEdit = (w: DesignWork) => {
    setForm({
      id: w.id, title: w.title, slug: w.slug, coverImage: w.coverImage || '',
      summary: w.summary || '', content: w.content || '', authorName: w.authorName || '',
      authorAvatar: w.authorAvatar || '', category: w.category || '', tags: (w.tags || []).join(', '),
      externalUrl: w.externalUrl || '', galleryImages: (w.galleryImages || []).join('\n'),
      status: (w.status as any) || 'published', sortOrder: w.sortOrder || 0,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title || !sectionId) return
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        coverImage: form.coverImage || null,
        summary: form.summary || null,
        content: form.content || null,
        authorName: form.authorName || null,
        authorAvatar: form.authorAvatar || null,
        category: form.category || null,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        externalUrl: form.externalUrl || null,
        galleryImages: form.galleryImages.split('\n').map((s) => s.trim()).filter(Boolean),
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
        sectionId,
      }
      if (form.id) {
        await api.put(`/design-works/${form.id}`, payload)
      } else {
        await api.post('/design-works', payload)
      }
      setShowForm(false)
      await loadWorks()
    } catch (e: any) {
      alert('保存失败：' + (e?.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该作品？')) return
    try {
      await api.delete(`/design-works/${id}`)
      await loadWorks()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-t-text-primary">作品管理</h1>
          <p className="text-sm text-t-text-secondary mt-1">设计师作品集 · 板块「设计师作品」</p>
        </div>
        {!showForm && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-t-accent-blue text-black text-sm font-medium hover:opacity-90">
            <Plus size={16} /> 新建作品
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6 p-5 rounded-xl border border-t-border bg-t-bg-primary space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-t-text-primary">{form.id ? '编辑作品' : '新建作品'}</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-t-text-secondary hover:text-t-text-primary">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="标题 *"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Slug（留空自动生成）"><input className="input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
            <Field label="封面图 URL"><input className="input" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} /></Field>
            <Field label="作者名"><input className="input" value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} /></Field>
            <Field label="作者头像 URL"><input className="input" value={form.authorAvatar} onChange={(e) => setForm({ ...form, authorAvatar: e.target.value })} /></Field>
            <Field label="分类"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="标签（逗号分隔）"><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
            <Field label="外链 URL"><input className="input" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} /></Field>
            <Field label="排序（越小越前）"><input type="number" className="input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Field>
            <Field label="状态">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
              </select>
            </Field>
          </div>

          <Field label="摘要"><textarea className="input" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field>
          <Field label="正文（支持纯文本/简单换行）"><textarea className="input" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
          <Field label="图集（每行一个图片 URL）"><textarea className="input" rows={3} value={form.galleryImages} onChange={(e) => setForm({ ...form, galleryImages: e.target.value })} /></Field>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-t-accent-blue text-black text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? '保存中…' : '保存'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg border border-t-border text-sm text-t-text-secondary hover:text-t-text-primary">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="rounded-xl border border-t-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-t-text-muted text-sm">加载中…</div>
        ) : works.length === 0 ? (
          <div className="p-8 text-center text-t-text-muted text-sm">暂无作品，点击右上角「新建作品」</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-t-bg-secondary text-t-text-secondary">
              <tr>
                <th className="text-left p-3 font-medium">标题</th>
                <th className="text-left p-3 font-medium">分类</th>
                <th className="text-left p-3 font-medium">状态</th>
                <th className="text-left p-3 font-medium">作者</th>
                <th className="text-right p-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id} className="border-t border-t-border">
                  <td className="p-3 text-t-text-primary">{w.title}</td>
                  <td className="p-3 text-t-text-secondary">{w.category || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${w.status === 'published' ? 'bg-green-500/15 text-green-400' : 'bg-t-bg-secondary text-t-text-muted'}`}>
                      {w.status === 'published' ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="p-3 text-t-text-secondary">{w.authorName || '-'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(w)} className="p-1.5 text-t-text-secondary hover:text-t-accent-blue"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(w.id)} className="p-1.5 text-t-text-secondary hover:text-red-400"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border, #2a2a40);
          color: inherit;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: var(--accent-blue, #3b82f6); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-t-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  )
}

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import {
  ShieldAlert,
  Plus,
  Trash2,
  Edit3,
  Upload,
  X,
  Check,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react'

interface SensitiveKeyword {
  id: number
  keyword: string
  category: string
  severity: 'low' | 'medium' | 'high'
  action: 'block' | 'review'
  scope: string
  enabled: number
  created_by: number | null
  created_at: string
}

const severityColors: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-red-500/20 text-red-400',
}

const actionColors: Record<string, string> = {
  block: 'bg-red-600/20 text-red-300',
  review: 'bg-yellow-600/20 text-yellow-300',
}

const categories = [
  'general', 'gambling', 'pornography', 'fraud', 'finance', 'drugs',
  'violence', 'politics', 'contact', 'spam', 'custom',
]

const scopes = ['all', 'article', 'media', 'ad', 'friend_link']

export default function SensitiveKeywordsPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const locale = backendLocale

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterScope, setFilterScope] = useState('')
  const [page, setPage] = useState(1)

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<SensitiveKeyword | null>(null)
  const [formKeyword, setFormKeyword] = useState('')
  const [formCategory, setFormCategory] = useState('general')
  const [formSeverity, setFormSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [formAction, setFormAction] = useState<'block' | 'review'>('review')
  const [formScope, setFormScope] = useState('all')

  // Batch import modal
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchText, setBatchText] = useState('')

  const { data: keywordsData, isLoading } = useQuery({
    queryKey: ['sensitive-keywords', search, filterCategory, filterScope, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('keyword', search)
      if (filterCategory) params.set('category', filterCategory)
      if (filterScope) params.set('scope', filterScope)
      return api.get(`/admin/sensitive-keywords?${params}`)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/admin/sensitive-keywords', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensitive-keywords'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/admin/sensitive-keywords/${id}`, data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensitive-keywords'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/admin/sensitive-keywords/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensitive-keywords'] })
    },
  })

  const batchImportMutation = useMutation({
    mutationFn: (keywords: Array<{ keyword: string; category?: string; severity?: string; action?: string; scope?: string }>) =>
      api.post('/admin/sensitive-keywords/batch', { keywords }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensitive-keywords'] })
      setShowBatchModal(false)
      setBatchText('')
    },
  })

  const keywords: SensitiveKeyword[] = keywordsData?.data || []
  const pagination = keywordsData?.pagination || { page: 1, limit: 50, total: 0 }

  function openAdd() {
    setEditItem(null)
    setFormKeyword('')
    setFormCategory('general')
    setFormSeverity('medium')
    setFormAction('review')
    setFormScope('all')
    setShowModal(true)
  }

  function openEdit(item: SensitiveKeyword) {
    setEditItem(item)
    setFormKeyword(item.keyword)
    setFormCategory(item.category)
    setFormSeverity(item.severity as 'low' | 'medium' | 'high')
    setFormAction(item.action as 'block' | 'review')
    setFormScope(item.scope)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditItem(null)
  }

  function handleSave() {
    if (!formKeyword.trim()) return
    if (editItem) {
      updateMutation.mutate({
        id: editItem.id,
        data: {
          keyword: formKeyword.trim(),
          category: formCategory,
          severity: formSeverity,
          action: formAction,
          scope: formScope,
        },
      })
    } else {
      createMutation.mutate({
        keyword: formKeyword.trim(),
        category: formCategory,
        severity: formSeverity,
        action: formAction,
        scope: formScope,
      })
    }
  }

  function handleBatchImport() {
    const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const keywords = lines.map(l => ({ keyword: l }))
    batchImportMutation.mutate(keywords)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-t-text-primary flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          {t('skw.title', locale)}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border hover:bg-t-bg-primary text-sm text-t-text-primary transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t('skw.batchImport', locale)}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-t-accent-blue hover:bg-t-accent-blue/80 text-white text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('skw.addKeyword', locale)}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">{t('skw.totalKeywords', locale)}</div>
          <div className="text-2xl font-bold text-t-text-primary">{pagination.total}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">{t('skw.blockCount', locale)}</div>
          <div className="text-2xl font-bold text-red-400">{keywords.filter(k => k.action === 'block').length}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">{t('skw.reviewCount', locale)}</div>
          <div className="text-2xl font-bold text-yellow-400">{keywords.filter(k => k.action === 'review').length}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">{t('skw.enabledCount', locale)}</div>
          <div className="text-2xl font-bold text-green-400">{keywords.filter(k => k.enabled).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('skw.searchPlaceholder', locale)}
            className="w-full pl-9 pr-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-secondary/50 focus:outline-none focus:border-t-accent-blue"
          />
        </div>
        <Filter className="w-4 h-4 text-t-text-secondary" />
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
          className="bg-t-bg-secondary border border-t-border rounded px-3 py-2 text-sm text-t-text-primary"
        >
          <option value="">{t('skw.allCategories', locale)}</option>
          {categories.map(c => (
            <option key={c} value={c}>{t(`skw.cat.${c}`, locale)}</option>
          ))}
        </select>
        <select
          value={filterScope}
          onChange={e => { setFilterScope(e.target.value); setPage(1) }}
          className="bg-t-bg-secondary border border-t-border rounded px-3 py-2 text-sm text-t-text-primary"
        >
          <option value="">{t('skw.allScopes', locale)}</option>
          {scopes.map(s => (
            <option key={s} value={s}>{t(`skw.scopeOpts.${s}`, locale)}</option>
          ))}
        </select>
      </div>

      {/* Keywords Table */}
      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('skw.loading', locale)}</div>
      ) : keywords.length === 0 ? (
        <div className="text-center py-12 text-t-text-secondary">{t('skw.noKeywords', locale)}</div>
      ) : (
        <div className="bg-t-bg-secondary rounded-lg border border-t-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-t-border bg-t-bg-primary/50">
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">ID</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.keyword', locale)}</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.category', locale)}</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.severity', locale)}</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.action', locale)}</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.scope', locale)}</th>
                <th className="text-left px-4 py-3 text-t-text-secondary font-medium">{t('skw.status', locale)}</th>
                <th className="text-right px-4 py-3 text-t-text-secondary font-medium">{t('skw.actions', locale)}</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map(kw => (
                <tr key={kw.id} className="border-b border-t-border last:border-0 hover:bg-t-bg-primary/30 transition-colors">
                  <td className="px-4 py-3 text-t-text-secondary whitespace-nowrap">{kw.id}</td>
                  <td className="px-4 py-3 text-t-text-primary font-mono">{kw.keyword}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-t-bg-primary border border-t-border">
                      {t(`skw.cat.${kw.category}`, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${severityColors[kw.severity] || ''}`}>
                      {t(`skw.severityOpts.${kw.severity}`, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${actionColors[kw.action] || ''}`}>
                      {t(`skw.actionOpts.${kw.action}`, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-t-text-secondary">
                    {t(`skw.scopeOpts.${kw.scope}`, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: kw.id,
                          data: { enabled: kw.enabled ? 0 : 1 },
                        })
                      }
                      disabled={updateMutation.isPending}
                      className={`text-xs px-2 py-0.5 rounded ${
                        kw.enabled
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      } disabled:opacity-50`}
                    >
                      {kw.enabled ? t('skw.enabled', locale) : t('skw.disabled', locale)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(kw)}
                        className="p-1.5 rounded hover:bg-t-bg-primary text-t-text-secondary hover:text-t-accent-blue transition-colors"
                        title={t('skw.edit', locale)}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t('skw.confirmDelete', locale)?.replace('{word}', kw.keyword))) {
                            deleteMutation.mutate(kw.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded hover:bg-t-bg-primary text-t-text-secondary hover:text-red-400 transition-colors disabled:opacity-50"
                        title={t('skw.delete', locale)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded bg-t-bg-secondary border border-t-border text-sm disabled:opacity-50"
          >
            {t('reviews.previous', locale)}
          </button>
          <span className="text-sm text-t-text-secondary">
            {t('reviews.page', locale).replace('{page}', String(page)).replace('{total}', String(Math.ceil(pagination.total / pagination.limit)))}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(pagination.total / pagination.limit)}
            className="px-3 py-1.5 rounded bg-t-bg-secondary border border-t-border text-sm disabled:opacity-50"
          >
            {t('reviews.next', locale)}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-t-bg-secondary rounded-xl border border-t-border w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold text-t-text-primary">
                {editItem ? t('skw.editKeyword', locale) : t('skw.addKeyword', locale)}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-t-bg-primary text-t-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-t-text-secondary mb-1">{t('skw.keyword', locale)} *</label>
                <input
                  type="text"
                  value={formKeyword}
                  onChange={e => setFormKeyword(e.target.value)}
                  placeholder={t('skw.keywordPlaceholder', locale)}
                  className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary focus:outline-none focus:border-t-accent-blue"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1">{t('skw.category', locale)}</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{t(`skw.cat.${c}`, locale)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1">{t('skw.severity', locale)}</label>
                  <select
                    value={formSeverity}
                    onChange={e => setFormSeverity(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary"
                  >
                    <option value="low">{t('skw.severityOpts.low', locale)}</option>
                      <option value="medium">{t('skw.severityOpts.medium', locale)}</option>
                      <option value="high">{t('skw.severityOpts.high', locale)}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1">{t('skw.action', locale)}</label>
                  <select
                    value={formAction}
                    onChange={e => setFormAction(e.target.value as 'block' | 'review')}
                    className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary"
                  >
                    <option value="review">{t('skw.actionOpts.review', locale)}</option>
                      <option value="block">{t('skw.actionOpts.block', locale)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1">{t('skw.scope', locale)}</label>
                  <select
                    value={formScope}
                    onChange={e => setFormScope(e.target.value)}
                    className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary"
                  >
                    {scopes.map(s => (
                      <option key={s} value={s}>{t(`skw.scopeOpts.${s}`, locale)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-t-border">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-t-border text-sm text-t-text-secondary hover:bg-t-bg-primary transition-colors"
              >
                {t('common.cancel', locale)}
              </button>
              <button
                onClick={handleSave}
                disabled={!formKeyword.trim() || createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-t-accent-blue hover:bg-t-accent-blue/80 text-white text-sm disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" />
                {t('common.save', locale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-t-bg-secondary rounded-xl border border-t-border w-full max-w-lg mx-4 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold text-t-text-primary flex items-center gap-2">
                <Upload className="w-5 h-5" />
                {t('skw.batchImport', locale)}
              </h2>
              <button onClick={() => setShowBatchModal(false)} className="p-1 rounded hover:bg-t-bg-primary text-t-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-t-text-secondary">{t('skw.batchDesc', locale)}</p>
              <textarea
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={t('skw.batchPlaceholder', locale)}
                rows={10}
                className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-secondary/50 focus:outline-none focus:border-t-accent-blue font-mono resize-none"
              />
              <div className="text-xs text-t-text-secondary">
                {batchText ? `${batchText.split('\n').filter(l => l.trim()).length} ${t('skw.linesCount', locale)}` : ''}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-t-border">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-lg border border-t-border text-sm text-t-text-secondary hover:bg-t-bg-primary transition-colors"
              >
                {t('common.cancel', locale)}
              </button>
              <button
                onClick={handleBatchImport}
                disabled={!batchText.trim() || batchImportMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-t-accent-blue hover:bg-t-accent-blue/80 text-white text-sm disabled:opacity-50 transition-colors"
              >
                {batchImportMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {t('skw.importBtn', locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

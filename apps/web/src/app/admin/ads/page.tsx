'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import {
  Megaphone, Check, X, Pause, Play, Trash2, Eye, Filter, Plus, RefreshCw, Clock, BarChart3,
} from 'lucide-react'

interface Ad {
  id: number
  position: string
  title: string
  code: string
  status: string
  priority: number
  startAt: string | null
  endAt: string | null
  targetSections: string[] | null
  targetCategories: number[] | null
  maxImpressions: number | null
  maxClicks: number | null
  impressions: number
  clicks: number
  isActive: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
  ctr?: string
  review?: any
}

const AD_POSITIONS = [
  { value: 'header_banner', labelKey: 'ads.positionHeaderBanner' },
  { value: 'home_hero_below', labelKey: 'ads.positionHomeHeroBelow' },
  { value: 'home_list_inline', labelKey: 'ads.positionHomeListInline' },
  { value: 'section_sidebar', labelKey: 'ads.positionSectionSidebar' },
  { value: 'section_list_inline', labelKey: 'ads.positionSectionListInline' },
  { value: 'article_top', labelKey: 'ads.positionArticleTop' },
  { value: 'article_mid', labelKey: 'ads.positionArticleMid' },
  { value: 'article_bottom', labelKey: 'ads.positionArticleBottom' },
  { value: 'article_sidebar', labelKey: 'ads.positionArticleSidebar' },
  { value: 'footer_top', labelKey: 'ads.positionFooterTop' },
  { value: 'footer_bottom', labelKey: 'ads.positionFooterBottom' },
]

const statusColors: Record<string, string> = {
  pending_review: 'bg-yellow-500/20 text-yellow-400',
  draft: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-gray-500/20 text-gray-400',
  inactive: 'bg-red-500/20 text-red-400',
}

const statusKeyMap: Record<string, string> = {
  pending_review: 'ads.statusPendingReview',
  draft: 'ads.statusDraft',
  active: 'ads.statusActive',
  expired: 'ads.statusExpired',
  inactive: 'ads.statusInactive',
}

export default function AdsPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPosition, setFilterPosition] = useState<string>('')
  const [page, setPage] = useState(1)
  const [showDetail, setShowDetail] = useState<Ad | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: adsData, isLoading } = useQuery({
    queryKey: ['admin-ads', filterStatus, filterPosition, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filterStatus) params.set('status', filterStatus)
      if (filterPosition) params.set('position', filterPosition)
      return api.get(`/admin/ads?${params}`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.post(`/admin/ads/${id}/toggle`, { isActive }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/admin/ads/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      api.post(`/admin/ads/${id}/reject`, { note }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
  })

  const ads: Ad[] = adsData?.data || []
  const pagination = adsData?.pagination || { page: 1, limit: 20, total: 0 }

  const positionLabel = (pos: string) => {
    const entry = AD_POSITIONS.find(p => p.value === pos)
    return entry ? t(entry.labelKey, backendLocale) : pos
  }
  const statusLabel = (s: string) => statusKeyMap[s] ? t(statusKeyMap[s], backendLocale) : s

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-t-text-primary flex items-center gap-2">
          <Megaphone className="w-6 h-6" />
          {t('admin.ads', backendLocale)}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('ads.createAd', backendLocale)}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-t-text-secondary" />
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="bg-t-bg-primary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
          >
            <option value="">{t('ads.allStatus', backendLocale)}</option>
            {Object.entries(statusKeyMap).map(([k, v]) => (
              <option key={k} value={k}>{t(v, backendLocale)}</option>
            ))}
          </select>
        </div>
        <select
          value={filterPosition}
          onChange={e => { setFilterPosition(e.target.value); setPage(1) }}
          className="bg-t-bg-primary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
        >
          <option value="">{t('ads.allPositions', backendLocale)}</option>
          {AD_POSITIONS.map(p => (
            <option key={p.value} value={p.value}>{t(p.labelKey, backendLocale)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.loading', backendLocale)}</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.noData', backendLocale)}</div>
      ) : (
        <div className="bg-t-bg-primary rounded-xl border border-t-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-t-border text-t-text-secondary text-sm">
                <th className="px-4 py-3 text-left">{t('ads.id', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.title2', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.position', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.status', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.impressions', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.clicks', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.ctr', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.schedule', backendLocale)}</th>
                <th className="px-4 py-3 text-left">{t('ads.actions', backendLocale)}</th>
              </tr>
            </thead>
            <tbody>
              {ads.map(ad => (
                <tr key={ad.id} className="border-b border-t-border hover:bg-t-bg-secondary/50">
                  <td className="px-4 py-3 text-t-text-primary text-sm">{ad.id}</td>
                  <td className="px-4 py-3 text-t-text-primary text-sm font-medium">{ad.title}</td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{positionLabel(ad.position)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[ad.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {statusLabel(ad.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.impressions?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.clicks?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.ctr || '0.00'}%</td>
                  <td className="px-4 py-3 text-t-text-secondary text-xs">
                    {ad.startAt ? new Date(ad.startAt).toLocaleDateString() : t('ads.immediate', backendLocale)}
                    {' → '}
                    {ad.endAt ? new Date(ad.endAt).toLocaleDateString() : t('ads.permanent', backendLocale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowDetail(ad)}
                        className="p-1.5 rounded hover:bg-t-bg-secondary text-t-text-secondary hover:text-t-accent-blue"
                        title={t('ads.view', backendLocale)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {ad.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(ad.id)}
                            className="p-1.5 rounded hover:bg-green-500/10 text-green-400"
                            title={t('ads.approve', backendLocale)}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ id: ad.id })}
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                            title={t('ads.reject', backendLocale)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(ad.status === 'active' || ad.status === 'draft') && (
                        <button
                          onClick={() => toggleMutation.mutate({ id: ad.id, isActive: false })}
                          className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400"
                          title={t('ads.pause', backendLocale)}
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {ad.status === 'inactive' && (
                        <button
                          onClick={() => toggleMutation.mutate({ id: ad.id, isActive: true })}
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-400"
                          title={t('ads.resume', backendLocale)}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > 20 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-t-bg-primary border border-t-border text-t-text-primary disabled:opacity-50"
          >
            {t('ads.prev', backendLocale)}
          </button>
          <span className="px-3 py-1.5 text-t-text-secondary">{t('ads.page', backendLocale).replace('{page}', String(page))}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={ads.length < 20}
            className="px-3 py-1.5 rounded bg-t-bg-primary border border-t-border text-t-text-primary disabled:opacity-50"
          >
            {t('ads.next', backendLocale)}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
          <div className="bg-t-bg-primary rounded-xl border border-t-border p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-t-text-primary">{t('ads.detail', backendLocale)} #{showDetail.id}</h2>
              <button onClick={() => setShowDetail(null)} className="text-t-text-secondary hover:text-t-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailTitle', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.title}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailPosition', backendLocale)}:</span><span className="text-t-text-primary">{positionLabel(showDetail.position)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailStatus', backendLocale)}:</span><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[showDetail.status]}`}>{statusLabel(showDetail.status)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailPriority', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.priority}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailStart', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.startAt || t('ads.immediate', backendLocale)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailEnd', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.endAt || t('ads.permanent', backendLocale)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailTargetSections', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.targetSections?.join(', ') || t('ads.all', backendLocale)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailMaxImpressions', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.maxImpressions?.toLocaleString() || t('ads.unlimited', backendLocale)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailMaxClicks', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.maxClicks?.toLocaleString() || t('ads.unlimited', backendLocale)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.impressions', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.impressions?.toLocaleString()}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.clicks', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.clicks?.toLocaleString()}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.ctr', backendLocale)}:</span><span className="text-t-text-primary">{showDetail.ctr || '0.00'}%</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">{t('ads.detailCreated', backendLocale)}:</span><span className="text-t-text-primary">{new Date(showDetail.createdAt).toLocaleString()}</span></div>
              <div>
                <span className="text-t-text-secondary">{t('ads.adCode', backendLocale)}:</span>
                <pre className="mt-1 p-3 bg-t-bg-secondary rounded-lg text-xs text-t-text-primary overflow-x-auto max-h-48">
                  {showDetail.code}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateAdModal
          token={token!}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['admin-ads'] })
          }}
          locale={backendLocale}
        />
      )}
    </div>
  )
}

function CreateAdModal({ token, onClose, onSuccess, locale }: { token: string; onClose: () => void; onSuccess: () => void; locale: string }) {
  const [form, setForm] = useState({
    position: 'article_sidebar',
    title: '',
    code: '',
    priority: 0,
    startAt: '',
    endAt: '',
    targetSections: '',
    maxImpressions: '',
    maxClicks: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/admin/ads', {
        position: form.position,
        title: form.title,
        code: form.code,
        priority: form.priority || 0,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        targetSections: form.targetSections ? form.targetSections.split(',').map(s => s.trim()) : null,
        maxImpressions: form.maxImpressions ? parseInt(form.maxImpressions) : null,
        maxClicks: form.maxClicks ? parseInt(form.maxClicks) : null,
      }, { headers: { Authorization: `Bearer ${token}` } })
      onSuccess()
    } catch (err) {
      console.error('Create ad failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-t-bg-primary rounded-xl border border-t-border p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-t-text-primary">{t('ads.createTitle', locale)}</h2>
          <button onClick={onClose} className="text-t-text-secondary hover:text-t-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createPosition', locale)}</label>
            <select
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
            >
              {AD_POSITIONS.map(p => <option key={p.value} value={p.value}>{t(p.labelKey, locale)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createTitle2', locale)}</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createCode', locale)}</label>
            <textarea
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary h-32 font-mono"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createPriority', locale)}</label>
              <input
                type="number"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createTargetSections', locale)}</label>
              <input
                value={form.targetSections}
                onChange={e => setForm(f => ({ ...f, targetSections: e.target.value }))}
                placeholder={t('ads.createTargetSectionsPlaceholder', locale)}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createStartAt', locale)}</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createEndAt', locale)}</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createMaxImpressions', locale)}</label>
              <input
                type="number"
                value={form.maxImpressions}
                onChange={e => setForm(f => ({ ...f, maxImpressions: e.target.value }))}
                placeholder={t('ads.createMaxImpressionsPlaceholder', locale)}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">{t('ads.createMaxClicks', locale)}</label>
              <input
                type="number"
                value={form.maxClicks}
                onChange={e => setForm(f => ({ ...f, maxClicks: e.target.value }))}
                placeholder={t('ads.createMaxClicksPlaceholder', locale)}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">
              {t('ads.cancel', locale)}
            </button>
            <button
              type="submit"
              disabled={loading || !form.title || !form.code}
              className="px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('ads.creating', locale) : t('ads.createSubmit', locale)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

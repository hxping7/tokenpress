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
  { value: 'header_banner', label: 'Header Banner' },
  { value: 'home_hero_below', label: 'Home Hero Below' },
  { value: 'home_list_inline', label: 'Home List Inline' },
  { value: 'section_sidebar', label: 'Section Sidebar' },
  { value: 'section_list_inline', label: 'Section List Inline' },
  { value: 'article_top', label: 'Article Top' },
  { value: 'article_mid', label: 'Article Mid' },
  { value: 'article_bottom', label: 'Article Bottom' },
  { value: 'article_sidebar', label: 'Article Sidebar' },
  { value: 'footer_top', label: 'Footer Top' },
  { value: 'footer_bottom', label: 'Footer Bottom' },
]

const statusColors: Record<string, string> = {
  pending_review: 'bg-yellow-500/20 text-yellow-400',
  draft: 'bg-blue-500/20 text-blue-400',
  active: 'bg-green-500/20 text-green-400',
  expired: 'bg-gray-500/20 text-gray-400',
  inactive: 'bg-red-500/20 text-red-400',
}

const statusLabels: Record<string, string> = {
  pending_review: 'Pending Review',
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
  inactive: 'Inactive',
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

  const positionLabel = (pos: string) => AD_POSITIONS.find(p => p.value === pos)?.label || pos

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
          Create Ad
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
            <option value="">All Status</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <select
          value={filterPosition}
          onChange={e => { setFilterPosition(e.target.value); setPage(1) }}
          className="bg-t-bg-primary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
        >
          <option value="">All Positions</option>
          {AD_POSITIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
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
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Impressions</th>
                <th className="px-4 py-3 text-left">Clicks</th>
                <th className="px-4 py-3 text-left">CTR</th>
                <th className="px-4 py-3 text-left">Schedule</th>
                <th className="px-4 py-3 text-left">Actions</th>
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
                      {statusLabels[ad.status] || ad.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.impressions?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.clicks?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-t-text-secondary text-sm">{ad.ctr || '0.00'}%</td>
                  <td className="px-4 py-3 text-t-text-secondary text-xs">
                    {ad.startAt ? new Date(ad.startAt).toLocaleDateString() : 'Now'}
                    {' → '}
                    {ad.endAt ? new Date(ad.endAt).toLocaleDateString() : '∞'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowDetail(ad)}
                        className="p-1.5 rounded hover:bg-t-bg-secondary text-t-text-secondary hover:text-t-accent-blue"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {ad.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(ad.id)}
                            className="p-1.5 rounded hover:bg-green-500/10 text-green-400"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ id: ad.id })}
                            className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(ad.status === 'active' || ad.status === 'draft') && (
                        <button
                          onClick={() => toggleMutation.mutate({ id: ad.id, isActive: false })}
                          className="p-1.5 rounded hover:bg-yellow-500/10 text-yellow-400"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {ad.status === 'inactive' && (
                        <button
                          onClick={() => toggleMutation.mutate({ id: ad.id, isActive: true })}
                          className="p-1.5 rounded hover:bg-green-500/10 text-green-400"
                          title="Resume"
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
            Prev
          </button>
          <span className="px-3 py-1.5 text-t-text-secondary">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={ads.length < 20}
            className="px-3 py-1.5 rounded bg-t-bg-primary border border-t-border text-t-text-primary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetail(null)}>
          <div className="bg-t-bg-primary rounded-xl border border-t-border p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-t-text-primary">Ad #{showDetail.id}</h2>
              <button onClick={() => setShowDetail(null)} className="text-t-text-secondary hover:text-t-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Title:</span><span className="text-t-text-primary">{showDetail.title}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Position:</span><span className="text-t-text-primary">{positionLabel(showDetail.position)}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Status:</span><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[showDetail.status]}`}>{statusLabels[showDetail.status]}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Priority:</span><span className="text-t-text-primary">{showDetail.priority}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Start:</span><span className="text-t-text-primary">{showDetail.startAt || 'Immediate'}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">End:</span><span className="text-t-text-primary">{showDetail.endAt || 'Permanent'}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Target Sections:</span><span className="text-t-text-primary">{showDetail.targetSections?.join(', ') || 'All'}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Max Impressions:</span><span className="text-t-text-primary">{showDetail.maxImpressions?.toLocaleString() || 'Unlimited'}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Max Clicks:</span><span className="text-t-text-primary">{showDetail.maxClicks?.toLocaleString() || 'Unlimited'}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Impressions:</span><span className="text-t-text-primary">{showDetail.impressions?.toLocaleString()}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Clicks:</span><span className="text-t-text-primary">{showDetail.clicks?.toLocaleString()}</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">CTR:</span><span className="text-t-text-primary">{showDetail.ctr || '0.00'}%</span></div>
              <div className="flex gap-2"><span className="text-t-text-secondary w-28">Created:</span><span className="text-t-text-primary">{new Date(showDetail.createdAt).toLocaleString()}</span></div>
              <div>
                <span className="text-t-text-secondary">Ad Code:</span>
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
        />
      )}
    </div>
  )
}

function CreateAdModal({ token, onClose, onSuccess }: { token: string; onClose: () => void; onSuccess: () => void }) {
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
          <h2 className="text-lg font-bold text-t-text-primary">Create Ad</h2>
          <button onClick={onClose} className="text-t-text-secondary hover:text-t-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">Position *</label>
            <select
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
            >
              {AD_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-t-text-secondary mb-1">Ad Code (HTML/JS) *</label>
            <textarea
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary h-32 font-mono"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">Priority</label>
              <input
                type="number"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">Target Sections</label>
              <input
                value={form.targetSections}
                onChange={e => setForm(f => ({ ...f, targetSections: e.target.value }))}
                placeholder="blog, ai_coding"
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">Start At</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))}
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">End At</label>
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
              <label className="block text-sm text-t-text-secondary mb-1">Max Impressions</label>
              <input
                type="number"
                value={form.maxImpressions}
                onChange={e => setForm(f => ({ ...f, maxImpressions: e.target.value }))}
                placeholder="Unlimited"
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-t-text-secondary mb-1">Max Clicks</label>
              <input
                type="number"
                value={form.maxClicks}
                onChange={e => setForm(f => ({ ...f, maxClicks: e.target.value }))}
                placeholder="Unlimited"
                className="w-full bg-t-bg-secondary border border-t-border rounded-lg px-3 py-2 text-sm text-t-text-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title || !form.code}
              className="px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

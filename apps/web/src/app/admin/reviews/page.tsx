'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Check, X, RefreshCw, Shield, Clock, AlertTriangle, Eye, Filter } from 'lucide-react'

interface ContentReview {
  id: number
  target_type: string
  target_id: number
  version: number
  content_snapshot: string | null
  image_urls_json: string | null
  local_scan_status: string
  local_matched_words: string | null
  cloud_provider: string | null
  cloud_text_status: string
  cloud_image_status: string
  cloud_label: string | null
  cloud_score: number | null
  cloud_detail_json: string | null
  manual_status: string
  manual_reviewer: number | null
  manual_reviewed_at: string | null
  manual_note: string | null
  final_verdict: string
  created_at: string
  updated_at: string
}

const targetTypeLabels: Record<string, string> = {
  article: 'Article',
  media: 'Media',
  ad: 'Ad',
  friend_link: 'Friend Link',
  site_setting: 'Site Setting',
}

const verdictColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  pass: 'bg-green-500/20 text-green-400',
  reject: 'bg-red-500/20 text-red-400',
  error: 'bg-gray-500/20 text-gray-400',
}

export default function ReviewsPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const [filterVerdict, setFilterVerdict] = useState<string>('pending')
  const [filterType, setFilterType] = useState<string>('')
  const [page, setPage] = useState(1)
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({})

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['admin-reviews', filterVerdict, filterType, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filterVerdict) params.set('verdict', filterVerdict)
      if (filterType) params.set('targetType', filterType)
      return api.get(`/admin/reviews?${params}`)
    },
  })

  const { data: statsData } = useQuery({
    queryKey: ['admin-reviews-stats'],
    queryFn: () => api.get('/admin/reviews/stats'),
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/admin/reviews/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-stats'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      api.post(`/admin/reviews/${id}/reject`, { note }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-stats'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (id: number) => api.post(`/admin/reviews/${id}/retry`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] })
    },
  })

  const reviews: ContentReview[] = reviewsData?.data || []
  const pagination = reviewsData?.pagination || { page: 1, limit: 20, total: 0 }
  const stats = statsData?.data || { pending: 0, approvedToday: 0, rejectedToday: 0, total: 0 }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString()
  }

  function getMatchedWords(review: ContentReview): string[] {
    if (!review.local_matched_words) return []
    try { return JSON.parse(review.local_matched_words) } catch { return [] }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-t-text-primary flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Content Review
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">Approved Today</div>
          <div className="text-2xl font-bold text-green-400">{stats.approvedToday}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">Rejected Today</div>
          <div className="text-2xl font-bold text-red-400">{stats.rejectedToday}</div>
        </div>
        <div className="bg-t-bg-secondary rounded-lg p-4 border border-t-border">
          <div className="text-sm text-t-text-secondary">Total</div>
          <div className="text-2xl font-bold text-t-text-primary">{stats.total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-t-text-secondary" />
        <select
          value={filterVerdict}
          onChange={e => { setFilterVerdict(e.target.value); setPage(1) }}
          className="bg-t-bg-secondary border border-t-border rounded px-3 py-1.5 text-sm text-t-text-primary"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="pass">Passed</option>
          <option value="reject">Rejected</option>
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="bg-t-bg-secondary border border-t-border rounded px-3 py-1.5 text-sm text-t-text-primary"
        >
          <option value="">All Types</option>
          <option value="article">Article</option>
          <option value="media">Media</option>
          <option value="ad">Ad</option>
          <option value="friend_link">Friend Link</option>
        </select>
      </div>

      {/* Review List */}
      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">Loading...</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-t-text-secondary">No reviews found</div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => {
            const matchedWords = getMatchedWords(review)
            return (
              <div key={review.id} className="bg-t-bg-secondary rounded-lg border border-t-border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-t-accent-blue/20 text-t-accent-blue font-medium">
                        {targetTypeLabels[review.target_type] || review.target_type}
                      </span>
                      <span className="text-xs text-t-text-secondary">#{review.target_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${verdictColors[review.final_verdict] || ''}`}>
                        {review.final_verdict}
                      </span>
                      {review.cloud_provider && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          {review.cloud_provider}
                        </span>
                      )}
                    </div>

                    {/* Local scan result */}
                    <div className="flex items-center gap-4 text-sm text-t-text-secondary mb-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Local: {review.local_scan_status}
                      </span>
                      <span>Text: {review.cloud_text_status}</span>
                      <span>Image: {review.cloud_image_status}</span>
                    </div>

                    {/* Matched keywords */}
                    {matchedWords.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs text-yellow-400">Keywords:</span>
                        {matchedWords.map((w, i) => (
                          <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                            {w}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Cloud result */}
                    {review.cloud_label && (
                      <div className="text-xs text-t-text-secondary mt-1">
                        Cloud: {review.cloud_label}
                        {review.cloud_score != null && ` (score: ${review.cloud_score})`}
                      </div>
                    )}

                    {/* Content snapshot */}
                    {review.content_snapshot && (
                      <div className="mt-2 text-xs text-t-text-secondary bg-t-bg-primary rounded p-2 max-h-20 overflow-hidden">
                        {review.content_snapshot.slice(0, 200)}
                        {review.content_snapshot.length > 200 ? '...' : ''}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs text-t-text-secondary">
                      <Clock className="w-3 h-3" />
                      {formatTime(review.created_at)}
                      {review.manual_reviewed_at && (
                        <span className="ml-2">Reviewed: {formatTime(review.manual_reviewed_at)}</span>
                      )}
                      {review.manual_note && (
                        <span className="ml-2 text-t-text-primary">Note: {review.manual_note}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {review.final_verdict === 'pending' && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => approveMutation.mutate(review.id)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const note = rejectNote[review.id] || ''
                          rejectMutation.mutate({ id: review.id, note: note || undefined })
                        }}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                      <button
                        onClick={() => retryMutation.mutate(review.id)}
                        disabled={retryMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded bg-t-bg-primary border border-t-border hover:bg-t-bg-primary/80 text-t-text-secondary text-sm disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Reject note input */}
                {review.final_verdict === 'pending' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Rejection note (optional)"
                      value={rejectNote[review.id] || ''}
                      onChange={e => setRejectNote(prev => ({ ...prev, [review.id]: e.target.value }))}
                      className="w-full bg-t-bg-primary border border-t-border rounded px-3 py-1.5 text-sm text-t-text-primary placeholder:text-t-text-secondary/50"
                    />
                  </div>
                )}
              </div>
            )
          })}
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
            Previous
          </button>
          <span className="text-sm text-t-text-secondary">
            Page {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(pagination.total / pagination.limit)}
            className="px-3 py-1.5 rounded bg-t-bg-secondary border border-t-border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

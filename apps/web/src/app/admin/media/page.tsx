'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Search, Trash2, Eye, Image as ImageIcon, Video, Download, X, Play, Upload, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react'

type DisplayMode = 'large' | 'medium' | 'small' | 'list'

interface Media {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  createdAt: string
}

export default function MediaPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLDivElement | HTMLTableRowElement>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('medium')
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: mediaData, isLoading } = useQuery({
    queryKey: ['admin-media', search, typeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (typeFilter) params.append('type', typeFilter)
      params.append('page', String(page))
      params.append('limit', '24')
      return api.get(`/media?${params}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/media/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-media'] }),
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/media/batch-delete', { ids }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-media'] })
      setSelectedItems([])
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader()
      return new Promise<{ file: string; filename: string; mimeType: string }>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve({
            file: base64,
            filename: file.name,
            mimeType: file.type,
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
  })

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        const { file: base64Data, filename, mimeType } = await uploadMutation.mutateAsync(file)
        await api.post('/media', { file: base64Data, filename, mimeType }, { headers: { Authorization: `Bearer ${token}` } })
      }
      queryClient.invalidateQueries({ queryKey: ['admin-media'] })
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFileUpload(e.dataTransfer.files)
  }, [token])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isVideo = (mime: string) => mime.startsWith('video/')
  const isImage = (mime: string) => mime.startsWith('image/')
  const isDocument = (mime: string) => !isImage(mime) && !isVideo(mime)

  const getDocumentIcon = (mime: string) => {
    if (mime.includes('spreadsheet') || mime.includes('xlsx') || mime.includes('excel')) return FileSpreadsheet
    if (mime.includes('presentation') || mime.includes('ppt')) return Presentation
    if (mime.includes('pdf') || mime.includes('word') || mime.includes('document') || mime.includes('text') || mime.includes('markdown')) return FileText
    return File
  }

  const getGridCols = (mode: DisplayMode) => {
    switch (mode) {
      case 'large': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      case 'medium': return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
      case 'small': return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
      default: return 'grid-cols-1'
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // 滚动到高亮的媒体
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, mediaData])

  const toggleSelectAll = () => {
    if (selectedItems.length === mediaData?.data?.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(mediaData?.data?.map((m: Media) => m.id) || [])
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('media.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('media.desc', backendLocale)}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Display Mode */}
          <div className="flex bg-t-bg-primary border border-t-border rounded-lg overflow-hidden">
            <button
              onClick={() => setDisplayMode('large')}
              className={`px-3 py-2 text-sm ${displayMode === 'large' ? 'bg-t-accent-blue text-white' : 'text-t-text-secondary hover:text-t-text-primary'}`}
              title={t('media.thumbnailLarge', backendLocale)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="12" y="2" width="6" height="6" rx="1"/><rect x="2" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/></svg>
            </button>
            <button
              onClick={() => setDisplayMode('medium')}
              className={`px-3 py-2 text-sm ${displayMode === 'medium' ? 'bg-t-accent-blue text-white' : 'text-t-text-secondary hover:text-t-text-primary'}`}
              title={t('media.thumbnailMedium', backendLocale)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>
            </button>
            <button
              onClick={() => setDisplayMode('small')}
              className={`px-3 py-2 text-sm ${displayMode === 'small' ? 'bg-t-accent-blue text-white' : 'text-t-text-secondary hover:text-t-text-primary'}`}
              title={t('media.thumbnailSmall', backendLocale)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="2" y="2" width="4" height="4" rx="0.5"/><rect x="8" y="2" width="4" height="4" rx="0.5"/><rect x="14" y="2" width="4" height="4" rx="0.5"/><rect x="2" y="8" width="4" height="4" rx="0.5"/><rect x="8" y="8" width="4" height="4" rx="0.5"/><rect x="14" y="8" width="4" height="4" rx="0.5"/><rect x="2" y="14" width="4" height="4" rx="0.5"/><rect x="8" y="14" width="4" height="4" rx="0.5"/><rect x="14" y="14" width="4" height="4" rx="0.5"/></svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-2 text-sm ${displayMode === 'list' ? 'bg-t-accent-blue text-white' : 'text-t-text-secondary hover:text-t-text-primary'}`}
              title={t('media.listView', backendLocale)}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="3" rx="0.5"/><rect x="2" y="8.5" width="16" height="3" rx="0.5"/><rect x="2" y="14" width="16" height="3" rx="0.5"/></svg>
            </button>
          </div>
          {/* Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Upload size={18} />
            {isUploading ? t('media.uploading', backendLocale) : t('media.upload', backendLocale)}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-text-secondary" size={18} />
          <input
            type="text"
            placeholder={t('media.searchPlaceholder', backendLocale)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary placeholder-t-text-secondary focus:outline-none focus:border-t-accent-blue"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
        >
          <option value="">{t('media.allTypes', backendLocale)}</option>
          <option value="image">{t('media.images', backendLocale)}</option>
          <option value="video">{t('media.videos', backendLocale)}</option>
          <option value="document">{t('media.documents', backendLocale)}</option>
        </select>
      </div>

      {/* Batch Actions */}
      {selectedItems.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-t-accent-blue/10 border border-t-accent-blue/30 rounded-lg">
          <span className="text-sm text-t-text-primary">
            {t('media.selected', backendLocale)}: {selectedItems.length} {t('media.items', backendLocale)}
          </span>
          <button
            onClick={() => { if (confirm(t('media.confirmDelete', backendLocale))) batchDeleteMutation.mutate(selectedItems) }}
            className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            {t('media.batchDelete', backendLocale)}
          </button>
          <button
            onClick={() => setSelectedItems([])}
            className="px-3 py-1 text-sm text-t-text-secondary hover:text-t-text-primary"
          >
            {t('media.deselectAll', backendLocale)}
          </button>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-t-border rounded-lg p-6 text-center hover:border-t-accent-blue/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto mb-2 text-t-text-secondary" size={32} />
        <p className="text-t-text-secondary">{t('media.dragOrClick', backendLocale)}</p>
        <p className="text-xs text-t-text-secondary mt-1">{t('media.supportedFormats', backendLocale)}</p>
      </div>

      {/* Media Grid/List */}
      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.loading', backendLocale)}</div>
      ) : mediaData?.data?.length === 0 ? (
        <div className="text-center py-12 text-t-text-secondary">
          <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t('media.noMedia', backendLocale)}</p>
        </div>
      ) : displayMode === 'list' ? (
        /* List View */
        <div className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-t-bg-secondary border-b border-t-border">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === mediaData?.data?.length && mediaData?.data?.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-t-text-secondary">{t('media.fileName', backendLocale)}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-t-text-secondary">{t('media.fileType', backendLocale)}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-t-text-secondary">{t('media.fileSize', backendLocale)}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-t-text-secondary">{t('media.uploadTime', backendLocale)}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-t-text-secondary">{t('media.actions', backendLocale)}</th>
              </tr>
            </thead>
            <tbody>
              {mediaData?.data?.map((media: Media) => {
                const IconComponent = isDocument(media.mimeType) ? getDocumentIcon(media.mimeType) : (isVideo(media.mimeType) ? Video : ImageIcon)
                const isHighlighted = highlightId === String(media.id)
                return (
                  <tr
                    key={media.id}
                    ref={isHighlighted ? highlightRef as React.RefObject<HTMLTableRowElement> : undefined}
                    className={`border-b border-t-border hover:bg-t-bg-secondary/50 ${isHighlighted ? 'bg-t-accent-blue/10 ring-2 ring-t-accent-blue ring-inset' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(media.id)}
                        onChange={() => toggleSelect(media.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-t-bg-secondary rounded flex items-center justify-center flex-shrink-0">
                          {isImage(media.mimeType) ? (
                            <img src={media.thumbnailUrl || media.url} alt="" className="w-full h-full object-cover rounded" />
                          ) : (
                            <IconComponent size={18} className="text-t-text-secondary" />
                          )}
                        </div>
                        <span className="truncate max-w-[200px]">{media.originalName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-t-text-secondary">{media.mimeType}</td>
                    <td className="px-4 py-3 text-sm text-t-text-secondary">{formatSize(media.size)}</td>
                    <td className="px-4 py-3 text-sm text-t-text-secondary">{new Date(media.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setPreviewMedia(media)} className="p-1.5 hover:bg-t-bg-secondary rounded"><Eye size={16} /></button>
                        <a href={media.url} target="_blank" download className="p-1.5 hover:bg-t-bg-secondary rounded"><Download size={16} /></a>
                        <button onClick={() => { if (confirm(t('common.confirmDelete', backendLocale))) deleteMutation.mutate(media.id) }} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Thumbnail Grid */
        <div className={`grid ${getGridCols(displayMode)} gap-4`}>
          {mediaData?.data?.map((media: Media) => {
            const IconComponent = isDocument(media.mimeType) ? getDocumentIcon(media.mimeType) : (isVideo(media.mimeType) ? Video : ImageIcon)
            const isHighlighted = highlightId === String(media.id)
            return (
              <div
                key={media.id}
                ref={isHighlighted ? highlightRef as React.RefObject<HTMLDivElement> : undefined}
                className={`bg-t-bg-primary border rounded-xl overflow-hidden group hover:border-t-accent-blue/30 transition-colors ${isHighlighted ? 'border-t-accent-blue ring-2 ring-t-accent-blue' : 'border-t-border'}`}
              >
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(media.id)}
                    onChange={() => toggleSelect(media.id)}
                    className="rounded"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {/* Thumbnail */}
                <div className="aspect-square relative bg-t-bg-secondary">
                  {media.thumbnailUrl || isImage(media.mimeType) ? (
                    <img
                      src={media.thumbnailUrl || media.url}
                      alt={media.originalName}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setPreviewMedia(media)}
                    />
                  ) : isVideo(media.mimeType) ? (
                    <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => setPreviewMedia(media)}>
                      <Video size={32} className="text-t-text-secondary" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => setPreviewMedia(media)}>
                      <IconComponent size={32} className="text-t-text-secondary" />
                    </div>
                  )}
                  {/* Play icon for videos */}
                  {isVideo(media.mimeType) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center">
                        <Play size={20} className="text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => setPreviewMedia(media)} className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <Eye size={18} />
                    </button>
                    <a href={media.url} target="_blank" download className="p-2 bg-white/20 rounded-full hover:bg-white/30">
                      <Download size={18} />
                    </a>
                    <button onClick={() => { if (confirm(t('common.confirmDelete', backendLocale))) deleteMutation.mutate(media.id) }} className="p-2 bg-red-500/50 rounded-full hover:bg-red-500/70">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{media.originalName}</p>
                  <p className="text-xs text-t-text-secondary">{formatSize(media.size)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Pagination */}
      {mediaData?.pagination && mediaData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-t-bg-primary border border-t-border text-t-text-secondary hover:text-t-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &larr;
          </button>
          <span className="text-sm text-t-text-secondary">
            {page} / {mediaData.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(mediaData.pagination.totalPages, p + 1))}
            disabled={page >= mediaData.pagination.totalPages}
            className="px-3 py-1.5 rounded-lg bg-t-bg-primary border border-t-border text-t-text-secondary hover:text-t-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &rarr;
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewMedia(null)} />
          <div className="relative z-10 max-w-4xl max-h-[90vh] flex flex-col items-center">
            {isVideo(previewMedia.mimeType) ? (
              <video src={previewMedia.url} controls className="max-h-[85vh] rounded-lg" />
            ) : isImage(previewMedia.mimeType) ? (
              <img src={previewMedia.url} alt={previewMedia.originalName} className="max-h-[85vh] rounded-lg" />
            ) : (
              <div className="bg-t-bg-primary rounded-lg p-8 text-center">
                {(() => {
                  const IconComponent = getDocumentIcon(previewMedia.mimeType)
                  return <IconComponent size={64} className="mx-auto mb-4 text-t-accent-blue" />
                })()}
                <p className="text-lg font-medium mb-2">{previewMedia.originalName}</p>
                <p className="text-sm text-t-text-secondary mb-4">{previewMedia.mimeType} - {formatSize(previewMedia.size)}</p>
                <a href={previewMedia.url} target="_blank" download className="inline-flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-white rounded-lg hover:opacity-90">
                  <Download size={18} />
                  {t('media.download', backendLocale) || 'Download'}
                </a>
              </div>
            )}
            <button
              onClick={() => setPreviewMedia(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-t-accent-blue"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

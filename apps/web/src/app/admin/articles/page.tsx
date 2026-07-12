'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { t } from '@/lib/i18n'
import { toast } from '@/components/ui/Toast'
import {
  Plus, Search, Edit, Trash2, Eye,
  X, Check, Image as ImageIcon, Loader2, Upload, Bold, Palette, Shuffle,
  ChevronLeft, ChevronRight, ChevronsUpDown, ChevronsUp, ChevronsDown, Pin
} from 'lucide-react'
import Link from 'next/link'

interface Article {
  id: number
  title: string
  slug: string
  section: { id: number; name: string; slug: string; path: string }
  categoryId: number | null
  status: 'draft' | 'published' | 'archived' | 'scheduled' | 'pending_review'
  coverImage: string | null
  authorId: number
  pinnedScope?: 'global' | 'section' | null | string
  author_name?: string
  category_name?: string
  content?: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

interface Category {
  id: number
  name: string
  section: { id: number; name: string; slug: string; path: string }
}

interface Section {
  id: number
  name: string
  slug: string
  path: string
  description: string | null
  isActive: number
}

// 标题颜色选项
const titleColors = [
  { value: '', label: '默认' },
  { value: '#60c0ff', label: '蓝色' },
  { value: '#7c3aed', label: '紫色' },
  { value: '#10b981', label: '绿色' },
  { value: '#f59e0b', label: '橙色' },
  { value: '#ef4444', label: '红色' },
  { value: '#ec4899', label: '粉色' },
]

export default function ArticlesPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement>(null)
  const [search, setSearch] = useState('')
  const [section, setSection] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<'title' | 'section' | 'status' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showEditor, setShowEditor] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [loadingArticle, setLoadingArticle] = useState(false)

  // 获取板块名称的辅助函数
  const getSectionName = (slug: string): string => {
    const section = sectionsData?.data?.find((s: Section) => s.slug === slug)
    return section?.name || slug || '-'
  }

  // Editor state
  const [title, setTitle] = useState('')
  const [titleBold, setTitleBold] = useState(false)
  const [titleColor, setTitleColor] = useState('')
  const [content, setContent] = useState('')
  const [editorSection, setEditorSection] = useState<string>('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [coverImage, setCoverImage] = useState('')
  const [articleStatus, setArticleStatus] = useState<'draft' | 'published' | 'scheduled' | 'pending_review'>('draft')
  const [scheduledAt, setScheduledAt] = useState('')
  const [tags, setTags] = useState('')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  // 批量管理状态
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [batchStatus, setBatchStatus] = useState('')
  const [batchCategory, setBatchCategory] = useState('')
  const [batchSection, setBatchSection] = useState('')
  const [isApplying, setIsApplying] = useState(false)

  // 批量置顶状态
  const [batchPinScope, setBatchPinScope] = useState('')

  // 单篇置顶
  const pinMutation = useMutation({
    mutationFn: ({ id, scope }: { id: number; scope: 'none' | 'global' | 'section' }) =>
      api.updateArticle(id, { pinnedScope: scope }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-articles'] }),
    onError: (err: any) => toast.error(err?.message || t('articles.batchFailed', backendLocale)),
  })

  // 批量置顶
  const batchPinMutation = useMutation({
    mutationFn: (scope: 'none' | 'global' | 'section') =>
      api.batchArticles('updatePin', selectedItems, { pinnedScope: scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setSelectedItems([])
      setBatchPinScope('')
      toast.success(t('articles.pinUpdated', backendLocale))
    },
    onError: (err: any) => toast.error(err?.message || t('articles.batchFailed', backendLocale)),
  })

  const coverInputRef = useRef<HTMLInputElement>(null)

  // 媒体库数据
  const { data: mediaData } = useQuery({
    queryKey: ['cover-media'],
    queryFn: () => api.getMedia({ limit: 50 }),
  })

  // 板块数据（动态获取）
  const { data: sectionsData } = useQuery({
    queryKey: ['admin-sections'],
    queryFn: () => api.get('/sections'),
  })

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ['admin-articles', search, section, status, page, pageSize, sortField, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('limit', String(pageSize))
      params.append('sort', sortField)
      params.append('order', sortOrder)
      if (search) params.append('search', search)
      if (section) params.append('section', section)
      if (status) params.append('status', status)
      return api.get(`/admin/articles?${params}`)
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/categories'),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setShowEditor(false)
      resetEditor()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateArticle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setShowEditor(false)
      setEditingArticle(null)
      resetEditor()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteArticle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-articles'] }),
  })

  const batchUpdateMutation = useMutation({
    mutationFn: ({ action, data }: { action: 'updateStatus' | 'updateCategory' | 'updateSection'; data: any }) =>
      api.batchArticles(action, selectedItems, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setSelectedItems([])
      setBatchStatus('')
      setBatchCategory('')
      setBatchSection('')
      toast.success(res?.message || t('articles.batchApplied', backendLocale))
    },
    onError: (err: any) => {
      toast.error(err?.message || t('articles.batchFailed', backendLocale))
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: () => api.batchArticles('delete', selectedItems),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setSelectedItems([])
      setBatchStatus('')
      setBatchCategory('')
      setBatchSection('')
      toast.success(res?.message || t('articles.batchDeleted', backendLocale))
    },
    onError: (err: any) => {
      toast.error(err?.message || t('articles.batchFailed', backendLocale))
    },
  })

  // 当前页文章 ID（用于本页全选）
  const pageIds: number[] = articlesData?.data?.map((a: Article) => a.id) ?? []

  const toggleSelect = (id: number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedItems.includes(id))
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !pageIds.includes(id)))
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const applyBatchStatus = () => {
    if (!batchStatus) return
    batchUpdateMutation.mutate({ action: 'updateStatus', data: { status: batchStatus } })
  }

  const applySectionAndCategory = async () => {
    if (!batchSection) return
    const items = [...selectedItems]           // 快照，防止异步间状态变更
    const sid = Number(batchSection)
    const cid = batchCategory === '0' ? null : batchCategory ? Number(batchCategory) : null

    setIsApplying(true)
    try {
      await api.batchArticles('updateSection', items, { sectionId: sid })
      if (batchCategory) {
        await api.batchArticles('updateCategory', items, { categoryId: cid })
      }
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] })
      setSelectedItems([])
      setBatchSection('')
      setBatchCategory('')
      setBatchStatus('')
      toast.success(t('articles.batchApplied', backendLocale))
    } catch (err: any) {
      toast.error(err?.message || t('articles.batchFailed', backendLocale))
    } finally {
      setIsApplying(false)
    }
  }

  // 滚动到高亮的文章
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, articlesData])

  const resetEditor = () => {
    setTitle('')
    setTitleBold(false)
    setTitleColor('')
    setContent('')
    setEditorSection('')
    setCategoryId(null)
    setCoverImage('')
    setArticleStatus('draft')
    setScheduledAt('')
    setTags('')
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSectionChange = (value: string) => {
    setSection(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={14} className="text-t-text-secondary/50" />
    return sortOrder === 'asc'
      ? <ChevronsUp size={14} className="text-t-accent-blue" />
      : <ChevronsDown size={14} className="text-t-accent-blue" />
  }

  // 封面图上传
  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true)
    try {
      const res = await api.uploadMedia(file)
      setCoverImage(res.data.url)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('上传失败')
    } finally {
      setUploadingCover(false)
    }
  }

  // 随机封面服务
  const getRandomCover = () => {
    const randomUrl = `https://picsum.photos/1200/630?random=${Date.now()}`
    setCoverImage(randomUrl)
  }

  // 生成格式化标题 HTML
  const formatTitle = (rawTitle: string, bold: boolean, color: string): string => {
    if (!bold && !color) return rawTitle
    let styled = rawTitle
    if (color) {
      styled = `<span style="color:${color}">${styled}</span>`
    }
    if (bold) {
      styled = `<strong>${styled}</strong>`
    }
    return styled
  }

  // 从格式化标题中提取纯文本和样式
  const parseTitle = (formattedTitle: string): { text: string; bold: boolean; color: string } => {
    let text = formattedTitle
    let bold = false
    let color = ''

    // 检查是否包含加粗标签
    if (text.includes('<strong>')) {
      bold = true
      text = text.replace(/<\/?strong>/g, '')
    }

    // 检查是否包含颜色样式
    const colorMatch = text.match(/style="color:([^"]+)"/)
    if (colorMatch) {
      color = colorMatch[1]
      text = text.replace(/<span style="color:[^"]+">/, '').replace(/<\/span>/, '')
    }

    return { text, bold, color }
  }

  // Load article content when editing
  const loadArticleContent = async (article: Article) => {
    setLoadingArticle(true)
    try {
      const res = await api.getAdminArticle(article.id)
      const fullArticle = res.data
      setContent(fullArticle.content || '')
      if (fullArticle.tags?.length) {
        setTags(fullArticle.tags.join(', '))
      }
    } catch (err) {
      console.error('Failed to load article content:', err)
      setContent('')
    } finally {
      setLoadingArticle(false)
    }
  }

  const openEditor = async (article?: Article) => {
    if (article) {
      setEditingArticle(article)
      // 解析标题样式
      const { text, bold, color } = parseTitle(article.title)
      setTitle(text)
      setTitleBold(bold)
      setTitleColor(color)
      setEditorSection(article.section?.slug || '')
      setCategoryId(article.categoryId)
      setCoverImage(article.coverImage || '')
      setArticleStatus(article.status as 'draft' | 'published' | 'scheduled' | 'pending_review')
      if (article.status === 'scheduled' && article.publishedAt) {
        const d = new Date(article.publishedAt)
        setScheduledAt(d.toISOString().slice(0, 16))
      } else {
        setScheduledAt('')
      }
      await loadArticleContent(article)
    } else {
      setEditingArticle(null)
      resetEditor()
    }
    setShowEditor(true)
  }

  const handleSubmit = () => {
    // 生成格式化标题
    const formattedTitle = formatTitle(title, titleBold, titleColor)

    const data: any = {
      title: formattedTitle,
      content,
      section: editorSection,
      categoryId: categoryId || undefined,
      coverImage: coverImage || undefined,
      status: articleStatus,
    }

    if (articleStatus === 'scheduled' && scheduledAt) {
      data.publishedAt = new Date(scheduledAt).toISOString()
    }

    if (tags.trim()) {
      data.tags = tags.split(',').map(t => t.trim()).filter(Boolean)
    }

    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const categories = categoriesData?.data?.filter((c: Category) => 
    editorSection ? c.section?.slug === editorSection : true
  ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('articles.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('articles.desc', backendLocale)}</p>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 transition-colors"
        >
          <Plus size={18} />
          {t('articles.newArticle', backendLocale)}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-text-secondary" size={18} />
          <input
            type="text"
            placeholder={t('articles.searchPlaceholder', backendLocale)}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary placeholder-t-text-secondary focus:outline-none focus:border-t-accent-blue"
          />
        </div>
        <select
          value={section}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
        >
          <option value="">{t('articles.allCategories', backendLocale)}</option>
          {sectionsData?.data?.map((s: Section) => (
            <option key={s.id} value={s.slug}>{s.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
        >
          <option value="">{t('articles.allStatuses', backendLocale)}</option>
          <option value="published">{t('common.published', backendLocale)}</option>
          <option value="draft">{t('common.draft', backendLocale)}</option>
          <option value="scheduled">{t('articles.scheduled', backendLocale)}</option>
          <option value="pending_review">{t('reviews.pending', backendLocale)}</option>
          <option value="archived">{t('common.archived', backendLocale)}</option>
        </select>
        <select
          value={String(pageSize)}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          className="px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
        >
          {[10, 20, 50, 100].map(size => (
            <option key={size} value={size}>{size} {t('articles.perPage', backendLocale)}</option>
          ))}
        </select>
      </div>

      {/* Batch Actions */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-t-accent-blue/10 border border-t-accent-blue/30 rounded-xl">
          <span className="text-sm font-medium text-t-text-primary">
            {t('articles.batchSelected', backendLocale)}: {selectedItems.length} {t('articles.batchItems', backendLocale)}
          </span>
          <div className="h-5 w-px bg-t-border" />

          {/* 批量改状态 */}
          <select
            value={batchStatus}
            onChange={(e) => setBatchStatus(e.target.value)}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
          >
            <option value="">{t('articles.batchSelectStatus', backendLocale)}</option>
            <option value="published">{t('common.published', backendLocale)}</option>
            <option value="draft">{t('common.draft', backendLocale)}</option>
            <option value="archived">{t('common.archived', backendLocale)}</option>
            <option value="scheduled">{t('articles.scheduled', backendLocale)}</option>
          </select>
          <button
            onClick={applyBatchStatus}
            disabled={!batchStatus || batchUpdateMutation.isPending}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary hover:bg-t-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchUpdateMutation.isPending ? t('articles.batchUpdating', backendLocale) : t('articles.batchApply', backendLocale)}
          </button>

          <div className="h-5 w-px bg-t-border" />

          {/* 批量改板块 + 分类（先板块后分类，一个应用按钮） */}
          <select
            value={batchSection}
            onChange={(e) => { setBatchSection(e.target.value); setBatchCategory('') }}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
          >
            <option value="">{t('articles.batchSelectSection', backendLocale)}</option>
            {sectionsData?.data?.map((s: Section) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            disabled={!batchSection}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">
              {batchSection ? t('articles.batchSelectCategory', backendLocale) : t('articles.batchSelectSectionFirst', backendLocale)}
            </option>
            <option value="0">{t('articles.batchNoCategory', backendLocale)}</option>
            {categoriesData?.data
              ?.filter((c: Category) => c.section?.id === Number(batchSection))
              .map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>

          <button
            onClick={applySectionAndCategory}
            disabled={!batchSection || isApplying}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary hover:bg-t-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isApplying ? t('articles.batchUpdating', backendLocale) : t('articles.batchApply', backendLocale)}
          </button>

          <div className="h-5 w-px bg-t-border" />

          {/* 批量置顶 */}
          <select
            value={batchPinScope}
            onChange={(e) => setBatchPinScope(e.target.value)}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue"
          >
            <option value="">{t('articles.batchPinScope', backendLocale)}</option>
            <option value="global">{t('articles.pinGlobal', backendLocale)}</option>
            <option value="section">{t('articles.pinSection', backendLocale)}</option>
            <option value="none">{t('articles.pinNone', backendLocale)}</option>
          </select>
          <button
            onClick={() => batchPinScope && batchPinMutation.mutate(batchPinScope as 'none' | 'global' | 'section')}
            disabled={!batchPinScope || batchPinMutation.isPending}
            className="px-3 py-1.5 text-sm bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary hover:bg-t-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchPinMutation.isPending ? t('articles.batchUpdating', backendLocale) : t('articles.batchPinApply', backendLocale)}
          </button>
          <div className="h-5 w-px bg-t-border" />

          {/* 批量删除 */}
          <button
            onClick={() => {
              if (confirm(t('articles.batchDeleteConfirm', backendLocale, String(selectedItems.length)))) {
                batchDeleteMutation.mutate()
              }
            }}
            disabled={batchDeleteMutation.isPending}
            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {batchDeleteMutation.isPending ? t('articles.batchDeleting', backendLocale) : t('articles.batchDelete', backendLocale)}
          </button>
          <button
            onClick={() => { setSelectedItems([]); setBatchStatus(''); setBatchCategory(''); setBatchSection('') }}
            className="px-3 py-1.5 text-sm text-t-text-secondary hover:text-t-text-primary transition-colors"
          >
            {t('articles.clearSelection', backendLocale)}
          </button>
        </div>
      )}

      {/* Articles Table */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-t-bg-secondary border-b border-t-border">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={pageIds.length > 0 && pageIds.every(id => selectedItems.includes(id))}
                    onChange={toggleSelectAll}
                    className="rounded"
                    title={t('articles.selectAllOnPage', backendLocale)}
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary cursor-pointer hover:text-t-text-primary select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    {t('articles.articleTitle', backendLocale)}
                    <SortIcon field="title" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary cursor-pointer hover:text-t-text-primary select-none"
                  onClick={() => handleSort('section')}
                >
                  <div className="flex items-center gap-1">
                    {t('articles.section', backendLocale)}
                    <SortIcon field="section" />
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary cursor-pointer hover:text-t-text-primary select-none"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    {t('articles.status', backendLocale)}
                    <SortIcon field="status" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">
                  <div className="flex items-center gap-1">
                    <Pin size={14} />
                    {t('articles.pinned', backendLocale)}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary cursor-pointer hover:text-t-text-primary select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    {t('articles.createdAt', backendLocale)}
                    <SortIcon field="createdAt" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-t-text-secondary">{t('articles.actions', backendLocale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-t-text-secondary">{t('common.loading', backendLocale)}</td></tr>
              ) : articlesData?.data?.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-t-text-secondary">{t('admin.noArticles', backendLocale)}</td></tr>
              ) : (
                articlesData?.data?.map((article: Article) => {
                  const isHighlighted = highlightId === String(article.id)
                  return (
                  <tr
                    key={article.id}
                    ref={isHighlighted ? highlightRef : undefined}
                    className={`hover:bg-t-hover transition-colors ${isHighlighted ? 'bg-t-accent-blue/10 ring-2 ring-t-accent-blue ring-inset' : ''} ${selectedItems.includes(article.id) ? 'bg-t-accent-blue/5' : ''}`}
                  >
                    <td className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(article.id)}
                        onChange={() => toggleSelect(article.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {article.coverImage ? (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                            <Image src={article.coverImage} alt="" fill className="object-cover" unoptimized sizes="48px" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-t-bg-secondary rounded-lg flex items-center justify-center">
                            <ImageIcon size={20} className="text-t-text-secondary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium" dangerouslySetInnerHTML={{ __html: article.title }} />
                          <p className="text-sm text-t-text-secondary">{article.section?.path || '/'}/{article.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-t-bg-secondary rounded-lg">{getSectionName(article.section?.slug)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        article.status === 'published' ? 'bg-green-500/20 text-green-400' :
                        article.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                        article.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                        article.status === 'pending_review' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {article.status === 'published' ? t('common.published', backendLocale) :
                         article.status === 'draft' ? t('common.draft', backendLocale) :
                         article.status === 'scheduled' ? t('articles.scheduled', backendLocale) :
                         article.status === 'pending_review' ? t('reviews.pending', backendLocale) :
                         t('common.archived', backendLocale)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={article.pinnedScope || 'none'}
                        onChange={(e) => pinMutation.mutate({ id: article.id, scope: e.target.value as 'none' | 'global' | 'section' })}
                        disabled={pinMutation.isPending}
                        className="px-2 py-1 text-xs bg-t-bg-secondary border border-t-border rounded-lg text-t-text-primary focus:outline-none focus:border-t-accent-blue disabled:opacity-40"
                      >
                        <option value="none">{t('articles.pinNone', backendLocale)}</option>
                        <option value="global">{t('articles.pinGlobal', backendLocale)}</option>
                        <option value="section">{t('articles.pinSection', backendLocale)}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-t-text-secondary">
                      {new Date(article.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`${article.section?.path || '/'}/${article.slug}`}
                          target="_blank"
                          className="p-2 text-t-text-secondary hover:text-t-text-primary hover:bg-t-bg-secondary rounded-lg"
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          onClick={() => openEditor(article)}
                          className="p-2 text-t-text-secondary hover:text-t-text-primary hover:bg-t-bg-secondary rounded-lg"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('articles.confirmDelete', backendLocale))) {
                              deleteMutation.mutate(article.id)
                            }
                          }}
                          className="p-2 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {articlesData?.pagination && articlesData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-t-text-secondary">
            {t('articles.totalCount', backendLocale, String(articlesData.pagination.total))}
            {articlesData.pagination.totalPages > 1 && (
              <span className="ml-2">
                {t('articles.currentPage', backendLocale)} {articlesData.pagination.page}/{articlesData.pagination.totalPages}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-t-bg-primary border border-t-border rounded-lg hover:bg-t-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, articlesData.pagination.totalPages) }, (_, i) => {
              let pageNum: number
              if (articlesData.pagination.totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= articlesData.pagination.totalPages - 2) {
                pageNum = articlesData.pagination.totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 text-sm rounded-lg border transition-colors ${
                    page === pageNum
                      ? 'bg-t-accent-blue text-black border-t-accent-blue'
                      : 'bg-t-bg-primary border-t-border text-t-text-secondary hover:bg-t-hover'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(articlesData!.pagination!.totalPages, p + 1))}
              disabled={page >= articlesData.pagination.totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-t-bg-primary border border-t-border rounded-lg hover:bg-t-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditor(false)} />
          <div className="relative w-full max-w-6xl h-[90vh] bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border shrink-0">
              <h2 className="text-lg font-semibold">{editingArticle ? t('articles.editArticle', backendLocale) : t('articles.newArticle', backendLocale)}</h2>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {/* Top row: Title + Meta */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium mb-2">{t('articles.formTitle', backendLocale)}</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('articles.formTitle', backendLocale) + '...'}
                    className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    style={{ fontWeight: titleBold ? 'bold' : 'normal', color: titleColor || undefined }}
                  />
                  {/* 标题格式化工具栏 */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setTitleBold(!titleBold)}
                      className={`p-1.5 rounded transition-colors ${titleBold ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'}`}
                      title="加粗"
                    >
                      <Bold size={16} />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        className={`p-1.5 rounded transition-colors ${titleColor ? 'bg-t-accent-blue/20 text-t-accent-blue' : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'}`}
                        title="颜色"
                      >
                        <Palette size={16} />
                      </button>
                      <select
                        value={titleColor}
                        onChange={(e) => setTitleColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      >
                        {titleColors.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    {titleColor && (
                      <div
                        className="w-5 h-5 rounded border border-t-border"
                        style={{ backgroundColor: titleColor }}
                      />
                    )}
                  </div>
                </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('articles.formSection', backendLocale)}</label>
                      <select
                        value={editorSection}
                        onChange={(e) => { setEditorSection(e.target.value); setCategoryId(null) }}
                        className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                      >
                        <option value="">{t('articles.selectSection', backendLocale)}</option>
                        {sectionsData?.data?.map((s: Section) => (
                          <option key={s.id} value={s.slug}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('articles.formCategory', backendLocale)}</label>
                    <select
                      value={categoryId || ''}
                      onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    >
                      <option value="">{t('articles.selectCategory', backendLocale)}</option>
                      {categories.map((cat: Category) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Second row: Cover image + Tags + Status */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('articles.formCoverImage', backendLocale)}</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="URL..."
                      className="flex-1 px-3 py-2 text-sm bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleCoverUpload(file)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors disabled:opacity-50"
                    >
                      {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {t('articles.localUpload', backendLocale)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCoverPicker(true)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
                    >
                      <ImageIcon size={14} />
                      {t('articles.mediaLibrary', backendLocale)}
                    </button>
                    <button
                      type="button"
                      onClick={getRandomCover}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
                    >
                      <Shuffle size={14} />
                      {t('articles.randomCover', backendLocale)}
                    </button>
                  </div>
                  {coverImage && (
                    <div className="relative mt-2 w-full h-24">
                      <Image src={coverImage} alt="Cover" fill className="object-cover rounded-lg" unoptimized sizes="(max-width: 768px) 100vw, 400px" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('articles.formTags', backendLocale)}</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={t('articles.formTagsPlaceholder', backendLocale)}
                    className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('articles.formStatus', backendLocale)}</label>
                  <div className="flex gap-4 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={articleStatus === 'draft'}
                        onChange={() => { setArticleStatus('draft'); setScheduledAt('') }}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <span>{t('common.draft', backendLocale)}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={articleStatus === 'published'}
                        onChange={() => { setArticleStatus('published'); setScheduledAt('') }}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <span>{t('articles.publishNow', backendLocale)}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={articleStatus === 'scheduled'}
                        onChange={() => setArticleStatus('scheduled')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <span>{t('articles.scheduled', backendLocale)}</span>
                    </label>
                  </div>
                  {articleStatus === 'scheduled' && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="mt-2 w-full px-3 py-2 text-sm bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                  )}
                </div>
              </div>

              {/* Markdown Editor */}
              <div className="h-[calc(100%-220px)] min-h-[300px]">
                <label className="block text-sm font-medium mb-2">{t('articles.formContent', backendLocale)}</label>
                {loadingArticle ? (
                  <div className="h-full flex items-center justify-center bg-t-bg-secondary border border-t-border rounded-xl">
                    <Loader2 size={24} className="animate-spin text-t-accent-blue" />
                  </div>
                ) : (
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    placeholder={t('articles.formContentPlaceholder', backendLocale).replace(/\\n/g, '\n')}
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary shrink-0">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary transition-colors"
              >
                {t('common.cancel', backendLocale)}
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !title}
                className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending || updateMutation.isPending ? t('articles.saving', backendLocale) : (
                  <>
                    <Check size={18} />
                    {t('articles.save', backendLocale)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Media Picker Modal */}
      {showCoverPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCoverPicker(false)} />
          <div className="relative w-full max-w-4xl max-h-[80vh] bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">选择封面图</h2>
              <button onClick={() => setShowCoverPicker(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {mediaData?.data?.length === 0 ? (
                <div className="text-center py-12 text-t-text-secondary">
                  <ImageIcon size={48} className="mx-auto mb-3 opacity-30" />
                  <p>媒体库为空</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {mediaData?.data?.map((media: any) => (
                    <button
                      key={media.id}
                      onClick={() => {
                        setCoverImage(media.url)
                        setShowCoverPicker(false)
                      }}
                      className="aspect-square bg-t-bg-secondary rounded-lg overflow-hidden hover:ring-2 hover:ring-t-accent-blue transition-all group relative"
                    >
                      {media.mimeType?.startsWith('image/') ? (
                        <Image
                          src={media.thumbnailUrl || media.url}
                          alt={media.originalName}
                          fill
                          className="object-cover"
                          unoptimized
                          sizes="(max-width: 768px) 50vw, 200px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={24} className="text-t-text-secondary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Check size={20} className="text-t-accent-blue" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

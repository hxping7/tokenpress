'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Plus, Edit, Trash2, X, Check, GripVertical, ChevronDown, ChevronRight, FolderOpen, Layers } from 'lucide-react'
import { StaticPagePicker } from '@/components/StaticPagePicker'

interface Section {
  id: number
  name: string
  slug: string
  path: string
  description: string | null
  externalUrl: string | null
  sortOrder: number
  isActive: boolean
}

interface Category {
  id: number
  name: string
  slug: string
  sectionId: number
  description: string | null
  sortOrder: number
  section?: Section | null
}

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale } = useLocaleStore()

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set())
  const [showSectionEditor, setShowSectionEditor] = useState(false)
  const [showCategoryEditor, setShowCategoryEditor] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [draggedSection, setDraggedSection] = useState<number | null>(null)
  const [draggedCategory, setDraggedCategory] = useState<{ id: number; sectionId: number } | null>(null)

  // Section form state
  const [sectionName, setSectionName] = useState('')
  const [sectionSlug, setSectionSlug] = useState('')
  const [sectionPath, setSectionPath] = useState('')
  const [sectionDescription, setSectionDescription] = useState('')
  const [sectionExternalUrl, setSectionExternalUrl] = useState('')
  const [sectionIsActive, setSectionIsActive] = useState(true)

  // Category form state
  const [categoryName, setCategoryName] = useState('')
  const [categorySectionId, setCategorySectionId] = useState<number | null>(null)
  const [categoryDescription, setCategoryDescription] = useState('')

  // Queries
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ['admin-sections'],
    queryFn: () => api.get('/sections'),
  })

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/categories'),
  })

  // Section mutations
  const createSectionMutation = useMutation({
    mutationFn: (data: any) => api.post('/sections', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] })
      closeSectionEditor()
    },
  })

  const updateSectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/sections/${id}`, data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] })
      closeSectionEditor()
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sections/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] })
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
    },
  })

  const reorderSectionsMutation = useMutation({
    mutationFn: (orders: { id: number; sortOrder: number }[]) =>
      api.patch('/sections/reorder', { orders }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sections'] }),
  })

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      closeCategoryEditor()
    },
  })

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/categories/${id}`, data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      closeCategoryEditor()
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/categories/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
  })

  // Helpers
  const toggleSection = (id: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openSectionEditor = (section?: Section) => {
    if (section) {
      setEditingSection(section)
      setSectionName(section.name)
      setSectionSlug(section.slug)
      setSectionPath(section.path)
      setSectionDescription(section.description || '')
      setSectionExternalUrl(section.externalUrl || '')
      setSectionIsActive(section.isActive)
    } else {
      setEditingSection(null)
      setSectionName('')
      setSectionSlug('')
      setSectionPath('')
      setSectionDescription('')
      setSectionExternalUrl('')
      setSectionIsActive(true)
    }
    setShowSectionEditor(true)
  }

  const closeSectionEditor = () => {
    setShowSectionEditor(false)
    setEditingSection(null)
  }

  const openCategoryEditor = (sectionId: number, category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryName(category.name)
      setCategorySectionId(category.sectionId)
      setCategoryDescription(category.description || '')
    } else {
      setEditingCategory(null)
      setCategoryName('')
      setCategorySectionId(sectionId)
      setCategoryDescription('')
    }
    setShowCategoryEditor(true)
  }

  const closeCategoryEditor = () => {
    setShowCategoryEditor(false)
    setEditingCategory(null)
  }

  const handleSectionSubmit = () => {
    const data = {
      name: sectionName,
      slug: sectionSlug || undefined,
      path: sectionPath,
      description: sectionDescription || null,
      externalUrl: sectionExternalUrl || null,
      isActive: sectionIsActive,
    }

    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, data })
    } else {
      createSectionMutation.mutate(data)
    }
  }

  const handleCategorySubmit = () => {
    if (!categorySectionId) return

    const data = {
      name: categoryName,
      sectionId: categorySectionId,
      description: categoryDescription || null,
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data })
    } else {
      createCategoryMutation.mutate(data)
    }
  }

  // Drag and drop for sections
  const handleSectionDragStart = (id: number) => setDraggedSection(id)

  const handleSectionDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    if (draggedSection === null || draggedSection === targetId) return

    const sections = sectionsData?.data as Section[] | undefined
    if (!sections) return

    const newOrder = [...sections]
    const draggedIdx = newOrder.findIndex(s => s.id === draggedSection)
    const targetIdx = newOrder.findIndex(s => s.id === targetId)

    if (draggedIdx === -1 || targetIdx === -1) return

    const [removed] = newOrder.splice(draggedIdx, 1)
    newOrder.splice(targetIdx, 0, removed)

    // Update sort orders
    const orders = newOrder.map((s, idx) => ({ id: s.id, sortOrder: idx }))
    reorderSectionsMutation.mutate(orders)
    setDraggedSection(null)
  }

  // Group categories by section
  const categoriesBySection = (categoriesData?.data || []).reduce((acc: Record<number, Category[]>, cat: Category) => {
    const sid = cat.sectionId || cat.section?.id
    if (sid) {
      if (!acc[sid]) acc[sid] = []
      acc[sid].push(cat)
    }
    return acc
  }, {})

  const sections = (sectionsData?.data || []) as Section[]
  const isLoading = sectionsLoading || categoriesLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('sections.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('sections.desc', backendLocale)}</p>
        </div>
        <button
          onClick={() => openSectionEditor()}
          className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
        >
          <Plus size={18} />
          {t('sections.newSection', backendLocale)}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.loading', backendLocale)}</div>
      ) : (
        <div className="space-y-2">
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.id)
            const sectionCategories = categoriesBySection[section.id] || []

            return (
              <div
                key={section.id}
                className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden"
                draggable
                onDragStart={() => handleSectionDragStart(section.id)}
                onDragOver={(e) => handleSectionDragOver(e, section.id)}
              >
                {/* Section Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-t-bg-secondary/50 cursor-pointer hover:bg-t-hover"
                  onClick={() => toggleSection(section.id)}
                >
                  <GripVertical size={18} className="text-t-text-secondary cursor-grab shrink-0" />
                  <button className="p-0.5 text-t-text-secondary shrink-0">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <Layers size={18} className="text-t-accent-blue shrink-0" />
                  <span className="font-medium flex-1">{section.name}</span>
                  <span className="text-sm text-t-text-secondary">{section.path}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${section.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {section.isActive ? t('common.enabled', backendLocale) : t('common.disabled', backendLocale)}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openSectionEditor(section)}
                      className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-bg-secondary rounded"
                      title={t('common.edit', backendLocale)}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => { if (confirm(t('sections.confirmDeleteSection', backendLocale))) deleteSectionMutation.mutate(section.id) }}
                      className="p-1.5 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded"
                      title={t('common.delete', backendLocale)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Categories List */}
                {isExpanded && (
                  <div className="border-t border-t-border">
                    {section.description && (
                      <div className="px-6 py-3 text-sm text-t-text-secondary border-b border-t-border bg-t-bg-secondary/20">
                        {section.description}
                      </div>
                    )}
                    {sectionCategories.length === 0 ? (
                      <div className="px-6 py-8 text-center text-t-text-secondary">
                        <FolderOpen size={24} className="mx-auto mb-2 opacity-50" />
                        <p>{t('sections.noCategories', backendLocale)}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-t-border">
                        {sectionCategories.map((cat: Category) => (
                          <div key={cat.id} className="flex items-center gap-3 px-6 py-3 hover:bg-t-hover">
                            <GripVertical size={16} className="text-t-text-secondary/50 cursor-grab shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium">{cat.name}</p>
                              <p className="text-sm text-t-text-secondary">/{cat.slug}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openCategoryEditor(section.id, cat)}
                                className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-bg-secondary rounded"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => { if (confirm(t('sections.confirmDeleteCategory', backendLocale))) deleteCategoryMutation.mutate(cat.id) }}
                                className="p-1.5 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-6 py-3 border-t border-t-border bg-t-bg-secondary/30">
                      <button
                        onClick={() => openCategoryEditor(section.id)}
                        className="flex items-center gap-2 text-sm text-t-accent-blue hover:underline"
                      >
                        <Plus size={16} />
                        {t('sections.addCategory', backendLocale)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Section Editor Modal */}
      {showSectionEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeSectionEditor} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{editingSection ? t('sections.editSection', backendLocale) : t('sections.newSection', backendLocale)}</h2>
              <button onClick={closeSectionEditor} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('sections.sectionName', backendLocale)}</label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder={t('sections.sectionName', backendLocale)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('sections.slug', backendLocale)}</label>
                  <input
                    type="text"
                    value={sectionSlug}
                    onChange={(e) => setSectionSlug(e.target.value)}
                    placeholder={t('sections.slugPlaceholder', backendLocale)}
                    className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('sections.path', backendLocale)}</label>
                  <input
                    type="text"
                    value={sectionPath}
                    onChange={(e) => setSectionPath(e.target.value)}
                    placeholder={t('sections.pathPlaceholder', backendLocale)}
                    className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('sections.description', backendLocale)}</label>
                <textarea
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  placeholder={t('sections.descriptionPlaceholder', backendLocale)}
                  rows={2}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('sections.externalUrl', backendLocale)} <span className="text-t-text-secondary text-xs">({t('sections.externalUrlHint', backendLocale)})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={sectionExternalUrl}
                    onChange={(e) => setSectionExternalUrl(e.target.value)}
                    placeholder={t('sections.externalUrlPlaceholder', backendLocale)}
                    className="flex-1 px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                  />
                  <StaticPagePicker
                    value={sectionExternalUrl}
                    onSelect={(url) => setSectionExternalUrl(url)}
                    label={t('admin.staticHtmlPage.selectStaticPage', backendLocale)}
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sectionIsActive}
                    onChange={(e) => setSectionIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-t-accent-blue"
                  />
                  <span className="text-sm">{t('sections.enableSection', backendLocale)}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={closeSectionEditor} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', backendLocale)}</button>
              <button
                onClick={handleSectionSubmit}
                disabled={!sectionName || (!sectionPath && !sectionExternalUrl) || createSectionMutation.isPending || updateSectionMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Check size={18} /> {t('common.save', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Editor Modal */}
      {showCategoryEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeCategoryEditor} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{editingCategory ? t('sections.editCategory', backendLocale) : t('sections.newCategory', backendLocale)}</h2>
              <button onClick={closeCategoryEditor} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('sections.categoryName', backendLocale)}</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder={t('sections.categoryName', backendLocale)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('sections.parentSection', backendLocale)}</label>
                <select
                  value={categorySectionId || ''}
                  onChange={(e) => setCategorySectionId(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                >
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('sections.description', backendLocale)}</label>
                <textarea
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder={t('sections.descriptionPlaceholder', backendLocale)}
                  rows={2}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={closeCategoryEditor} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', backendLocale)}</button>
              <button
                onClick={handleCategorySubmit}
                disabled={!categoryName || !categorySectionId || createCategoryMutation.isPending || updateCategoryMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Check size={18} /> {t('common.save', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

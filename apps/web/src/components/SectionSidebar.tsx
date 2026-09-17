'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search } from 'lucide-react'
import { useRef } from 'react'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'

interface SectionSidebarProps {
  sectionSlug: string
  sectionPath: string
  search: string
  onSearchInputChange: (value: string) => void
  onSearch: (value: string) => void
  activeCategory?: string
  /** 分类栏标题（风格包 layouts.section.sidebar.label），未配则用 i18n 默认 */
  label?: string
  /** 自定义信息块（风格包 layouts.section.sidebar.metaBlock）：{ title, lines[] } */
  metaBlock?: any
  /**
   * 外部传入的分类列表（覆盖内部 `/categories` 拉取）。
   * 作品集类板块的分类来自文章 meta.category，不在 categories 表里，需由调用方传入。
   * 形如 [{ name, slug, count }]
   */
  categories?: { name: string; slug: string; count?: number }[] | null
  /** 分类右侧是否显示数量（风格包 layouts.section.subcategory.showCount） */
  showCount?: boolean
  /** 侧栏搜索框（风格包 layouts.section.sidebar.showSearch，默认显示） */
  showSearch?: boolean
  /** 侧栏「热门标签」云（风格包 layouts.section.sidebar.showTags，默认显示） */
  showTags?: boolean
}

export function SectionSidebar({ sectionSlug, sectionPath, search, onSearchInputChange, onSearch, activeCategory, label, metaBlock, categories: externalCategories, showCount = false, showSearch = true, showTags = true }: SectionSidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { locale } = useLocaleStore()

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', sectionSlug],
    queryFn: () => api.get(`/categories?section=${sectionSlug}`),
    // 已由外部提供分类时不再拉取
    enabled: !externalCategories,
  })

  const { data: tagsData } = useQuery({
    queryKey: ['section-tags'],
    queryFn: () => api.get('/tags?limit=20'),
  })

  const categories = externalCategories
    ? externalCategories
    : ((categoriesData?.data || []) as any[]).map((c: any) => ({
        name: c.name,
        slug: c.slug || c.id,
        count: c.articleCount,
      }))
  const tags = tagsData?.data || []

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(search)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch(search)
    }
  }

  return (
    <aside className="space-y-6">
      {/* 搜索框 */}
      {showSearch && (
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-t-text-muted" size={15} />
        <input
          ref={inputRef}
          type="text"
          placeholder={t('sidebar.searchPlaceholder', locale)}
          value={search}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30 transition-colors"
        />
      </form>
      )}

      {/* 分类筛选 */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-3">
            {label || t('sidebar.categories', locale)}
          </h3>
          <div className="space-y-1">
            <Link
              href={sectionPath}
              className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                !activeCategory
                  ? 'text-t-accent-blue bg-t-accent-blue/10'
                  : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
              }`}
            >
              <span>{t('sidebar.all', locale)}</span>
              {showCount && (
                <span className="text-xs text-t-text-muted tabular-nums">
                  {categories.reduce((sum, c) => sum + (c.count || 0), 0)}
                </span>
              )}
            </Link>
            {categories.map((cat) => {
              const catSlug = cat.slug
              const isActive = activeCategory === String(catSlug)
              return (
                <Link
                  key={catSlug}
                  href={`${sectionPath}?category=${catSlug}`}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'text-t-accent-blue bg-t-accent-blue/10'
                      : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
                  }`}
                >
                  <span>{cat.name}</span>
                  {showCount && cat.count !== undefined && (
                    <span className="text-xs text-t-text-muted tabular-nums">{cat.count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 热门标签（风格包 sidebar.showTags 可关） */}
      {showTags && tags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-3">
            {t('sidebar.popularTags', locale)}
          </h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: any) => (
              <Link
                key={tag.id}
                href={`/search?q=${encodeURIComponent(tag.name)}`}
                className="px-2.5 py-1 text-xs bg-t-bg-tertiary text-t-text-secondary rounded-full hover:bg-t-hover hover:text-t-text-primary transition-colors"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}
      {/* 自定义信息块（风格包 sidebar.metaBlock） */}
      {metaBlock && (metaBlock.title || (Array.isArray(metaBlock.lines) && metaBlock.lines.length > 0)) && (
        <div className="pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
          {metaBlock.title && (
            <div className="mb-2 text-sm font-medium text-t-text-primary">{metaBlock.title}</div>
          )}
          {(Array.isArray(metaBlock.lines) ? metaBlock.lines : []).map((line: string, i: number) => (
            <div key={i} className="text-xs leading-relaxed text-t-text-muted">
              {line}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

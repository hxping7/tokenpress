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
}

export function SectionSidebar({ sectionSlug, sectionPath, search, onSearchInputChange, onSearch, activeCategory }: SectionSidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { locale } = useLocaleStore()

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', sectionSlug],
    queryFn: () => api.get(`/categories?section=${sectionSlug}`),
  })

  const { data: tagsData } = useQuery({
    queryKey: ['section-tags'],
    queryFn: () => api.get('/tags?limit=20'),
  })

  const categories = categoriesData?.data || []
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

      {/* 分类筛选 */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-3">
            {t('sidebar.categories', locale)}
          </h3>
          <div className="space-y-1">
            <Link
              href={sectionPath}
              className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                !activeCategory
                  ? 'text-t-accent-blue bg-t-accent-blue/10'
                  : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
              }`}
            >
              {t('sidebar.all', locale)}
            </Link>
            {categories.map((cat: any) => {
              const catSlug = cat.slug || cat.id
              const isActive = activeCategory === String(catSlug)
              return (
                <Link
                  key={cat.id}
                  href={`${sectionPath}?category=${catSlug}`}
                  className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'text-t-accent-blue bg-t-accent-blue/10'
                      : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
                  }`}
                >
                  {cat.name}
                  {cat.articleCount !== undefined && (
                    <span className="ml-2 text-xs text-t-text-muted">({cat.articleCount})</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 热门标签 */}
      {tags.length > 0 && (
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
    </aside>
  )
}

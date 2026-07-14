'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { getDesignWorks, getDesignWorkCategories, type DesignWork } from '@/lib/api'

interface Props {
  section: string
  sectionPath: string
  title: string
  description: string | null
}

export function DesignWorksGallery({ section, sectionPath, title, description }: Props) {
  const [works, setWorks] = useState<DesignWork[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (cat: string | null) => {
    setLoading(true)
    try {
      const res = await getDesignWorks(section, { category: cat || undefined, pageSize: 24 })
      setWorks(res.data || [])
    } catch {
      setWorks([])
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => {
    getDesignWorkCategories(section).then((c) => setCategories(c)).catch(() => setCategories([]))
    load(null)
  }, [section, load])

  const onSelectCat = (cat: string | null) => {
    setActiveCat(cat)
    load(cat)
  }

  return (
    <div className="min-h-screen bg-t-bg-primary">
      {/* 头部：标题 + 简介（sspai 风：大留白、克制） */}
      <div className="max-w-[1200px] mx-auto px-4 pt-20 pb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-t-text-primary tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-t-text-secondary max-w-2xl">{description}</p>
        )}

        {/* 分类筛选（sspai 式小药丸） */}
        {categories.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FilterPill active={activeCat === null} onClick={() => onSelectCat(null)}>
              全部
            </FilterPill>
            {categories.map((c) => (
              <FilterPill key={c} active={activeCat === c} onClick={() => onSelectCat(c)}>
                {c}
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/* 作品卡片网格 */}
      <div className="max-w-[1200px] mx-auto px-4 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-t-bg-secondary animate-pulse h-72" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-24 text-t-text-muted text-sm">暂无作品</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {works.map((w) => (
              <WorkCard key={w.id} work={w} sectionPath={sectionPath} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${
        active
          ? 'bg-t-accent-blue text-black border-t-accent-blue'
          : 'bg-t-bg-secondary text-t-text-secondary border-t-border hover:text-t-text-primary hover:border-t-accent-blue/50'
      }`}
    >
      {children}
    </button>
  )
}

function WorkCard({ work, sectionPath }: { work: DesignWork; sectionPath: string }) {
  return (
    <Link
      href={`${sectionPath}/${work.slug}`}
      className="group block rounded-xl overflow-hidden bg-t-bg-secondary border border-t-border hover:border-t-accent-blue/50 hover:shadow-lg transition-all duration-200"
    >
      {/* 封面：统一 4:3，图片占主视觉 */}
      <div className="relative aspect-[4/3] overflow-hidden bg-t-bg-primary">
        {work.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={work.coverImage}
            alt={work.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-t-text-muted text-sm">
            无封面
          </div>
        )}
        {work.category && (
          <span className="absolute top-3 left-3 px-2 py-0.5 text-xs rounded-md bg-black/55 text-white backdrop-blur-sm">
            {work.category}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-t-text-primary line-clamp-1 group-hover:text-t-accent-blue transition-colors">
          {work.title}
        </h3>
        {work.summary && (
          <p className="mt-1.5 text-sm text-t-text-secondary line-clamp-2 leading-relaxed">
            {work.summary}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          {work.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={work.authorAvatar} alt={work.authorName || ''} className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <span className="w-6 h-6 rounded-full bg-t-accent-blue/20 flex items-center justify-center text-xs text-t-accent-blue">
              {(work.authorName || '?').charAt(0)}
            </span>
          )}
          <span className="text-xs text-t-text-muted">{work.authorName || '匿名'}</span>
        </div>
      </div>
    </Link>
  )
}

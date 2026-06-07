'use client'

import { useEffect, useState } from 'react'

interface Heading {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  content: string
}

/**
 * 从 Markdown 内容中提取标题生成目录
 */
export function TableOfContents({ content }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const lines = content.split('\n')
    const extracted: Heading[] = []
    const idCounter: Record<string, number> = {}

    for (const line of lines) {
      const match = line.match(/^(#{2,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].replace(/[*_`]/g, '').trim()
        const baseId = text
          .toLowerCase()
          .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '')

        let id: string
        if (idCounter[baseId] === undefined) {
          idCounter[baseId] = 0
          id = baseId
        } else {
          idCounter[baseId] += 1
          id = `${baseId}-${idCounter[baseId]}`
        }

        extracted.push({ id, text, level })
      }
    }

    setHeadings(extracted)
  }, [content])

  // 监听滚动，高亮当前目录项
  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' }
    )

    // 延迟观察，等 DOM 渲染完成
    const timer = setTimeout(() => {
      headings.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (el) observer.observe(el)
      })
    }, 500)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [headings])

  if (headings.length === 0) return null

  const handleClick = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="space-y-1">
      <h3 className="text-xs font-semibold text-t-text-muted uppercase tracking-wider mb-3">
        目录
      </h3>
      {headings.map((heading) => (
        <button
          key={heading.id}
          onClick={() => handleClick(heading.id)}
          className={`block w-full text-left text-sm transition-colors border-l-2 ${
            activeId === heading.id
              ? 'border-t-accent-blue text-t-accent-blue pl-3'
              : 'border-transparent text-t-text-secondary hover:text-t-text-primary pl-3'
          } ${heading.level === 3 ? 'ml-3' : ''}`}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  )
}

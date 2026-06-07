'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-t-text-secondary transition-colors hover:text-t-text-primary hover:bg-t-hover"
      >
        <Search size={16} />
        <span className="hidden sm:inline">搜索</span>
      </button>

      {/* Search overlay */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50">
            <form onSubmit={handleSearch} className="flex items-center gap-2 border border-t-border rounded-xl bg-t-bg-secondary shadow-xl p-2">
              <Search size={16} className="text-t-text-muted ml-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索文章..."
                className="flex-1 bg-transparent text-sm text-t-text-primary placeholder:text-t-text-muted outline-none"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 text-t-text-muted hover:text-t-text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  )
}

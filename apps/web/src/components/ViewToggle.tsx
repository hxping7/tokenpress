'use client'

import { LayoutGrid, List } from 'lucide-react'
import { useLayoutStore } from '@/stores/layout'
import { cn } from '@/lib/cn'

export function ViewToggle() {
  const { view, setView } = useLayoutStore()

  return (
    <div className="flex items-center gap-1 rounded-lg bg-t-bg-tertiary p-1">
      <button
        onClick={() => setView('grid')}
        className={cn(
          'rounded p-2 transition-colors',
          view === 'grid'
            ? 'bg-t-bg-secondary text-t-text-primary'
            : 'text-t-text-muted hover:text-t-text-secondary'
        )}
        aria-label="网格视图"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => setView('list')}
        className={cn(
          'rounded p-2 transition-colors',
          view === 'list'
            ? 'bg-t-bg-secondary text-t-text-primary'
            : 'text-t-text-muted hover:text-t-text-secondary'
        )}
        aria-label="列表视图"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Link2, X, FileText, RefreshCw } from 'lucide-react'

export interface StaticPageItem {
  type: 'file'
  name: string
  relPath: string
  url: string
  size: number
  ext: string
  mtime: string
}

export function useStaticPages() {
  const { backendLocale } = useLocaleStore()
  return useQuery({
    queryKey: ['statichtml-list'],
    queryFn: () => api.get('/statichtml/list'),
  })
}

export function StaticPagePicker({
  value,
  onSelect,
  label,
}: {
  value?: string
  onSelect: (url: string) => void
  label?: string
}) {
  const { backendLocale } = useLocaleStore()
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch } = useStaticPages()

  const pages: StaticPageItem[] = data?.data || []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-t-border rounded-lg text-t-text-secondary hover:text-t-accent-blue hover:border-t-accent-blue/50 transition-colors whitespace-nowrap"
        title={label || t('admin.staticHtmlPage.selectStaticPage', backendLocale)}
      >
        <Link2 size={16} />
        {label || t('admin.staticHtmlPage.selectStaticPage', backendLocale)}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-t-bg-primary border border-t-border rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-t-border">
              <div>
                <h3 className="text-lg font-semibold">{t('admin.staticHtmlPage.selectStaticPage', backendLocale)}</h3>
                <p className="text-xs text-t-text-secondary mt-0.5">{t('admin.staticHtmlPage.selectStaticPageDesc', backendLocale)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refetch()} className="p-2 text-t-text-secondary hover:text-t-accent-blue rounded-lg" title="刷新">
                  <RefreshCw size={16} />
                </button>
                <button onClick={() => setOpen(false)} className="p-2 text-t-text-secondary hover:text-t-text-primary rounded-lg">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {isLoading ? (
                <p className="text-center py-8 text-t-text-secondary">{t('common.loading', backendLocale)}</p>
              ) : pages.length === 0 ? (
                <p className="text-center py-8 text-t-text-secondary">{t('admin.staticHtmlPage.noFiles', backendLocale)}</p>
              ) : (
                <ul className="space-y-1">
                  {pages.map((p) => {
                    const isCurrent = value && (p.url === value || p.relPath === value)
                    return (
                      <li key={p.relPath}>
                        <button
                          onClick={() => { onSelect(p.url); setOpen(false) }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-colors ${
                            isCurrent ? 'bg-t-accent-blue/15 ring-1 ring-t-accent-blue/40' : 'hover:bg-t-hover'
                          }`}
                        >
                          <FileText size={18} className="text-t-accent-blue flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-t-text-secondary truncate">{p.url}</p>
                          </div>
                          {isCurrent && <span className="text-xs text-t-accent-blue">{t('common.current', backendLocale) || '当前'}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

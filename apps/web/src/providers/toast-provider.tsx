'use client'

import { Toaster } from 'sonner'
import { useThemeStore } from '@/stores'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore()

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </>
  )
}

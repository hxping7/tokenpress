'use client'

import { useEffect } from 'react'

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('ErrorBoundary caught:', error)
  }, [error])

  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-t-text-primary mb-2">页面出错了</h1>
        <p className="text-t-text-secondary mb-6">
          {error.message || '抱歉，页面加载时发生了错误。'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-white hover:bg-t-accent-blue-dim transition-colors"
          >
            重试
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm rounded-lg border border-t-border text-t-text-secondary hover:text-t-text-primary hover:border-t-accent-blue/30 transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  )
}

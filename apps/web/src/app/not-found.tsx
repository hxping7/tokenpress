'use client'

export default function NotFound() {
  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-t-text-muted mb-4">404</div>
        <h1 className="text-2xl font-bold text-t-text-primary mb-2">页面未找到</h1>
        <p className="text-t-text-secondary mb-6">你访问的页面不存在或已被删除。</p>
        <a
          href="/"
          className="inline-block px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-white hover:bg-t-accent-blue-dim transition-colors"
        >
          返回首页
        </a>
      </div>
    </div>
  )
}

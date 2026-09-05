'use client'

export default function Loading() {
  return (
    <div className="min-h-screen pt-[var(--header-actual-height)] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-t-accent-blue border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-t-text-secondary text-sm">加载中...</p>
      </div>
    </div>
  )
}

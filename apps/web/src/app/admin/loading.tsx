'use client'

// 原先全站共用一个根级 app/loading.tsx。根级 loading 会给**所有**路由套上 Suspense
// 边界，Next 在页面 resolve 前就把外壳以 200 冲刷出去，之后 notFound() 再也改不了
// 状态码（板块/文章软 404 的根因）。因此根级 loading 已删除，这里只为后台补回
// 加载态——后台不涉 SEO，Suspense 边界无害。
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

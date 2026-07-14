'use client'

import { MarkdownContent } from '@/components/MarkdownContent'

/**
 * 单页模板：渲染板块简介为单页，无文章列表。
 */
export function SinglePageView({ description }: { description: string | null }) {
  if (!description) {
    return (
      <div className="text-center py-20 text-t-text-secondary">
        该板块暂无单页内容（请在板块「描述」中填写展示内容）
      </div>
    )
  }
  return (
    <article className="bg-t-bg-primary border border-t-border rounded-xl p-6 sm:p-10 max-w-[var(--reading-max-width)] mx-auto">
      <MarkdownContent content={description} />
    </article>
  )
}

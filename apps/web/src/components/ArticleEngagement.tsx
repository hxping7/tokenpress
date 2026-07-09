'use client'

import { ArticleLikeButton } from '@/components/ArticleLikeButton'
import { ArticleFavoriteButton } from '@/components/ArticleFavoriteButton'

interface ArticleEngagementProps {
  articleId: number
  title: string
}

// 点赞 + 收藏 组合块：按后台配置的 likePositions 在文章页多处渲染，收藏始终与点赞放一块。
export function ArticleEngagement({ articleId, title }: ArticleEngagementProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <ArticleLikeButton articleId={articleId} />
      <ArticleFavoriteButton articleId={articleId} title={title} />
    </div>
  )
}

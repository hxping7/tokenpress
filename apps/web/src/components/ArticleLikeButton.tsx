'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Heart } from 'lucide-react'

interface ArticleLikeButtonProps {
  articleId: number
}

export function ArticleLikeButton({ articleId }: ArticleLikeButtonProps) {

  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['article-like', articleId],
    queryFn: () => api.getArticleLikeStatus(articleId),
    enabled: !!articleId,
  })

  const likeMutation = useMutation({
    mutationFn: () => api.toggleArticleLike(articleId),
    onSuccess: (result) => {
      queryClient.setQueryData(['article-like', articleId], result)
    },
  })

  const liked = data?.data?.liked ?? likeMutation.data?.data?.liked ?? false
  const likeCount = likeMutation.data?.data?.likeCount ?? data?.data?.likeCount ?? 0

  return (
    <button
      onClick={() => likeMutation.mutate()}
      disabled={likeMutation.isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
        liked
          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
          : 'bg-t-bg-tertiary text-t-text-secondary border border-t-border hover:border-red-500/30 hover:text-red-400'
      }`}
    >
      <Heart size={14} className={liked ? 'fill-red-400' : ''} />
      <span>{likeCount}</span>
    </button>
  )
}
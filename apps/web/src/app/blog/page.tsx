import { BlogPageClient } from '@/components/BlogPageClient'

export const revalidate = 60

export const metadata = {
  title: '全部文章 | Token00',
  description: 'Token00 全站已发布文章的完整列表，按发布时间排序。',
}

export default function BlogPage() {
  return <BlogPageClient />
}

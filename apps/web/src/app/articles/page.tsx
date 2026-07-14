import { AllArticlesClient } from '@/components/AllArticlesClient'

// 根布局使用 cookies() 读取配色主题（SSR 注入防闪烁），整站已为动态渲染；
// 此处显式声明 force-dynamic，避免与静态预渲染冲突导致 500。
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '全部文章 | Token00',
  description: 'Token00 全站已发布文章的完整列表，按发布时间排序。',
}

export default function ArticlesPage() {
  return <AllArticlesClient />
}

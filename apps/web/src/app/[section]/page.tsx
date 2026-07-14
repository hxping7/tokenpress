import { SectionPageClient } from '@/components/SectionPageClient'

interface Section {
  id: number
  name: string
  slug: string
  path: string
  description: string | null
  layouts: Record<string, unknown> | null
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001'

async function fetchSections(): Promise<Section[]> {
  const res = await fetch(`${BACKEND_URL}/api/v1/sections`, {
    next: { tags: ['sections'], revalidate: 60 },
  })
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

// 根布局使用 cookies() 读取配色主题（SSR 注入防闪烁），整站已为动态渲染；
// 此处显式声明 force-dynamic，避免运行时 static→dynamic 冲突导致 500。
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ section: string }>
}

export default async function DynamicSectionPage({ params }: Props) {
  const { section: sectionSlug } = await params

  // 获取板块信息 — 用 path 匹配 URL，因为 slug 可能和 URL 不一致（如 token_plan vs token-plan）
  let section: Section | null = null
  try {
    const sections = await fetchSections()
    section = sections.find((s: Section) => s.path === `/${sectionSlug}`) || null
    if (!section) {
      const normalizedSlug = sectionSlug.replace(/_/g, '-')
      section = sections.find((s: Section) => s.path === `/${normalizedSlug}`) || null
    }
  } catch {
    // 降级处理
  }

  if (!section) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-t-text-primary mb-2">板块未找到</h1>
          <p className="text-t-text-secondary">该板块不存在或已被删除</p>
        </div>
      </div>
    )
  }

  return (
    <SectionPageClient
      section={section.slug}
      sectionPath={section.path}
      title={section.name}
      description={section.description}
      sectionLayouts={section.layouts}
    />
  )
}

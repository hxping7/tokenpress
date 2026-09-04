'use client'

import { StandardArticle } from '@/components/article/templates/StandardArticle'
import { PhotoEssayArticle } from '@/components/article/templates/PhotoEssayArticle'
import { VideoArticle } from '@/components/article/templates/VideoArticle'
import { CodeShowcaseArticle } from '@/components/article/templates/CodeShowcaseArticle'
import { TimelineArticle } from '@/components/article/templates/TimelineArticle'
import { SplitMediaArticle } from '@/components/article/templates/SplitMediaArticle'
import { StoryArticle } from '@/components/article/templates/StoryArticle'
import type { ShareConfig } from '@/components/article/ArticleHeader'
import type { ArticleTemplateKey } from '@/lib/articleTemplates'

interface Props {
  template: ArticleTemplateKey
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: any
}

/** 根据文章模板 key 分发到对应渲染组件 */
export function ArticleTemplateRenderer({ template, article, section, sectionLabel, shareConfig, layout }: Props) {
  const common = { article, section, sectionLabel, shareConfig }

  switch (template) {
    case 'photo-essay':
      return <PhotoEssayArticle {...common} layout={layout} />
    case 'video-post':
      return <VideoArticle {...common} layout={layout} />
    case 'code-showcase':
      return <CodeShowcaseArticle {...common} layout={layout} />
    case 'timeline':
      return <TimelineArticle {...common} layout={layout} />
    case 'split-media':
      return <SplitMediaArticle {...common} layout={layout} />
    case 'story':
      return <StoryArticle {...common} layout={layout} />
    case 'standard':
    default:
      return <StandardArticle {...common} layout={layout} />
  }
}

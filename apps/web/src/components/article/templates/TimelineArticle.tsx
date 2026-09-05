'use client'

import { MarkdownContent } from '@/components/MarkdownContent'
import { ArticleViewTracker } from '@/components/ArticleViewTracker'
import { ArticleHeader, ArticleFooter } from '@/components/article/ArticleHeader'
import type { ShareConfig } from '@/components/article/ArticleHeader'

interface TimelineEvent {
  date?: string
  title?: string
  text?: string
}

interface Props {
  article: any
  section: string
  sectionLabel: string
  shareConfig: ShareConfig
  layout: any
}

/** 从 Markdown 的二级标题切分时间线事件（标题取 ## 文本，内容取其下段落） */
function parseEventsFromMarkdown(content: string): TimelineEvent[] {
  if (!content) return []
  const lines = content.split('\n')
  const events: TimelineEvent[] = []
  let cur: TimelineEvent | null = null
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/)
    if (h) {
      if (cur) events.push(cur)
      cur = { title: h[1].trim(), text: '' }
    } else if (cur) {
      cur.text = (cur.text || '') + line + '\n'
    }
  }
  if (cur) events.push(cur)
  return events
}

/** 时间线：竖向时间线 + 交替左右内容块，适合发展史 / 更新日志 */
export function TimelineArticle({ article, section, sectionLabel, shareConfig }: Props) {
  const config = (article.templateConfig || {}) as { events?: TimelineEvent[] }
  const events: TimelineEvent[] = Array.isArray(config.events) && config.events.length
    ? config.events
    : parseEventsFromMarkdown(article.content || '')

  return (
    <article className="min-h-screen pt-[var(--header-actual-height)]">
      <ArticleViewTracker articleId={article.id} />
      <ArticleHeader article={article} section={section} sectionLabel={sectionLabel} shareConfig={shareConfig} />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {events.length === 0 && (
          <div className="text-t-text-secondary">
            <MarkdownContent content={article.content} />
          </div>
        )}

        <div className="relative">
          {/* 中轴线 */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-t-border -translate-x-1/2" />

          <div className="space-y-8">
            {events.map((ev, i) => {
              const left = i % 2 === 0
              return (
                <div key={i} className="relative flex items-start gap-4 md:gap-0">
                  {/* 节点圆点 */}
                  <div className="absolute left-4 md:left-1/2 top-1.5 w-3 h-3 rounded-full bg-t-accent-purple ring-4 ring-t-bg-primary -translate-x-1/2 z-10" />

                  <div className={`ml-10 md:ml-0 md:w-1/2 ${left ? 'md:pr-10 md:text-right' : 'md:pl-10 md:ml-auto'}`}>
                    <div className="rounded-xl border border-t-border bg-t-bg-secondary p-4">
                      {ev.date && (
                        <div className="text-xs text-t-accent-purple font-medium mb-1">{ev.date}</div>
                      )}
                      {ev.title && (
                        <h3 className="text-lg text-t-text-primary mb-2">{ev.title}</h3>
                      )}
                      {ev.text && ev.text.trim() && (
                        <div className="text-sm text-t-text-secondary text-left">
                          <MarkdownContent content={ev.text.trim()} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ArticleFooter article={article} shareConfig={shareConfig} />
    </article>
  )
}

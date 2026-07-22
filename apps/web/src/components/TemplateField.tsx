'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TEMPLATES, getTemplate, magazinePreviewSvg, type TemplateKey } from '@/lib/templates'
import { api } from '@/lib/api'

interface Props {
  label: string
  value: string
  onChange: (key: string) => void
  config?: Record<string, unknown> | null
  onConfigChange?: (config: Record<string, unknown>) => void
  exclude?: TemplateKey[]
  /** 分类编辑器专属：增加「继承板块」选项（value=''，前端解析时回退到板块模板） */
  showInherit?: boolean
  hint?: string
  /** 当前激活风格包的 templates[模板] 默认配置，用于展示「继承来源」与一键恢复 */
  packTemplates?: Record<string, Record<string, unknown>> | null
  /** 单页模板「绑定文章」下拉所需的板块路径（用于拉取该板块文章列表）。不传则退化为手动输入 ID。 */
  sectionSlug?: string
}

const CARD_STYLE_LABEL: Record<string, string> = {
  bordered: '描边',
  clean: '简洁',
  shadow: '阴影',
  zoom: '缩放',
}

/**
 * 模板选择字段：下拉 + 实时 SVG 预览 + 可选配置（列数 / 文章 ID）。
 * 用于后台「板块 / 分类」编辑表单。
 */
export function TemplateField({ label, value, onChange, config, onConfigChange, exclude, showInherit, hint, packTemplates, sectionSlug }: Props) {
  const meta = getTemplate(value)
  const options = TEMPLATES.filter((t) => !exclude?.includes(t.key))
  const columns = Number(config?.columns) || 3
  const articleId = config?.articleId ? Number(config.articleId) : undefined
  const magazineLayout = (config?.magazineLayout as 'top' | 'left') || 'top'
  const featuredArticleId = config?.featuredArticleId ? Number(config.featuredArticleId) : undefined
  const headlineBasis = (config?.headlineBasis as 'smart' | 'latest' | 'hot') || 'smart'
  const packDefault = value ? (packTemplates?.[value] as Record<string, unknown> | undefined) : undefined
  const hasUserOverride = !!config && Object.keys(config).length > 0

  // 单页 / 杂志头条 的「绑定文章」下拉：拉取该板块文章列表
  const { data: articleOptions } = useQuery({
    queryKey: ['template-field-articles', sectionSlug],
    queryFn: () => api.getArticles({ section: sectionSlug as string, limit: 100 }),
    enabled: !!sectionSlug && (value === 'single-page' || value === 'magazine'),
  })
  const articleList = (articleOptions?.data as Array<{ id: number; title: string }>) || []

  const handleTemplateChange = (v: string) => {
    onChange(v)
    // 切换模板时重置配置
    if (onConfigChange) {
      const newMeta = getTemplate(v)
      if (newMeta.key === 'single-page') {
        onConfigChange({})
      } else if (newMeta.hasConfig) {
        onConfigChange({ columns: newMeta.key === 'article-masonry' ? 2 : 3 })
      } else {
        onConfigChange({})
      }
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => handleTemplateChange(e.target.value)}
        className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
      >
        {showInherit && (
          <option value="">继承板块（跟随板块模板）</option>
        )}
        {options.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>

      {/* 预览图：杂志头条提供「上下 / 左右」两枚可选预览，选中态高亮，与实际渲染一致 */}
      {value === 'magazine' && onConfigChange ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['top', 'left'] as const).map((ly) => (
            <button
              key={ly}
              type="button"
              onClick={() => onConfigChange({ ...(config || {}), magazineLayout: ly })}
              className={`rounded-lg overflow-hidden border text-left transition-colors ${
                magazineLayout === ly ? 'border-t-accent-blue ring-1 ring-t-accent-blue' : 'border-t-border hover:border-t-accent-blue/60'
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: magazinePreviewSvg(ly) }} />
              <div className="text-center text-xs py-1 bg-t-bg-secondary text-t-text-secondary">
                {ly === 'top' ? '上下' : '左右'}
              </div>
            </button>
          ))}
        </div>
      ) : value && (
        <div
          className="mt-3 rounded-lg border border-t-border overflow-hidden bg-t-bg-secondary"
          dangerouslySetInnerHTML={{ __html: meta.previewSvg }}
        />
      )}

      {value && <p className="mt-2 text-sm text-t-text-secondary">{meta.description}</p>}
      {showInherit && !value && (
        <p className="mt-2 text-sm text-t-text-muted">将使用所属板块的模板设置</p>
      )}
      {hint && <p className="mt-1 text-xs text-t-text-muted">{hint}</p>}

      {/* 配置：列数（仅 grid / masonry / magazine） */}
      {meta.hasConfig && onConfigChange && (
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-t-text-secondary">列数</label>
          <input
            type="number"
            min={1}
            max={4}
            value={columns}
            onChange={(e) => onConfigChange({ ...(config || {}), columns: Math.min(Math.max(Number(e.target.value) || 3, 1), 4) })}
            className="w-20 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
          />
        </div>
      )}

      {/* 配置：magazine 头条文章（指定）+ 自动选择依据 */}
      {value === 'magazine' && onConfigChange && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-t-text-secondary">
              指定头条文章（可选，留空则按下方依据自动选取）
            </label>
            {sectionSlug ? (
              <select
                value={featuredArticleId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onConfigChange({ ...(config || {}), featuredArticleId: v ? Number(v) : undefined })
                }}
                className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
              >
                <option value="">（自动：按依据选取）</option>
                {articleList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (#{a.id})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={featuredArticleId || ''}
                  placeholder="留空=自动"
                  onChange={(e) => {
                    const v = e.target.value
                    onConfigChange({ ...(config || {}), featuredArticleId: v ? Number(v) : undefined })
                  }}
                  className="w-28 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
                />
                <span className="text-xs text-t-text-muted">文章 ID（留空=自动选取）</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-t-text-secondary">头条自动选择依据（未指定时生效）</label>
            <select
              value={headlineBasis}
              onChange={(e) => onConfigChange({ ...(config || {}), headlineBasis: e.target.value })}
              className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
            >
              <option value="smart">智能（置顶优先 → 最新）</option>
              <option value="latest">最新发布</option>
              <option value="hot">热门（最多浏览）</option>
            </select>
            <span className="text-xs text-t-text-muted">优先级：指定 &gt; 置顶 &gt; 最新 &gt; 热门</span>
          </div>
        </div>
      )}

      {/* 配置：single-page 绑定文章 ID + 最新文章列表 */}
      {value === 'single-page' && onConfigChange && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-t-text-secondary">
              绑定文章（可选，留空=自动选取板块最新文章作为单页）
            </label>
            {sectionSlug ? (
              <select
                value={articleId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onConfigChange({ ...(config || {}), articleId: v ? Number(v) : undefined })
                }}
                className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
              >
                <option value="">（自动：板块最新文章）</option>
                {articleList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} (#{a.id})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  value={articleId || ''}
                  placeholder="留空=自动最新"
                  onChange={(e) => {
                    const v = e.target.value
                    onConfigChange({ ...(config || {}), articleId: v ? Number(v) : undefined })
                  }}
                  className="w-28 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
                />
                <span className="text-xs text-t-text-muted">文章 ID（留空=自动选取最新文章）</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-t-text-secondary">内容宽度</label>
            <select
              value={(config?.contentWidth as string) || 'wide'}
              onChange={(e) => onConfigChange({ ...(config || {}), contentWidth: e.target.value })}
              className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
            >
              <option value="reading">阅读（768px，适合长文）</option>
              <option value="wide">宽屏（960px，默认展示页）</option>
              <option value="full">撑满内容区</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-t-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={config?.showLatest !== false}
                onChange={(e) => onConfigChange({ ...(config || {}), showLatest: e.target.checked })}
                className="accent-t-accent-blue"
              />
              显示最新文章列表
            </label>
            {config?.showLatest !== false && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="text-xs text-t-text-muted">数量</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={Number(config?.showLatestCount) || 6}
                  onChange={(e) =>
                    onConfigChange({
                      ...(config || {}),
                      showLatestCount: Math.min(Math.max(Number(e.target.value) || 6, 1), 20),
                    })
                  }
                  className="w-16 px-2 py-1 bg-t-bg-secondary border border-t-border rounded text-sm"
                />
                <label className="text-xs text-t-text-muted">标题</label>
                <input
                  type="text"
                  value={String(config?.showLatestTitle || '')}
                  placeholder="最新文章"
                  onChange={(e) =>
                    onConfigChange({ ...(config || {}), showLatestTitle: e.target.value })
                  }
                  className="w-32 px-2 py-1 bg-t-bg-secondary border border-t-border rounded text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 风格包默认（继承来源） + 一键恢复 */}
      {meta.hasConfig && packDefault && (
        <div className="mt-3 rounded-lg border border-t-border bg-t-bg-secondary/50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-t-text-muted">
              风格包默认：
              {[
                packDefault.columns != null ? `列数 ${packDefault.columns}` : null,
                typeof packDefault.gap === 'string' ? `间距 ${packDefault.gap}` : null,
                typeof packDefault.cardStyle === 'string'
                  ? `卡片 ${CARD_STYLE_LABEL[packDefault.cardStyle as string] || (packDefault.cardStyle as string)}`
                  : null,
                typeof packDefault.aspectRatio === 'string' ? `封面 ${packDefault.aspectRatio}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '（无额外默认）'}
            </span>
            {hasUserOverride && onConfigChange && (
              <button
                type="button"
                onClick={() => onConfigChange({})}
                className="shrink-0 px-2 py-0.5 rounded text-xs text-t-accent-blue hover:bg-t-accent-blue/10"
              >
                恢复默认
              </button>
            )}
          </div>
          {!hasUserOverride && (
            <p className="mt-1 text-xs text-t-text-muted">当前即使用风格包默认，无需额外配置。</p>
          )}
        </div>
      )}
    </div>
  )
}

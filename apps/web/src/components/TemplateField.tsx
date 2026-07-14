'use client'

import { TEMPLATES, getTemplate, type TemplateKey } from '@/lib/templates'

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
}

/**
 * 模板选择字段：下拉 + 实时 SVG 预览 + 可选配置（列数 / 文章 ID）。
 * 用于后台「板块 / 分类」编辑表单。
 */
export function TemplateField({ label, value, onChange, config, onConfigChange, exclude, showInherit, hint }: Props) {
  const meta = getTemplate(value)
  const options = TEMPLATES.filter((t) => !exclude?.includes(t.key))
  const columns = Number(config?.columns) || 3
  const articleId = config?.articleId ? Number(config.articleId) : undefined

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

      {/* 预览图（继承时不显示积木图） */}
      {value && (
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

      {/* 配置：single-page 绑定文章 ID（可选） */}
      {value === 'single-page' && onConfigChange && (
        <div className="mt-3 flex items-center gap-3">
          <label className="text-sm text-t-text-secondary">文章 ID（可选）</label>
          <input
            type="number"
            min={1}
            value={articleId || ''}
            placeholder="留空=板块描述"
            onChange={(e) => {
              const v = e.target.value
              onConfigChange({ ...(config || {}), articleId: v ? Number(v) : undefined })
            }}
            className="w-28 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue text-sm"
          />
          <span className="text-xs text-t-text-muted">留空则展示板块描述；填入数字展示对应文章正文</span>
        </div>
      )}
    </div>
  )
}

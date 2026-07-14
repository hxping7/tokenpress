'use client'

import { TEMPLATES, getTemplate, type TemplateKey } from '@/lib/templates'

interface Props {
  label: string
  value: string
  onChange: (key: string) => void
  config?: Record<string, unknown> | null
  onConfigChange?: (config: Record<string, unknown>) => void
  exclude?: TemplateKey[]
  hint?: string
}

/**
 * 模板选择字段：下拉 + 实时 SVG 预览 + 可选配置（列数）。
 * 用于后台「板块 / 分类」编辑表单。
 */
export function TemplateField({ label, value, onChange, config, onConfigChange, exclude, hint }: Props) {
  const meta = getTemplate(value)
  const options = TEMPLATES.filter((t) => !exclude?.includes(t.key))
  const columns = Number(config?.columns) || 3

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
      >
        {options.map((t) => (
          <option key={t.key} value={t.key}>{t.label}</option>
        ))}
      </select>

      {/* 预览图 */}
      <div
        className="mt-3 rounded-lg border border-t-border overflow-hidden bg-t-bg-secondary"
        dangerouslySetInnerHTML={{ __html: meta.previewSvg }}
      />

      <p className="mt-2 text-sm text-t-text-secondary">{meta.description}</p>
      {hint && <p className="mt-1 text-xs text-t-text-muted">{hint}</p>}

      {/* 配置：列数 */}
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
    </div>
  )
}

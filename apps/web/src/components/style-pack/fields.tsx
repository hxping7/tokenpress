'use client'

import { useState, type ReactNode } from 'react'

// ===== 通用字段容器：标签 + 说明 + 控件 + 可选预览 =====
export function Field({
  label,
  desc,
  children,
  preview,
}: {
  label: string
  desc?: string
  children: ReactNode
  preview?: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="block text-sm font-medium text-t-text-primary">{label}</label>
        {desc && <p className="text-xs text-t-text-muted mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {children}
      {preview && <div className="mt-2">{preview}</div>}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue"
    />
  )
}

export function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary font-mono outline-none focus:border-t-accent-blue resize-y leading-relaxed"
    />
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
        className="w-28 px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue"
      />
      {suffix && <span className="text-xs text-t-text-muted">{suffix}</span>}
    </div>
  )
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-t-accent-blue"
      />
      <span className="text-sm text-t-text-primary w-20 text-right tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  )
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; hint?: string }[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm text-t-text-primary outline-none focus:border-t-accent-blue"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {options.find((o) => o.value === value)?.hint && (
        <p className="text-xs text-t-text-muted">
          {options.find((o) => o.value === value)?.hint}
        </p>
      )}
    </div>
  )
}

export function ColorInput({
  value,
  onChange,
  allowEmpty,
}: {
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
}) {
  const [text, setText] = useState(value || '')
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value || '') ? value : ''
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex || '#000000'}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value)
        }}
        className="w-10 h-9 rounded-lg border border-t-border bg-t-bg-secondary cursor-pointer p-1"
      />
      <input
        value={text}
        placeholder={allowEmpty ? '继承主题色' : '#rrggbb'}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          if (v === '' && allowEmpty) onChange('')
          else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) onChange(v)
        }}
        className="flex-1 px-3 py-2 rounded-lg bg-t-bg-secondary border border-t-border text-sm font-mono text-t-text-primary outline-none focus:border-t-accent-blue"
      />
    </div>
  )
}

export function Toggle({
  value,
  onChange,
  labelOn = '开',
  labelOff = '关',
}: {
  value: boolean
  onChange: (v: boolean) => void
  labelOn?: string
  labelOff?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        value
          ? 'border-t-accent-blue text-t-accent-blue bg-t-accent-blue/10'
          : 'border-t-border text-t-text-secondary'
      }`}
    >
      <span
        className={`w-9 h-5 rounded-full relative transition-colors ${value ? 'bg-t-accent-blue' : 'bg-t-border'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
            value ? 'left-4' : 'left-0.5'
          }`}
        />
      </span>
      {value ? labelOn : labelOff}
    </button>
  )
}

// ===== 迷你预览：文章网格（用于模板样式实时预览）=====
export function MiniGrid({
  columns,
  gap,
  cardStyle,
  aspect = '4/3',
  showThumbnail = true,
  count = 6,
}: {
  columns: number
  gap: number
  cardStyle: string
  aspect?: string
  showThumbnail?: boolean
  count?: number
}) {
  const cardCls =
    cardStyle === 'zoom'
      ? 'overflow-hidden rounded-xl border border-t-border bg-t-bg-secondary group'
      : cardStyle === 'shadow'
        ? 'overflow-hidden rounded-xl border border-t-border bg-t-bg-secondary shadow-md'
        : cardStyle === 'clean'
          ? 'overflow-hidden rounded-xl bg-t-bg-secondary'
          : 'overflow-hidden rounded-xl border border-t-border bg-t-bg-secondary'
  return (
    <div
      className="w-full"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, Math.min(columns, 6))}, minmax(0, 1fr))`,
        gap: `${gap}rem`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cardCls}>
          {showThumbnail && (
            <div
              className="w-full bg-gradient-to-br from-t-accent-blue/30 to-t-accent-purple/30"
              style={{ aspectRatio: aspect }}
            />
          )}
          <div className="p-2.5 space-y-1.5">
            <div className="h-3 w-4/5 rounded bg-t-border" />
            <div className="h-2.5 w-full rounded bg-t-border/70" />
            <div className="h-2.5 w-2/3 rounded bg-t-border/70" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== 迷你预览：导航条形态 =====
export function MiniNav({
  position,
  align,
  navStyle,
  colors,
  width = 200,
  height = 48,
}: {
  position: 'top' | 'left'
  align: string
  navStyle: string
  colors: any
  width?: number
  height?: number
}) {
  const barBg = colors?.barBg || 'var(--bg-secondary)'
  const barText = colors?.barText || 'var(--text-primary)'
  const itemText = colors?.text || 'var(--text-secondary)'
  const activeBg = colors?.activeBg || 'var(--accent-blue)'
  const items = ['首页', '板块', '博客', '作品']
  const linkCls = 'px-2.5 py-1 text-[11px] rounded'
  if (position === 'left') {
    return (
      <div
        className="rounded-lg overflow-hidden border border-t-border"
        style={{ width, background: barBg, color: barText, height: 150 }}
      >
        <div className="h-9 flex items-center px-3 border-b border-t-border/60 font-semibold text-xs">
          LOGO
        </div>
        <div className="flex flex-col gap-1 p-2">
          {items.map((it, i) => (
            <div
              key={it}
              className={linkCls}
              style={{
                color: i === 0 ? '#fff' : itemText,
                background: i === 0 ? activeBg : 'transparent',
              }}
            >
              {it}
            </div>
          ))}
        </div>
      </div>
    )
  }
  const justify =
    align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end'
  return (
    <div
      className={`flex items-center gap-1 rounded-lg overflow-hidden border border-t-border px-3 ${justify}`}
      style={{ height, background: barBg, color: barText }}
    >
      <div className="font-semibold text-xs mr-3" style={{ color: barText }}>
        LOGO
      </div>
      {items.map((it, i) => (
        <div
          key={it}
          className={linkCls}
          style={{
            color: i === 0 ? '#fff' : itemText,
            background: i === 0 ? activeBg : 'transparent',
            borderRadius: navStyle === 'pill' ? 999 : navStyle === 'plain' ? 0 : 8,
          }}
        >
          {it}
        </div>
      ))}
    </div>
  )
}

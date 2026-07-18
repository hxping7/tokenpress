'use client'

import { useState } from 'react'
import {
  Field, TextInput, TextArea, NumberInput, SelectInput, ColorInput, Toggle, Slider, MiniGrid, MiniNav,
} from './fields'
import {
  getIn, setIn, deleteIn, TEMPLATE_KEYS, TEMPLATE_LABELS, defaultTemplateConfig,
  CARD_STYLE_OPTIONS, HOVER_OPTIONS, NAV_POSITION_OPTIONS, NAV_STYLE_OPTIONS,
  NAV_ALIGN_OPTIONS, HEADER_VARIANT_OPTIONS, LOGO_POSITION_OPTIONS, NAV_COLOR_FIELDS, ASPECT_OPTIONS,
} from './schema'
import { WIDTH_PRESETS } from '@/lib/layout-config'

export type StyleDraft = {
  manifest: { name?: string; description?: string; version?: string }
  theme: string
  layouts: any
  header: any
  footer: any
}

const TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'theme', label: '配色主题' },
  { key: 'nav', label: '全局导航' },
  { key: 'home', label: '首页' },
  { key: 'section', label: '板块' },
  { key: 'category', label: '分类' },
  { key: 'article', label: '内容' },
  { key: 'templates', label: '模板样式' },
  { key: 'foot', label: '页脚' },
] as const

const HOMEPAGE_COMPONENTS = ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner', 'CustomBlock']

export function StylePackForm({
  draft,
  onChange,
}: {
  draft: StyleDraft
  onChange: (next: StyleDraft) => void
}) {
  const [tab, setTab] = useState<string>('basic')
  const [actionsText, setActionsText] = useState('')

  const set = (path: string, value: any) => onChange(setIn(draft, path, value) as StyleDraft)
  const get = (path: string, fallback?: any) => {
    const v = getIn(draft, path)
    return v === undefined || v === null ? fallback : v
  }

  const updateManifest = (k: string, v: any) =>
    onChange({ ...draft, manifest: { ...draft.manifest, [k]: v } })

  // ===== 首页 section 数组编辑 =====
  const homeSections: any[] = get('layouts.homepage.sections', []) || []
  const setHomeSections = (next: any[]) => set('layouts.homepage.sections', next)
  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= homeSections.length) return
    const arr = [...homeSections]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setHomeSections(arr)
  }
  const removeSection = (i: number) => setHomeSections(homeSections.filter((_, idx) => idx !== i))
  const addSection = (component: string) =>
    component === 'CustomBlock'
      ? setHomeSections([...homeSections, { component, props: { title: '自定义区块', intro: '', columns: 3, items: [] } }])
      : setHomeSections([...homeSections, { component }])

  // 更新某首页区块（按索引）
  const updateHomeSection = (i: number, next: any) => {
    const arr = [...homeSections]
    arr[i] = next
    setHomeSections(arr)
  }

  // ===== 模板样式 helpers =====
  const tmplCfg = (key: string) => get(`layouts.templates.${key}`, {}) || {}

  const navColors = get('header.nav.colors', {}) || {}

  return (
    <div className="flex flex-col h-full">
      {/* Tab 头 */}
      <div className="flex flex-wrap gap-1 px-4 pt-3 border-b border-t-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm rounded-t-lg transition-colors ${
              tab === t.key
                ? 'text-t-accent-blue bg-t-bg-secondary'
                : 'text-t-text-secondary hover:text-t-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {tab === 'basic' && (
          <>
            <Field label="名称" desc="风格包显示名">
              <TextInput value={draft.manifest.name || ''} onChange={(v) => updateManifest('name', v)} />
            </Field>
            <Field label="描述" desc="一句话说明这套风格的定位">
              <TextArea value={draft.manifest.description || ''} onChange={(v) => updateManifest('description', v)} rows={2} />
            </Field>
            <Field label="版本" desc="语义化版本号，如 1.0.0">
              <TextInput value={draft.manifest.version || ''} onChange={(v) => updateManifest('version', v)} />
            </Field>
            <Field label="全局内容宽度" desc="全站内容容器最大宽度（Header/Footer/首页/板块/文章统一生效）。留空则使用 CSS 默认 80rem（1280px）。">
              <SelectInput
                value={get('layouts.container.maxWidth', '')}
                onChange={(v) =>
                  v
                    ? set('layouts.container.maxWidth', v)
                    : onChange(deleteIn(draft, 'layouts.container.maxWidth'))
                }
                options={[
                  { value: '', label: '默认 (80rem)' },
                  ...WIDTH_PRESETS.map((p) => ({ value: p.value, label: p.label })),
                ] as any}
              />
            </Field>
          </>
        )}

        {tab === 'theme' && (
          <Field
            label="配色主题（theme.css）"
            desc="以 :root { --var: value; } 声明 CSS 变量，仅允许变量声明，禁止 @import / url() / 脚本。这是整站配色皮肤。"
          >
            <TextArea value={draft.theme || ''} onChange={(v) => onChange({ ...draft, theme: v })} rows={10} />
          </Field>
        )}

        {tab === 'nav' && (
          <>
            <Field label="导航形态" desc="顶部横向导航，或浏览器左侧竖向导航（主内容整体右移）。" preview={
              <MiniNav
                position={get('header.nav.position', 'top')}
                align={get('header.nav.align', 'right')}
                navStyle={get('header.nav.style', 'underline')}
                colors={navColors}
                width={get('header.nav.width', 220)}
                height={get('header.nav.height', 56)}
              />
            }>
              <SelectInput
                value={get('header.nav.position', 'top')}
                onChange={(v) => set('header.nav.position', v)}
                options={NAV_POSITION_OPTIONS as any}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="导航高度" desc="顶部导航条高度（px）">
                <NumberInput value={Number(get('header.nav.height', 56))} onChange={(v) => set('header.nav.height', v)} min={40} max={120} suffix="px" />
              </Field>
              {get('header.nav.position', 'top') === 'left' && (
                <Field label="侧栏宽度" desc="左侧导航栏宽度（px）">
                  <NumberInput value={Number(get('header.nav.width', 220))} onChange={(v) => set('header.nav.width', v)} min={160} max={360} suffix="px" />
                </Field>
              )}
              {get('header.nav.position', 'top') === 'top' && (
                <Field label="横向对齐" desc="菜单相对导航栏的对齐方式">
                  <SelectInput value={get('header.nav.align', 'right')} onChange={(v) => set('header.nav.align', v)} options={NAV_ALIGN_OPTIONS as any} />
                </Field>
              )}
            </div>

            <Field label="菜单项样式" desc="下划线 / 胶囊 / 纯文字">
              <SelectInput value={get('header.nav.style', 'underline')} onChange={(v) => set('header.nav.style', v)} options={NAV_STYLE_OPTIONS as any} />
            </Field>

            <Field label="顶栏变体" desc="吸顶不透明 / 吸顶透明（配大图 Hero）/ 随页面滚动">
              <SelectInput value={get('header.variant', 'sticky-solid')} onChange={(v) => set('header.variant', v)} options={HEADER_VARIANT_OPTIONS as any} />
            </Field>

            <Field label="Logo 位置" desc="顶部模式下 Logo 在左 / 居中（上排）/ 右">
              <SelectInput value={get('header.logo.position', 'left')} onChange={(v) => set('header.logo.position', v)} options={LOGO_POSITION_OPTIONS as any} />
            </Field>

            <div className="border-t border-t-border pt-4">
              <p className="text-sm font-medium text-t-text-primary mb-3">菜单颜色效果</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {NAV_COLOR_FIELDS.map((cf) => (
                  <Field key={cf.path} label={cf.label} desc={cf.desc}>
                    <ColorInput
                      value={get(cf.path, '') || ''}
                      allowEmpty
                      onChange={(v) => set(cf.path, v)}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <Field label="导航栏背景（整体）" desc="留空则跟随主题色；可覆盖为任何颜色或渐变。">
              <TextInput value={get('header.background', '') || ''} onChange={(v) => set('header.background', v)} placeholder="如 #0b1020 或 linear-gradient(...)" />
            </Field>
            <Field label="导航栏下边框" desc="CSS border-bottom，如 1px solid rgba(255,255,255,.08)">
              <TextInput value={get('header.borderBottom', '') || ''} onChange={(v) => set('header.borderBottom', v)} />
            </Field>

            <details className="border border-t-border rounded-lg p-3">
              <summary className="cursor-pointer text-sm text-t-text-secondary">高级：右上角操作按钮（actions）JSON</summary>
              <TextArea
                value={actionsText || JSON.stringify(get('header.actions', []), null, 2)}
                onChange={(v) => {
                  setActionsText(v)
                  try {
                    const parsed = JSON.parse(v)
                    set('header.actions', parsed)
                  } catch {
                    /* 等待合法 JSON */
                  }
                }}
                rows={6}
              />
              <p className="text-xs text-t-text-muted mt-1">type: theme|language|admin|login|logout|link|divider；style: icon|text|ghost|outline|primary|pill。icon 可填 lucide 名，也可填内联 SVG 字符串（自定义图标，无需改代码）；link 支持 target:&apos;_blank&apos;。修改后下方 JSON 即时解析写入。</p>
            </details>
          </>
        )}

        {tab === 'home' && (
          <>
            <Field
              label="首页区块顺序"
              desc="首页由这些区块按顺序组成。调整顺序或移除，右侧实时预览会随之变化。"
            >
              <div className="space-y-2">
                {homeSections.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-t-border bg-t-bg-secondary px-3 py-2">
                    <span className="text-sm text-t-text-primary flex-1">{s.component}</span>
                    <button onClick={() => moveSection(i, -1)} className="px-2 py-1 text-xs rounded bg-t-hover text-t-text-secondary hover:text-t-text-primary">↑</button>
                    <button onClick={() => moveSection(i, 1)} className="px-2 py-1 text-xs rounded bg-t-hover text-t-text-secondary hover:text-t-text-primary">↓</button>
                    <button onClick={() => removeSection(i)} className="px-2 py-1 text-xs rounded bg-t-hover text-red-400 hover:text-red-300">✕</button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  {HOMEPAGE_COMPONENTS.filter((c) => !homeSections.some((s: any) => s.component === c)).map((c) => (
                    <button key={c} onClick={() => addSection(c)} className="px-3 py-1.5 text-xs rounded-lg border border-t-accent-blue/60 text-t-accent-blue hover:bg-t-accent-blue/10">
                      + {c}
                    </button>
                  ))}
                </div>
              </div>
            </Field>

            {homeSections.map((s: any, i: number) =>
              s.component === 'CustomBlock' ? (
                <Field key={`cb-${i}`} label={`自定义区块 #${i + 1} 配置（CustomBlock）`} desc="纯 JSON 驱动，可拼装标题/介绍/条目网格/CTA/背景，无需改代码。">
                  <TextArea
                    value={JSON.stringify(s.props || {}, null, 2)}
                    onChange={(v) => {
                      try {
                        const parsed = JSON.parse(v)
                        updateHomeSection(i, { component: 'CustomBlock', props: parsed })
                      } catch { /* 等待合法 JSON */ }
                    }}
                    rows={8}
                  />
                </Field>
              ) : null,
            )}
          </>
        )}

        {(['section', 'category'] as const).map((scope) => (
          <div key={scope} style={{ display: tab === scope ? 'block' : 'none' }}>
            <Field label={scope === 'section' ? '板块页面骨架' : '分类页面骨架'} desc={scope === 'section' ? '所有板块列表页的默认结构；分类可逐层覆盖。' : '所有分类页的默认结构（由分类级 layouts 覆盖板块）。'}>
              <SelectInput
                value={get(`layouts.${scope}.layout`, 'article-list')}
                onChange={(v) => set(`layouts.${scope}.layout`, v)}
                options={[
                  { value: 'article-list', label: '文章流（默认）' },
                  { value: 'page-sidebar-left', label: '左栏 + 内容' },
                  { value: 'page-sidebar-right', label: '内容 + 右栏' },
                  { value: 'landing', label: '落地页（无侧栏）' },
                ] as any}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="显示 Hero 头图" desc="页面顶部大图标题区">
                <Toggle value={!!get(`layouts.${scope}.hero.enabled`, false)} onChange={(v) => set(`layouts.${scope}.hero.enabled`, v)} />
              </Field>
              {get(`layouts.${scope}.hero.enabled`, false) && (
                <Field label="Hero 标题来源" desc="用板块/分类名，或自定义文字">
                  <SelectInput
                    value={get(`layouts.${scope}.hero.titleFrom`, 'section')}
                    onChange={(v) => set(`layouts.${scope}.hero.titleFrom`, v)}
                    options={[
                      { value: 'section', label: scope === 'section' ? '板块名' : '分类名' },
                      { value: 'custom', label: '自定义' },
                    ] as any}
                  />
                </Field>
              )}
              <Field label="显示侧栏" desc="左/右栏（如分类导航、筛选）">
                <Toggle value={!!get(`layouts.${scope}.sidebar.enabled`, false)} onChange={(v) => set(`layouts.${scope}.sidebar.enabled`, v)} />
              </Field>
              {get(`layouts.${scope}.sidebar.enabled`, false) && (
                <Field label="侧栏位置" desc="左或右">
                  <SelectInput
                    value={get(`layouts.${scope}.sidebar.position`, 'left')}
                    onChange={(v) => set(`layouts.${scope}.sidebar.position`, v)}
                    options={[{ value: 'left', label: '左' }, { value: 'right', label: '右' }] as any}
                  />
                </Field>
              )}
              <Field label="列表布局" desc="列表页文章排列方式">
                <SelectInput
                  value={get(`layouts.${scope}.list.layout`, 'grid')}
                  onChange={(v) => set(`layouts.${scope}.list.layout`, v)}
                  options={[
                    { value: 'grid', label: '网格' },
                    { value: 'list', label: '列表' },
                    { value: 'masonry', label: '瀑布流' },
                  ] as any}
                />
              </Field>
              <Field label="列表列数" desc="网格/瀑布流列数（1-4）">
                <NumberInput value={Number(get(`layouts.${scope}.list.columns`, 3))} onChange={(v) => set(`layouts.${scope}.list.columns`, v)} min={1} max={4} />
              </Field>
            </div>
          </div>
        ))}

        {tab === 'article' && (
          <>
            <Field label="详情页布局" desc="单篇文章的排版骨架">
              <SelectInput
                value={get('layouts.article.layout', 'article-list')}
                onChange={(v) => set('layouts.article.layout', v)}
                options={[
                  { value: 'article-list', label: '正文 + 右栏（默认）' },
                  { value: 'page-sidebar-left', label: '左栏 + 正文' },
                  { value: 'landing', label: '纯净正文（无栏）' },
                ] as any}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="显示目录 TOC" desc="长文左侧/右侧显示章节目录">
                <Toggle value={!!get('layouts.article.showTOC', false)} onChange={(v) => set('layouts.article.showTOC', v)} />
              </Field>
              <Field label="正文最大宽度" desc="正文阅读区最大宽度（px），留空随容器">
                <NumberInput value={Number(get('layouts.article.maxWidth', 0)) || 0} onChange={(v) => set('layouts.article.maxWidth', v)} min={600} max={1200} suffix="px" />
              </Field>
            </div>
          </>
        )}

        {tab === 'templates' && (
          <div className="space-y-6">
            {TEMPLATE_KEYS.map((key) => {
              const cfg = tmplCfg(key)
              const columns = Number(cfg.columns ?? (key === 'link-wall' ? 4 : 3))
              const gap = Number(cfg.gap ?? 1.5)
              const aspect = String(cfg.aspectRatio ?? (key === 'article-masonry' ? 'auto' : '4/3'))
              const cardStyle = String(cfg.cardStyle ?? (key === 'design-gallery' ? 'clean' : 'bordered'))
              const showThumbnail = cfg.showThumbnail !== false
              const isLinkWall = key === 'link-wall'
              const isSingle = key === 'single-page'
              if (isSingle) {
                return (
                  <div key={key} className="border border-t-border rounded-xl p-4">
                    <p className="text-sm font-medium text-t-text-primary">{TEMPLATE_LABELS[key]}</p>
                    <p className="text-xs text-t-text-muted mt-1">单页模板无需列表样式，直接渲染描述或指定文章正文。</p>
                  </div>
                )
              }
              return (
                <div key={key} className="border border-t-border rounded-xl p-4 space-y-4">
                  <p className="text-sm font-medium text-t-text-primary">{TEMPLATE_LABELS[key]}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!isLinkWall && (
                      <Field label="列数" desc="一行展示几列">
                        <NumberInput value={columns} onChange={(v) => set(`layouts.templates.${key}.columns`, v)} min={1} max={6} />
                      </Field>
                    )}
                    <Field label="间距" desc="卡片之间间距">
                      <Slider value={gap} onChange={(v) => set(`layouts.templates.${key}.gap`, v)} min={0.5} max={3} step={0.25} suffix="rem" />
                    </Field>
                    {isLinkWall ? (
                      <Field label="胶囊样式" desc="链接以胶囊标签呈现">
                        <Toggle value={!!cfg.pill} onChange={(v) => set(`layouts.templates.${key}.pill`, v)} />
                      </Field>
                    ) : (
                      <>
                        <Field label="缩略图比例" desc="封面图宽高比（瀑布流用自适应）">
                          <SelectInput value={aspect as any} onChange={(v) => set(`layouts.templates.${key}.aspectRatio`, v)} options={ASPECT_OPTIONS as any} />
                        </Field>
                        <Field label="卡片样式" desc="边框 / 阴影 / 极简 / 悬停放大">
                          <SelectInput value={cardStyle as any} onChange={(v) => set(`layouts.templates.${key}.cardStyle`, v)} options={CARD_STYLE_OPTIONS as any} />
                        </Field>
                        <Field label="悬停效果" desc="鼠标移过卡片时的动效">
                          <SelectInput value={String(cfg.hover ?? 'lift') as any} onChange={(v) => set(`layouts.templates.${key}.hover`, v)} options={HOVER_OPTIONS as any} />
                        </Field>
                        <Field label="显示缩略图" desc="是否展示封面图">
                          <Toggle value={showThumbnail} onChange={(v) => set(`layouts.templates.${key}.showThumbnail`, v)} />
                        </Field>
                        <Field label="显示摘要" desc="卡片是否展示文章摘要文字">
                          <Toggle value={cfg.showExcerpt !== false} onChange={(v) => set(`layouts.templates.${key}.showExcerpt`, v)} />
                        </Field>
                      </>
                    )}
                  </div>
                  <div className="border-t border-t-border pt-3">
                    <p className="text-xs text-t-text-muted mb-2">实时预览</p>
                    {isLinkWall ? (
                      <div className="flex flex-wrap gap-2">
                        {['Token00', 'AI 编程', '作品集', '博客', '资源', '导航'].map((t) => (
                          <span key={t} className={`px-3 py-1 text-sm rounded-full border border-t-border bg-t-bg-secondary text-t-text-secondary ${cfg.pill ? '' : 'rounded-md'}`}>
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <MiniGrid columns={columns} gap={gap} cardStyle={cardStyle} aspect={aspect} showThumbnail={showThumbnail} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'foot' && (
          <Field label="页脚（footer.json）" desc="页脚结构配置（导航、版权、社交等），JSON 格式。">
            <TextArea value={draft.footer ? JSON.stringify(draft.footer, null, 2) : ''} onChange={(v) => {
              try { onChange({ ...draft, footer: v.trim() ? JSON.parse(v) : null }) } catch { /* ignore */ }
            }} rows={10} />
          </Field>
        )}
      </div>
    </div>
  )
}

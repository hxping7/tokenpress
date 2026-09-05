'use client'

import { type CSSProperties } from 'react'
import { getIn, defaultTemplateConfig } from './schema'
import type { StyleDraft } from './StylePackForm'

// 由草稿配置驱动的高保真站点壳（用于实时设计预览）
export function StylePreviewMock({ draft }: { draft: StyleDraft }) {
  const header = draft.header || {}
  const nav = header.nav || {}
  const layouts = draft.layouts || {}
  const homepage = layouts.homepage || {}
  const sections: any[] = homepage.sections || ['Hero', 'Features', 'ArticleList', 'CTA', 'Banner'].map((c) => ({ component: c }))

  const position: string = nav.position || 'top'
  const align: string = nav.align || 'right'
  const navStyle: string = nav.style || 'underline'
  const height: number = Number(nav.height || 56)
  const width: number = Number(nav.width || 220)
  const colors = nav.colors || {}
  const variant: string = header.variant || 'sticky-solid'

  // 导航颜色 CSS 变量（作用于导航根，供菜单项读取）
  const navVars: CSSProperties = {
    // @ts-ignore
    '--nav-text': colors.text || 'var(--text-secondary)',
    '--nav-hover-bg': colors.hoverBg || 'var(--hover-bg)',
    '--nav-hover-text': colors.hoverText || 'var(--text-primary)',
    '--nav-active-bg': colors.activeBg || 'var(--accent-blue)',
    '--nav-active-text': colors.activeText || '#fff',
    '--nav-bar-bg': colors.barBg || 'transparent',
    '--nav-bar-text': colors.barText || 'var(--text-primary)',
  } as CSSProperties

  const barBg = header.background || (colors.barBg || 'var(--bg-primary)')
  const sampleNav = ['首页', 'AI 编程', '博客', '作品集']

  const navItemBase = 'px-3 py-2 text-sm rounded-lg transition-colors cursor-default'
  const navItemCls = (active: boolean) => {
    if (active) {
      return `${navItemBase} text-[var(--nav-active-text)]`
    }
    return `${navItemBase} text-[var(--nav-text)] hover:text-[var(--nav-hover-text)]`
  }
  // 悬停/激活背景通过内联 style 处理（避免依赖全局 class）
  const navItemStyle = (active: boolean): CSSProperties => {
    if (active) return { background: 'var(--nav-active-bg)' }
    return { ['--hover-bg' as any]: 'var(--nav-hover-bg)' }
  }

  const NavContent = (
    <>
      <div
        className="font-bold text-base"
        style={{ color: 'var(--nav-bar-text)' }}
      >
        {header.logo?.text || 'TokenPress'}
      </div>
      <div className={position === 'left' ? 'flex flex-col gap-1 mt-4' : 'flex items-center gap-1'}>
        {sampleNav.map((it, i) => (
          <div
            key={it}
            className={navItemCls(i === 0) + (navStyle === 'pill' ? ' rounded-full' : navStyle === 'plain' ? ' rounded-none' : '')}
            style={{ ...navItemStyle(i === 0), background: i === 0 ? 'var(--nav-active-bg)' : undefined }}
          >
            {it}
          </div>
        ))}
      </div>
    </>
  )

  const TopBar = (
    <div
      className="flex items-center px-5 border-b"
      style={{
        height,
        background: barBg,
        borderColor: 'var(--border-color)',
        ...navVars,
        justifyContent: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'space-between',
      }}
    >
      {align !== 'center' && (
        <div className="font-bold text-base mr-6" style={{ color: 'var(--nav-bar-text)' }}>
          {header.logo?.text || 'TokenPress'}
        </div>
      )}
      <div className={align === 'center' ? 'flex items-center gap-1' : 'flex items-center gap-1 flex-1' + (align === 'right' ? ' justify-end' : '')}>
        {sampleNav.map((it, i) => (
          <div
            key={it}
            className={navItemCls(i === 0) + (navStyle === 'pill' ? ' rounded-full' : navStyle === 'plain' ? ' rounded-none' : '')}
            style={{ background: i === 0 ? 'var(--nav-active-bg)' : undefined }}
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  )

  const LeftBar = (
    <div
      className="shrink-0 border-r h-full p-4 flex flex-col"
      style={{ width, background: barBg, borderColor: 'var(--border-color)', ...navVars }}
    >
      {NavContent}
      <div className="mt-auto text-xs text-[var(--nav-text)] opacity-70">登录 / 主题</div>
    </div>
  )

  const themeScoped = (draft.theme || '').replace(/:root/g, '.preview-scope')

  return (
    <div className="preview-scope h-full w-full overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ fontFamily: 'inherit' }}>
      {themeScoped && <style dangerouslySetInnerHTML={{ __html: themeScoped }} />}
      <div className={position === 'left' ? 'flex h-full' : 'flex flex-col h-full'}>
        {position === 'left' ? LeftBar : TopBar}
        <div className="flex-1 overflow-auto">
          {sections.map((s: any, i: number) => (
            <SectionBlock key={i} component={s?.component} layouts={layouts} navVars={navVars} />
          ))}
          <MockFooter footer={draft.footer} />
        </div>
      </div>
    </div>
  )
}

function SectionBlock({ component, layouts, navVars }: { component: string; layouts: any; navVars: CSSProperties }) {
  switch (component) {
    case 'Hero':
      return (
        <div className="relative py-20 px-6 text-center border-b border-[var(--border-color)] overflow-hidden">
          <div className="relative max-w-2xl mx-auto">
            <h1 className="text-4xl font-extrabold text-[var(--text-primary)] mb-4">Token 力量无限放大</h1>
            <p className="text-[var(--text-secondary)] text-lg">AI 赋能的综合内容平台 · 聚焦 Token 计划、AI 编程、作品与技术博客</p>
            <div className="mt-6 flex gap-3 justify-center">
              <span className="px-5 py-2 bg-[var(--accent-blue)] text-white text-sm font-medium" style={{ borderRadius: 'var(--btn-radius, 0.5rem)' }}>开始探索</span>
              <span className="px-5 py-2 border border-[var(--border-color)] text-sm" style={{ borderRadius: 'var(--btn-radius, 0.5rem)' }}>了解更多</span>
            </div>
          </div>
        </div>
      )
    case 'Features':
      return (
        <div className="py-12 px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {['AI 编程', '内容发布', '作品展示'].map((f) => (
              <div key={f} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
                <div className="h-3 w-1/2 rounded bg-[var(--border-color)] mb-3" />
                <div className="h-2.5 w-full rounded bg-[var(--border-color)] opacity-70" />
                <div className="h-2.5 w-2/3 rounded bg-[var(--border-color)] opacity-70 mt-2" />
              </div>
            ))}
          </div>
        </div>
      )
    case 'ArticleList':
      return <ArticleGridBlock layouts={layouts} />
    case 'CTA':
      return (
        <div className="py-10 px-6">
          <div className="max-w-4xl mx-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
            <div className="h-4 w-1/3 rounded bg-[var(--border-color)] mx-auto mb-3" />
            <div className="h-2.5 w-2/3 rounded bg-[var(--border-color)] opacity-70 mx-auto" />
          </div>
        </div>
      )
    case 'Banner':
      return (
        <div className="px-6 py-4">
          <div className="rounded-xl border border-[var(--border-color)] bg-gradient-to-r from-[var(--accent-blue)]/20 to-[var(--accent-purple)]/20 p-5 flex items-center justify-between">
            <div className="h-3 w-1/3 rounded bg-[var(--border-color)]" />
            <span className="px-4 py-1.5 rounded-lg bg-[var(--accent-blue)] text-black text-sm">查看</span>
          </div>
        </div>
      )
    default:
      return null
  }
}

function ArticleGridBlock({ layouts }: { layouts: any }) {
  const cfg = { ...defaultTemplateConfig('article-grid'), ...(layouts?.templates?.['article-grid'] || {}) }
  const columns = Number(cfg.columns || 3)
  const gap = Number(cfg.gap ?? 1.5)
  const aspect = String(cfg.aspectRatio || '4/3')
  const cardStyle = String(cfg.cardStyle || 'bordered')
  const showThumbnail = cfg.showThumbnail !== false
  const cardCls =
    cardStyle === 'zoom'
      ? 'overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]'
      : cardStyle === 'shadow'
        ? 'overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-md'
        : cardStyle === 'clean'
          ? 'overflow-hidden rounded-xl bg-[var(--bg-secondary)]'
          : 'overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]'
  const titles = ['深入理解 Token 经济模型', '从零搭建 AI 编程工作流', '设计系统的实践与思考', '边缘计算入门指南', '向量数据库选型对比', '前端性能优化清单']
  return (
    <div className="py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-xl font-bold mb-5">最新文章</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(1, Math.min(columns, 6))}, minmax(0, 1fr))`,
            gap: `${gap}rem`,
          }}
        >
          {titles.slice(0, Math.max(columns, 3) * 2).map((t, i) => (
            <div key={i} className={cardCls}>
              {showThumbnail && (
                <div className="w-full bg-gradient-to-br from-[var(--accent-blue)]/30 to-[var(--accent-purple)]/30" style={{ aspectRatio: aspect }} />
              )}
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">{t}</p>
                <div className="h-2 w-full rounded bg-[var(--border-color)] opacity-60" />
                <div className="h-2 w-2/3 rounded bg-[var(--border-color)] opacity-60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockFooter({ footer }: { footer: any }) {
  const links = footer?.links || ['关于', '友链', '隐私', '联系']
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-bold gradient-text">{footer?.brand || 'Token00'}</div>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
          {links.map((l: any) => (
            <span key={typeof l === 'string' ? l : l.label} className="cursor-default hover:text-[var(--text-primary)]">
              {typeof l === 'string' ? l : l.label}
            </span>
          ))}
        </div>
        <div className="text-xs text-[var(--text-muted)]">{footer?.bottom?.copyright || '© 2026 TokenPress'}</div>
      </div>
    </footer>
  )
}

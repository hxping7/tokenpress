#!/usr/bin/env node
/**
 * TokenPress 建站器 —— 用一枚 API Token 幂等地把一个空站建成可用站点。
 *
 * 覆盖「建站动作」（这些动作 publisher / style / deploy 技能都没有封装）：
 *   ① 板块（sections）  ② 分类（categories）  ③ 站点设置（site_settings）
 *   ④ 页脚导航（footer_nav）  ⑤ 友链（friend_links）  ⑥ 导航图标（风格包 header.nav.icons）
 *
 * 幂等：板块按 slug、分类按 name、友链按 url、设置按 key、页脚导航整体覆盖 —— 重复跑安全。
 *
 * 用法：
 *   node init-site.js --plan site.json                       # 按计划建站
 *   node init-site.js --plan site.json --dry-run             # 只看会改什么
 *   node init-site.js --plan site.json --only sections,categories
 *   node init-site.js --plan site.json --api-base http://localhost:8081/api/v1 --token t00_sk_xxx
 *
 * 配置优先级：CLI > 环境变量（TP_API_BASE / TP_TOKEN）> .token00.conf（从 cwd 逐级向上找）
 *
 * 计划文件（site.json）结构：
 * {
 *   "stylePack": "blog",
 *   "site":        { "site_name": "...", "site_description": "...", "copyright_text": "..." },
 *   "sections":    [{ "name": "造物日志", "slug": "lab", "path": "/lab", "template": "article-grid", "sortOrder": 1, "description": "..." }],
 *   "categories":  [{ "section": "lab", "name": "硬件改装", "slug": "gear", "sortOrder": 1 }],
 *   "footerNav":   [{ "title": "板块", "links": [{ "name": "造物日志", "url": "/lab" }] }],
 *   "friendLinks": [{ "name": "Ollama", "url": "https://ollama.com/", "description": "...", "sortOrder": 1 }],
 *   "hero":        { "useArticles": true, "maxItems": 5, "interval": 5, "effect": "fade", "size": "full",
 *                    "ctaButtons": [{ "label": {"zh":"看日志","en":"Lab"}, "href": "/lab", "variant": "primary" }] },
 *   "navIcons":    { "lab": "flame", "about": "info" }        // 省略该键 = 不动；填 "auto" = 按板块名关键词猜
 * }
 */

const fs = require('fs')
const path = require('path')

// ---------------- 配置解析 ----------------
function findConf(startDir) {
  let dir = startDir
  for (let i = 0; i < 8; i++) {
    const f = path.join(dir, '.token00.conf')
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'))
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return {}
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[k] = true
      else { out[k] = next; i++ }
    } else out._.push(a)
  }
  return out
}

// ---------------- HTTP ----------------
const UA = 'Mozilla/5.0 (compatible; TokenPress-Site/1.0)'

function makeClient(apiBase, token) {
  return async function req(method, p, body) {
    const res = await fetch(apiBase + p, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'User-Agent': UA },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 200) } }
    return { status: res.status, ok: res.ok && json.success !== false, json }
  }
}

// ---------------- 主流程 ----------------
// 顺序即优先级：越具体的放越前（先匹配先命中）。
// 例：「造物日志」要命中 flame 而不是 newspaper，「智能体」要命中 bot 而不是 sparkles。
const ICON_HINTS = [
  [/智能体|机器人|agent|assistant/i, 'bot'],
  [/造物|硬件|动手|机械|手作|DIY/i, 'flame'],
  [/模型|工坊|量化|微调|推理|部署/i, 'sparkles'],
  [/工具|终端|命令|CLI|开发|效率/i, 'command'],
  [/随想|随笔|观察|思考|杂记|碎笔/i, 'penTool'],
  [/关于|介绍|联系/i, 'info'],
  [/产品|服务/, 'rocket'],
  [/方案|解决|案例/, 'compass'],
  [/数据|指标|分析/, 'gauge'],
  [/开源|github|git|代码/i, 'github'],
  [/作品|设计|画廊/, 'image'],
  [/日志|博客|笔记|手记|动态|资讯|文章/, 'newspaper'],
]
const pickIcon = (name) => (ICON_HINTS.find(([re]) => re.test(name)) || [null, 'folder'])[1]

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const conf = findConf(process.cwd())
  const apiBase = (args['api-base'] || process.env.TP_API_BASE || conf.api_base || '').replace(/\/$/, '')
  const token = args.token || process.env.TP_TOKEN || conf.token || ''
  if (!apiBase || !token) {
    console.error('缺少 api_base / token：请用 --api-base/--token，或设置 TP_API_BASE/TP_TOKEN，或提供 .token00.conf')
    process.exit(2)
  }
  if (!args.plan || args.plan === true) {
    console.error('缺少 --plan <site.json>')
    process.exit(2)
  }
  const plan = JSON.parse(fs.readFileSync(args.plan, 'utf8'))
  const only = args.only && args.only !== true ? String(args.only).split(',').map((s) => s.trim()) : null
  const want = (k) => !only || only.includes(k)
  const dry = args['dry-run'] === true

  const req = makeClient(apiBase, token)
  const log = (tag, msg) => console.log('  ' + tag.padEnd(9) + msg)
  const summary = { create: 0, skip: 0, fail: 0, write: 0 }

  console.log(`TokenPress 建站器${dry ? '（dry-run，不写任何数据）' : ''}`)
  console.log(`  API: ${apiBase}`)
  console.log('')

  // --- ① 板块 ---
  const sectionIds = {}
  if (want('sections') && Array.isArray(plan.sections)) {
    const cur = await req('GET', '/sections')
    const bySlug = new Map((cur.json.data || []).map((s) => [s.slug, s]))
    for (const s of plan.sections) {
      const hit = bySlug.get(s.slug)
      if (hit) { sectionIds[s.slug] = hit.id; summary.skip++; log('[板块]', `已存在 ${s.name} (${s.path})`); continue }
      if (dry) { summary.create++; log('[板块]', `将创建 ${s.name} → ${s.path} [${s.template || 'article-list'}]`); continue }
      const r = await req('POST', '/sections', s)
      if (r.ok) { sectionIds[s.slug] = r.json.data.id; summary.create++; log('[板块]', `创建 ${s.name} → ${s.path} id=${r.json.data.id}`) }
      else { summary.fail++; log('[板块]', `失败 ${s.slug} ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`) }
    }
    // dry-run 下也需要 id 才能继续，回填已有
    for (const s of plan.sections) if (!sectionIds[s.slug] && bySlug.get(s.slug)) sectionIds[s.slug] = bySlug.get(s.slug).id
  }

  // --- ② 分类 ---
  if (want('categories') && Array.isArray(plan.categories)) {
    const cur = await req('GET', '/categories')
    const have = new Set((cur.json.data || []).map((c) => c.name))
    for (const c of plan.categories) {
      if (have.has(c.name)) { summary.skip++; log('[分类]', `已存在 ${c.name}`); continue }
      if (dry) { summary.create++; log('[分类]', `将创建 ${c.name}（${c.section}）`); continue }
      const r = await req('POST', '/categories', { ...c, sectionId: sectionIds[c.section] })
      if (r.ok) { summary.create++; log('[分类]', `创建 ${c.name}（${c.section}）`) }
      else { summary.fail++; log('[分类]', `失败 ${c.name} ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`) }
    }
  }

  // --- ③ 站点设置 ---
  if (want('settings')) {
    const settings = { ...(plan.site || {}) }
    if (plan.hero) {
      const h = plan.hero
      if (h.ctaButtons) settings.hero_cta_buttons = JSON.stringify(h.ctaButtons)
      if (h.useArticles !== undefined) settings.hero_carousel_use_articles = String(h.useArticles)
      if (h.maxItems !== undefined) settings.hero_carousel_max_items = String(h.maxItems)
      if (h.interval !== undefined) settings.hero_carousel_interval = String(h.interval)
      if (h.effect) settings.hero_effect = h.effect
      if (h.size) settings.hero_size = h.size
      if (h.articleSource) settings.hero_carousel_article_source = h.articleSource
    }
    if (plan.footerNav && want('footerNav')) settings.footer_nav = JSON.stringify(plan.footerNav)
    const keys = Object.keys(settings)
    if (!keys.length) log('[设置]', '计划里没有设置项，跳过')
    else if (dry) { summary.write++; log('[设置]', `将写入 ${keys.length} 项：${keys.join(', ')}`) }
    else {
      const r = await req('PUT', '/site-settings', { settings })
      if (r.ok) { summary.write++; log('[设置]', `写入 ${keys.length} 项：${keys.join(', ')}`) }
      else { summary.fail++; log('[设置]', `失败 ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`) }
    }
  }

  // --- ④ 友链 ---
  if (want('friendLinks') && Array.isArray(plan.friendLinks)) {
    const cur = await req('GET', '/friend-links')
    const have = new Set((cur.json.data || []).map((l) => l.url))
    for (const l of plan.friendLinks) {
      if (have.has(l.url)) { summary.skip++; log('[友链]', `已存在 ${l.name}`); continue }
      if (dry) { summary.create++; log('[友链]', `将创建 ${l.name} → ${l.url}`); continue }
      const r = await req('POST', '/friend-links', { isActive: true, ...l })
      if (r.ok) { summary.create++; log('[友链]', `创建 ${l.name}`) }
      else { summary.fail++; log('[友链]', `失败 ${l.name} ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`) }
    }
  }

  // --- ⑤ 导航图标（风格包 header.nav.icons，必须覆盖全部板块 slug）---
  if (want('navIcons') && plan.navIcons !== undefined) {
    const pack = plan.stylePack || (await req('GET', '/styles/active')).json?.data?.activeStyle
    const secs = (await req('GET', '/sections')).json.data || []
    let icons = plan.navIcons
    if (icons === 'auto') {
      icons = {}
      for (const s of secs) icons[s.slug] = pickIcon(s.name)
    } else {
      // 显式映射也要补齐遗漏的板块，否则 nav.icons 一配就停用关键词兜底 → 未覆盖的板块没有图标
      const missing = secs.filter((s) => !icons[s.slug])
      for (const s of missing) icons[s.slug] = pickIcon(s.name)
      if (missing.length) log('[图标]', `自动补齐未覆盖的板块：${missing.map((s) => s.slug).join(', ')}`)
    }
    if (!pack) { summary.fail++; log('[图标]', '拿不到激活的风格包 id，跳过') }
    else if (dry) { summary.write++; log('[图标]', `将把 ${pack}.header.nav.icons 写为 ${JSON.stringify(icons)}`) }
    else {
      const r = await req('PATCH', `/styles/${pack}`, { patch: [{ path: 'header.nav.icons', value: icons }] })
      if (r.ok) { summary.write++; log('[图标]', `${pack}.header.nav.icons ← ${JSON.stringify(icons)}`) }
      else { summary.fail++; log('[图标]', `失败 ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`) }
    }
  }

  console.log('')
  console.log(`  完成：新建/写入 ${summary.create + summary.write} 项，跳过 ${summary.skip} 项，失败 ${summary.fail} 项`)
  console.log('  下一步：① 用 publisher 技能发布内容（板块必须先存在，本脚本已保证）')
  console.log('          ② 跑 audit-site.js 自检（板块页可达 / nav.icons 覆盖 / 媒体引用 / 链接）')
  process.exit(summary.fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('  [错误]', e.message); process.exit(1) })

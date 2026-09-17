#!/usr/bin/env node
/**
 * TokenPress 建站自检 —— 建完站（或发完内容）后跑一遍，逐项给 ✅/❌。
 *
 * 检查项：
 *   ① 内容计数（板块 / 分类 / 文章）
 *   ② 每个板块页可达（HTTP 200）
 *   ③ 文章详情页可达（按列表 API 拼 URL）
 *   ④ 风格包 header.nav.icons **覆盖全部板块 slug**（未覆盖的板块会没有导航图标）
 *   ⑤ 站点设置体检（footer_nav 字段形状 / 轮播开关 / 页脚列数一致性）
 *   ⑥ 媒体引用完整性（正文与封面里的 /api/v1/media/... 逐个请求）
 *   ⑦ 内部链接爬取（首页 + 板块页 + 文章页，逐个请求，报告 4xx）
 *
 * 用法：
 *   node audit-site.js
 *   node audit-site.js --site http://localhost:8081
 *   node audit-site.js --api-base http://localhost:8081/api/v1 --token t00_sk_xxx
 *   node audit-site.js --max-media-checks 300
 *
 * 退出码：0 = 全部通过；1 = 有 ❌
 */

const fs = require('fs')
const path = require('path')

const UA = 'Mozilla/5.0 (compatible; TokenPress-Site/1.0)'

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

async function pool(items, limit, fn) {
  const out = []
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}

async function head(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    return res.status
  } catch (e) {
    return 0
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const conf = findConf(process.cwd())
  const apiBase = (args['api-base'] || process.env.TP_API_BASE || conf.api_base || '').replace(/\/$/, '')
  const token = args.token || process.env.TP_TOKEN || conf.token || ''
  const site = (args.site || apiBase.replace(/\/api\/v\d+$/, '') || '').replace(/\/$/, '')
  const maxMedia = Number(args['max-media-checks'] || 300)

  if (!apiBase || !token) { console.error('缺少 api_base / token'); process.exit(2) }
  if (!site) { console.error('缺少站点地址（--site，或由 api_base 推导）'); process.exit(2) }

  const api = async (p) => {
    const res = await fetch(apiBase + p, { headers: { Authorization: 'Bearer ' + token, 'User-Agent': UA } })
    const t = await res.text()
    try { return JSON.parse(t) } catch { return { raw: t.slice(0, 160) } }
  }

  const fails = []
  const ok = (label, detail = '') => console.log('  ✅ ' + label.padEnd(34) + detail)
  const bad = (label, detail = '') => { fails.push(label); console.log('  ❌ ' + label.padEnd(34) + detail) }
  const warn = (label, detail = '') => console.log('  ⚠️  ' + label.padEnd(34) + detail)

  console.log(`TokenPress 建站自检`)
  console.log(`  API : ${apiBase}`)
  console.log(`  站点: ${site}`)
  console.log('')

  // ① 计数 + 拿到板块/分类
  const sections = (await api('/sections')).data || []
  const categories = (await api('/categories')).data || []
  const list = await api('/ai/articles?limit=50&page=1')
  const articles = list.data || []
  const total = list.pagination?.total ?? articles.length
  if (!sections.length) bad('板块数量', '0 —— 站点还是空的，先跑 init-site.js')
  else ok('板块数量', String(sections.length))
  ok('分类数量', String(categories.length))
  if (!articles.length) warn('文章数量', '0 —— 尚未发布内容')
  else ok('文章数量', String(total))

  // ② 板块页可达
  if (sections.length) {
    const codes = await pool(sections, 5, (s) => head(site + s.path))
    const badSec = sections.filter((s, i) => codes[i] >= 400 || codes[i] === 0)
    if (badSec.length) bad('板块页可达', badSec.map((s) => `${s.path}=${codes[sections.indexOf(s)]}`).join(', '))
    else ok('板块页可达', `${sections.length}/${sections.length} 均 200`)
  }

  // ③ 文章详情页可达
  if (articles.length) {
    const secPath = new Map(sections.map((s) => [s.id, s.path]))
    const urls = articles
      .map((a) => {
        const p = a.section?.path || secPath.get(a.sectionId) || secPath.get(a.section_id)
        return p ? { slug: a.slug, url: site + p + '/' + a.slug } : null
      })
      .filter(Boolean)
    const codes = await pool(urls, 5, (u) => head(u.url))
    const badArt = urls.filter((u, i) => codes[i] >= 400 || codes[i] === 0)
    if (badArt.length) bad('文章详情页可达', `${badArt.length} 篇异常：` + badArt.slice(0, 4).map((u) => u.slug).join(', '))
    else ok('文章详情页可达', `${urls.length}/${urls.length} 均 200`)
  }

  // ④ nav.icons 覆盖全部板块 slug
  const active = await api('/styles/active')
  const activeStyle = active.data?.activeStyle || active.data?.id
  const icons = active.data?.header?.nav?.icons
  if (!icons || !Object.keys(icons).length) {
    warn('导航图标', '包内未配置 header.nav.icons（走关键词兜底，可接受）')
  } else {
    const missing = sections.filter((s) => !icons[s.slug])
    if (missing.length) bad('导航图标覆盖', `未覆盖：${missing.map((s) => s.slug).join(', ')} —— 配了 icons 就停用兜底，这些板块会没图标`)
    else ok('导航图标覆盖', `${activeStyle}: ${Object.keys(icons).length} 个映射，覆盖全部板块`)
  }

  // ⑤ 站点设置体检
  const st = (await api('/site-settings')).data || {}
  if (!st.site_name) warn('站点设置', '未设置 site_name（头部/标题会用兜底值）')
  else ok('站点设置', `site_name=${st.site_name}`)

  if (st.footer_nav) {
    let nav = []
    try { nav = JSON.parse(st.footer_nav) } catch { nav = [] }
    const badShape = []
    nav.forEach((g, gi) => {
      if (g.html !== undefined) return
      ;(g.links || []).forEach((l, li) => {
        if (!l.name || !l.url) badShape.push(`列${gi + 1} 第${li + 1} 项用了 ${Object.keys(l).join('/')}`)
      })
    })
    if (badShape.length) bad('页脚导航字段形状', `契约是 {name,url}，发现：${badShape.slice(0, 3).join('; ')}（会静默不渲染）`)
    else {
      const cols = Number(st.footer_nav_columns || 0)
      const n = nav.length
      if (cols && cols !== n) warn('页脚列数', `footer_nav_columns=${cols} 但有 ${n} 个分组（列数以设置为准，多出的会换行）`)
      else ok('页脚导航', `${n} 组 / ${nav.reduce((a, g) => a + (g.links || []).length, 0)} 条链接，字段形状正确`)
    }
  } else warn('页脚导航', '未配置 footer_nav')

  // ⑥ 媒体引用完整性
  // 注意：/ai/articles **列表**不返回 content / coverImage（只有 id/title/slug/sectionId/section…），
  // 必须逐个取详情 `GET /articles/:slug` 才能拿到正文与封面。
  const maxArticles = Number(args['max-articles'] || 60)
  const detailTargets = articles.slice(0, maxArticles)
  const details = await pool(detailTargets, 5, async (a) => {
    try {
      const r = await fetch(apiBase + '/articles/' + a.slug, { headers: { 'User-Agent': UA } })
      const j = await r.json()
      return j.data || null
    } catch { return null }
  })
  const detailOk = details.filter(Boolean).length
  if (detailOk < detailTargets.length) {
    bad('文章详情可读取', (detailTargets.length - detailOk) + ' 篇取不到详情（媒体检查结果不完整）')
  }

  const medias = new Set()
  let localRel = 0
  for (const a of details.filter(Boolean)) {
    for (const m of String(a.content || '').matchAll(/\/api\/v1\/media\/files\/uploads\/[^)\s"']+/g)) medias.add(m[0])
    if (a.coverImage) medias.add(a.coverImage)
    if (/\]\(\.\//.test(String(a.content || ''))) localRel++
  }
  if (localRel) bad('正文残留本地相对路径', localRel + ' 篇含 ./ 引用（说明媒体没上传）')

  const mediaList = [...medias].slice(0, maxMedia)
  if (!mediaList.length) warn('媒体引用', detailOk ? '没有可检查的媒体引用' : '未能读取文章详情的正文/封面')
  else {
    const codes = await pool(mediaList, 6, (u) => head(site + u))
    const miss = mediaList.filter((u, i) => codes[i] >= 400 || codes[i] === 0)
    if (miss.length) bad('媒体引用完整性', `${miss.length}/${mediaList.length} 取不到：` + miss.slice(0, 3).join(', '))
    else ok('媒体引用完整性', `${mediaList.length}/${mediaList.length} 可访问${medias.size > maxMedia ? `（已截断到 ${maxMedia}）` : ''}`)
  }

  // ⑦ 内部链接爬取
  const seed = [site + '/', ...sections.slice(0, 4).map((s) => site + s.path)]
  if (articles[0]) {
    const p = articles[0].section?.path || sections.find((s) => s.id === articles[0].sectionId)?.path
    if (p) seed.push(site + p + '/' + articles[0].slug)
  }
  const ASSET = /\.(ico|png|jpe?g|svg|webp|gif|css|js|json|xml|txt|webmanifest)$/i
  const links = new Set()
  for (const u of seed) {
    try {
      const html = await (await fetch(u, { headers: { 'User-Agent': UA } })).text()
      // 只认 <a href>：<link rel="icon"> 之类的静态资源不是「内部链接」
      for (const m of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)"/gi)) {
        const h = m[1]
        if (h.startsWith('/api') || h.startsWith('/admin') || h.startsWith('/_next') || ASSET.test(h)) continue
        links.add(h)
      }
    } catch {}
  }
  const linkList = [...links]
  if (!linkList.length) warn('内部链接', '未采集到链接')
  else {
    const codes = await pool(linkList, 6, (l) => head(site + l))
    const dead = linkList.filter((l, i) => codes[i] >= 400 || codes[i] === 0)
    if (dead.length) bad('内部链接', `${dead.length}/${linkList.length} 失效：` + dead.slice(0, 5).join(', '))
    else ok('内部链接', `${linkList.length} 个全部可达`)
  }

  console.log('')
  if (fails.length) {
    console.log(`  结果：${fails.length} 项未通过 —— ${fails.join(' / ')}`)
    process.exit(1)
  }
  console.log('  结果：全部通过 ✅')
}

main().catch((e) => { console.error('  [错误]', e.message); process.exit(1) })

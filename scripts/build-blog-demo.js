#!/usr/bin/env node
/**
 * 博客风格包（blog）演示内容构建器 —— 在 backend 容器内运行。
 *
 * 用途：把当前站点内容整体替换为「博客主题」的演示内容集合
 * （板块 / 分类 / 文章 / 标签 / 友链 / 站点设置 + 全套 SVG 封面与插图），
 * 替换完再用 scripts/export-style-demo.js 导出为 blog 包的 demo.json + demo-media/，
 * 供首次安装向导 /setup 勾选安装。
 *
 * 这是「给某个风格包做一套主题化演示内容」这套流程的**参考实现**：
 *  1) 清空内容（FK 顺序：article_tags/likes/views/reviews → articles → categories → sections → tags/friend_links/media）
 *  2) 生成 SVG 媒体（封面 1200×630 / 内文插图 1000×520），写入 uploads/202609/blog/ 并登记 media 表
 *  3) 写入 IA 与文章（正文里用 `![图注]({{F1}})` 占位，脚本替换为真实媒体 URL 并按图注渲染插图标题）
 *  4) 更新站点设置（站名/简介/版权/页脚导航/轮播/CTA/中部横幅）
 * 改换目标包时，改本文件顶部四块：BRAND / SECTIONS / CATEGORIES+FRIEND_LINKS / PALETTE，
 * 以及第 4 步的 setSetting 区块；文章正文来自 TP_CONTENT_FILES 指定的 JSON。
 *
 * 用法：
 *   docker cp scripts/build-blog-demo.js <backend>:/tmp/
 *   docker cp scripts/demo-content/blog-1.json <backend>:/tmp/_blog_c1.json
 *   docker cp scripts/demo-content/blog-2.json <backend>:/tmp/_blog_c2.json
 *   docker cp _qr_blog <backend>:/tmp/_qr_blog          # 页脚二维码（宿主 python qrcode 生成）
 *   docker exec <backend> node /tmp/build-blog-demo.js
 *   docker cp <backend>:/tmp/blog-hero/hero-cover.svg apps/web/public/styles/blog/media/
 *
 * 环境变量：TP_DB（默认 /app/apps/server/data/token00.db）、TP_UPLOADS（默认 …/data/uploads）
 *
 * 注意：
 *  - 运行前务必备份 DB（docker cp <backend>:/app/apps/server/data/token00.db data/token00-before-*.db）
 *  - 改完包内容后必须**重建后端镜像**，否则新部署环境检测不到该包的演示内容
 */

const fs = require('fs')
const path = require('path')

function loadBetterSqlite() {
  const base = '/app/node_modules/.pnpm'
  const dir = fs.readdirSync(base).find((d) => d.startsWith('better-sqlite3@'))
  if (!dir) throw new Error('未找到 better-sqlite3')
  return require(path.join(base, dir, 'node_modules/better-sqlite3'))
}
const Database = loadBetterSqlite()

const DB_PATH = process.env.TP_DB || '/app/apps/server/data/token00.db'
const UPLOADS = process.env.TP_UPLOADS || '/app/apps/server/data/uploads'
const REL_DIR = '202609/blog'
const URL_PREFIX = '/api/v1/media/files/uploads/'
const MEDIA_URL = URL_PREFIX + REL_DIR + '/'
const AUTHOR_ID = 1
const OUT_MEDIA = path.join(UPLOADS, REL_DIR)
const HERO_OUT = '/tmp/blog-hero'
const LEGACY_UPLOAD_DIRS = ['202609/enterprise']

const db = new Database(DB_PATH)

// ---------------------------------------------------------------- 站点语汇
const BRAND = {
  name: '极客手记',
  en: 'GEEKNOTES',
  description: '写编程、Token、AI 与机器人的技术博客：只写验证过的做法，以及它们的代价。',
  copyright: '© 2026 极客手记 · 编程 · Token · AI · 机器人',
}

const SECTIONS = [
  { slug: 'code', name: '编程实战', path: '/code', latin: 'CODE', template: 'article-grid', description: '前端、后端、CI 与工具链：把踩过的坑写成可复用的做法。', sortOrder: 1 },
  { slug: 'ai', name: 'AI 工程', path: '/ai', latin: 'AI ENGINEERING', template: 'article-list', description: 'RAG、Agent、Prompt 与评测：让模型能力真正落到产品里。', sortOrder: 2 },
  { slug: 'token', name: 'Token 观察', path: '/token', latin: 'TOKEN WATCH', template: 'article-list', description: '价格、供给与成本：把每一分 token 花在哪里算清楚。', sortOrder: 3 },
  { slug: 'robotics', name: '机器人', path: '/robotics', latin: 'ROBOTICS', template: 'article-list', description: '灵巧手、Sim2Real、ROS 2 与边缘推理的工程记录。', sortOrder: 4 },
  { slug: 'github', name: '开源现场', path: '/github', latin: 'OPEN SOURCE', template: 'article-grid', description: 'Actions、开源维护与值得关注的基建项目。', sortOrder: 5 },
  { slug: 'about', name: '关于', path: '/about', latin: 'ABOUT', template: 'single-page', description: '这个站点写什么、怎么写，以及背后的技术栈。', sortOrder: 6 },
]

const CATEGORIES = [
  { slug: 'frontend', name: '前端', section: 'code', sortOrder: 1 },
  { slug: 'backend', name: '后端', section: 'code', sortOrder: 2 },
  { slug: 'devops', name: '工程效能', section: 'code', sortOrder: 3 },
  { slug: 'tooling', name: '工具链', section: 'code', sortOrder: 4 },
  { slug: 'rag', name: 'RAG', section: 'ai', sortOrder: 1 },
  { slug: 'agent', name: 'Agent', section: 'ai', sortOrder: 2 },
  { slug: 'prompt', name: 'Prompt', section: 'ai', sortOrder: 3 },
  { slug: 'eval', name: '评测', section: 'ai', sortOrder: 4 },
  { slug: 'llm', name: '推理', section: 'ai', sortOrder: 5 },
  { slug: 'pricing', name: '价格', section: 'token', sortOrder: 1 },
  { slug: 'industry', name: '行业观察', section: 'token', sortOrder: 2 },
  { slug: 'api', name: 'API 设计', section: 'token', sortOrder: 3 },
  { slug: 'humanoid', name: '人形机器人', section: 'robotics', sortOrder: 1 },
  { slug: 'ros', name: 'ROS 2', section: 'robotics', sortOrder: 2 },
  { slug: 'edge', name: '边缘推理', section: 'robotics', sortOrder: 3 },
  { slug: 'workflow', name: '工作流', section: 'github', sortOrder: 1 },
  { slug: 'trends', name: '开源观察', section: 'github', sortOrder: 2 },
  { slug: 'projects', name: '项目推荐', section: 'github', sortOrder: 3 },
]

const FRIEND_LINKS = [
  { name: 'GitHub', url: 'https://github.com/', description: '代码托管与开源协作', sortOrder: 1 },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', description: 'Web 平台权威文档', sortOrder: 2 },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/', description: '技术圈每日讨论', sortOrder: 3 },
  { name: '阮一峰的网络日志', url: 'https://www.ruanyifeng.com/', description: '中文技术写作长期主义者', sortOrder: 4 },
  { name: 'Kubernetes', url: 'https://kubernetes.io/', description: '容器编排与云原生', sortOrder: 5 },
  { name: 'ROS', url: 'https://www.ros.org/', description: '机器人操作系统', sortOrder: 6 },
]

const PALETTE = {
  code: { from: '#0ea5e9', to: '#6366f1', soft: '#e8f4ff', motif: 'code' },
  ai: { from: '#6366f1', to: '#a855f7', soft: '#eef0ff', motif: 'ai' },
  token: { from: '#0891b2', to: '#0ea5e9', soft: '#e3f6fa', motif: 'token' },
  robotics: { from: '#7c3aed', to: '#ec4899', soft: '#f5ebff', motif: 'robot' },
  github: { from: '#1e293b', to: '#475569', soft: '#e9edf3', motif: 'git' },
  about: { from: '#0ea5e9', to: '#14b8a6', soft: '#e6faf6', motif: 'stack' },
}

const FONT = "Inter, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif"

// ---------------------------------------------------------------- SVG 工具
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function units(s) {
  let u = 0
  for (const ch of String(s)) u += /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.55
  return u
}

function wrap(text, maxUnits, maxLines) {
  const chars = Array.from(String(text || ''))
  const lines = []
  let cur = ''
  for (const ch of chars) {
    if (units(cur + ch) > maxUnits && cur) {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines) break
    } else {
      cur += ch
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (lines.length === maxLines) {
    // 判断是否还有未容纳的内容 → 末行加省略号
    const joined = lines.join('')
    if (units(joined) < units(text) - 0.6) lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '') + '…'
  }
  return lines
}

function motif(kind, x, y, size, from, to, soft) {
  const s = size
  const g = `url(#acc)`
  switch (kind) {
    case 'code':
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${from}" stroke-opacity="0.25"/>
  <text x="${x + s / 2}" y="${y + s / 2 + 16}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="46" font-weight="700" fill="${from}">&lt;/&gt;</text>
  <rect x="${x + 18}" y="${y + s - 46}" width="${s - 36}" height="8" rx="4" fill="${to}" fill-opacity="0.45"/>
  <rect x="${x + 18}" y="${y + s - 30}" width="${(s - 36) * 0.55}" height="8" rx="4" fill="${from}" fill-opacity="0.5"/>`
    case 'ai': {
      const n = [[0.22, 0.24], [0.78, 0.2], [0.5, 0.5], [0.2, 0.78], [0.8, 0.78]]
      const pts = n.map(([a, b]) => [x + s * a, y + s * b])
      const links = [[0, 2], [1, 2], [3, 2], [4, 2], [0, 1], [3, 4]]
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${to}" stroke-opacity="0.22"/>
  ${links.map(([a, b]) => `<line x1="${pts[a][0].toFixed(1)}" y1="${pts[a][1].toFixed(1)}" x2="${pts[b][0].toFixed(1)}" y2="${pts[b][1].toFixed(1)}" stroke="${g}" stroke-width="2.5" stroke-opacity="0.55"/>`).join('')}
  ${pts.map(([cx, cy], i) => `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${i === 2 ? 13 : 9}" fill="${i === 2 ? to : from}"/>`).join('')}`
    }
    case 'token':
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${from}" stroke-opacity="0.22"/>
  <polygon points="${x + s * 0.3},${y + s * 0.22} ${x + s * 0.7},${y + s * 0.22} ${x + s * 0.82},${y + s * 0.5} ${x + s * 0.7},${y + s * 0.78} ${x + s * 0.3},${y + s * 0.78} ${x + s * 0.18},${y + s * 0.5}" fill="${g}" fill-opacity="0.85"/>
  <text x="${x + s * 0.5}" y="${y + s * 0.58}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="34" font-weight="700" fill="#ffffff">T</text>`
    case 'robot':
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${from}" stroke-opacity="0.22"/>
  <circle cx="${x + s * 0.5}" cy="${y + s * 0.38}" r="${s * 0.2}" fill="${g}" fill-opacity="0.85"/>
  <circle cx="${x + s * 0.42}" cy="${y + s * 0.35}" r="5" fill="#fff"/>
  <circle cx="${x + s * 0.58}" cy="${y + s * 0.35}" r="5" fill="#fff"/>
  <line x1="${x + s * 0.5}" y1="${y + s * 0.18}" x2="${x + s * 0.5}" y2="${y + s * 0.06}" stroke="${to}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="${x + s * 0.5}" cy="${y + s * 0.04}" r="6" fill="${to}"/>
  <path d="M${x + s * 0.26} ${y + s * 0.72} q${s * 0.24} ${-s * 0.1} ${s * 0.48} 0" fill="none" stroke="${from}" stroke-width="6" stroke-linecap="round"/>`
    case 'git': {
      const bx = x + s * 0.26, by = y + s * 0.24
      const mx = x + s * 0.72, my = y + s * 0.5
      const lx = x + s * 0.4, ly = y + s * 0.78
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${to}" stroke-opacity="0.22"/>
  <path d="M${bx} ${by} C ${bx} ${my}, ${mx} ${by}, ${mx} ${my}" fill="none" stroke="${g}" stroke-width="4" stroke-linecap="round"/>
  <path d="M${bx} ${by} L ${lx} ${ly}" fill="none" stroke="${from}" stroke-width="4" stroke-linecap="round" stroke-opacity="0.7"/>
  <circle cx="${bx}" cy="${by}" r="11" fill="${from}"/>
  <circle cx="${mx}" cy="${my}" r="11" fill="${to}"/>
  <circle cx="${lx}" cy="${ly}" r="9" fill="${from}" fill-opacity="0.65"/>`
    }
    default:
      return `
  <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="20" fill="${soft}" stroke="${from}" stroke-opacity="0.22"/>
  ${[0, 1, 2].map((i) => `<rect x="${x + s * 0.2}" y="${y + s * (0.24 + i * 0.19)}" width="${s * (0.6 - i * 0.12)}" height="${s * 0.12}" rx="6" fill="${i === 0 ? g : from}" fill-opacity="${i === 0 ? 0.9 : 0.45}"/>`).join('')}`
  }
}

function chip(x, y, text, accent) {
  const w = units(text) * 17 + 30
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="38" rx="19" fill="#f1f5f9" stroke="#e2e8f0"/>
  <text x="${x + w / 2}" y="${y + 25}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="${accent}">${esc(text)}</text>`,
  }
}

function coverSvg(article, section, category) {
  const p = PALETTE[section.slug] || PALETTE.code
  const titleLines = wrap(article.title, 15, 3)
  const introLines = wrap(article.excerpt || '', 40, 2)
  const tags = (article.tags || []).slice(0, 3)
  let cx = 84
  const chips = []
  for (const t of tags) {
    const c = chip(cx, 552, t, '#475569')
    if (cx + c.w > 1116) break
    chips.push(c.svg)
    cx += c.w + 12
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(article.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${p.soft}"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#0f172a" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <circle cx="1150" cy="600" r="180" fill="${p.from}" fill-opacity="0.05"/>
  <circle cx="90" cy="40" r="130" fill="${p.to}" fill-opacity="0.05"/>
  ${motif(p.motif, 880, 56, 200, p.from, p.to, p.soft)}
  <rect x="84" y="104" width="56" height="5" rx="2.5" fill="url(#acc)"/>
  <text x="84" y="146" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="20" letter-spacing="4" fill="${p.from}" font-weight="600">${esc(section.latin)}${category ? ' / ' + esc(category.name.toUpperCase()) : ''}</text>
  ${titleLines.map((l, i) => `<text x="84" y="${232 + i * 78}" font-family="${FONT}" font-size="62" font-weight="700" fill="#0f172a">${esc(l)}</text>`).join('')}
  <rect x="84" y="${232 + Math.max(titleLines.length - 1, 0) * 78 + 46}" width="120" height="4" rx="2" fill="url(#acc)"/>
  ${introLines.map((l, i) => `<text x="84" y="${232 + Math.max(titleLines.length - 1, 0) * 78 + 100 + i * 34}" font-family="${FONT}" font-size="23" fill="#64748b">${esc(l)}</text>`).join('')}
  ${chips.join('\n  ')}
  <text x="1116" y="576" text-anchor="end" font-family="${FONT}" font-size="19" font-weight="600" fill="${p.from}" fill-opacity="0.85">${esc(BRAND.name)}</text>
  <rect x="0" y="622" width="1200" height="8" fill="url(#acc)"/>
</svg>
`
}

// 内文插图：抽象示意图（5 种），标题取自 markdown 的图注
function figureSvg(caption, section, index) {
  const p = PALETTE[section.slug] || PALETTE.code
  const kind = index % 5
  const cap = wrap(caption || '', 34, 1)[0] || ''
  let art = ''
  const X = 90, Y = 130, W = 820, H = 300

  if (kind === 0) {
    const bars = ['基线', '优化一', '优化二', '最终']
    const vals = [0.42, 0.62, 0.8, 1]
    art = bars.map((b, i) => {
      const h = H * vals[i]
      const w = 118
      const x = X + 60 + i * 190
      return `<rect x="${x}" y="${Y + H - h}" width="${w}" height="${h}" rx="10" fill="${i === 3 ? 'url(#acc)' : p.from}" fill-opacity="${i === 3 ? 1 : 0.3 + i * 0.16}"/>
  <text x="${x + w / 2}" y="${Y + H + 32}" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#64748b">${esc(b)}</text>`
    }).join('\n  ')
    art += `\n  <line x1="${X + 30}" y1="${Y + H}" x2="${X + W - 20}" y2="${Y + H}" stroke="#cbd5e1" stroke-width="2"/>`
  } else if (kind === 1) {
    const nodes = ['输入', '处理', '输出']
    art = nodes.map((n, i) => {
      const w = 200, x = X + 40 + i * 300
      const y = Y + H / 2 - 44
      const arrow = i < 2
        ? `<path d="M${x + w + 14} ${Y + H / 2} h60" stroke="${p.to}" stroke-width="3" marker-end="url(#ar)"/>`
        : ''
      return `<rect x="${x}" y="${y}" width="${w}" height="88" rx="16" fill="${i === 1 ? 'url(#acc)' : p.soft}" stroke="${p.from}" stroke-opacity="0.35"/>
  <text x="${x + w / 2}" y="${y + 54}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="600" fill="${i === 1 ? '#ffffff' : '#0f172a'}">${esc(n)}</text>
  ${arrow}`
    }).join('\n  ')
  } else if (kind === 2) {
    const layers = ['接入层', '逻辑层', '数据层', '存储层']
    art = layers.map((n, i) => {
      const w = W - i * 90
      const x = X + (W - w) / 2 + 30
      const y = Y + 20 + i * 70
      return `<rect x="${x}" y="${y}" width="${w}" height="54" rx="12" fill="${i === 1 ? 'url(#acc)' : p.soft}" stroke="${p.from}" stroke-opacity="0.3"/>
  <text x="${x + 22}" y="${y + 35}" font-family="${FONT}" font-size="21" font-weight="600" fill="${i === 1 ? '#ffffff' : '#334155'}">${esc(n)}</text>`
    }).join('\n  ')
  } else if (kind === 3) {
    art = `<path d="M${X + 40} ${Y + H - 30} C ${X + 220} ${Y + H - 40}, ${X + 300} ${Y + 60}, ${X + W - 60} ${Y + 40}" fill="none" stroke="url(#acc)" stroke-width="5" stroke-linecap="round"/>
  <circle cx="${X + 40}" cy="${Y + H - 30}" r="9" fill="${p.from}"/>
  <text x="${X + 40}" y="${Y + H + 6}" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#64748b">起点</text>
  <circle cx="${X + W - 60}" cy="${Y + 40}" r="9" fill="${p.to}"/>
  <text x="${X + W - 60}" y="${Y + 20}" text-anchor="middle" font-family="${FONT}" font-size="18" fill="#64748b">优化后</text>
  <line x1="${X + 40}" y1="${Y + H - 30}" x2="${X + 40}" y2="${Y + 70}" stroke="#cbd5e1" stroke-dasharray="6 6"/>
  <line x1="${X + 40}" y1="${Y + H - 30}" x2="${X + W - 40}" y2="${Y + H - 30}" stroke="#cbd5e1"/>`
  } else {
    const nodes = [['工具 A', 0.16, 0.24], ['工具 B', 0.16, 0.76], ['网关', 0.52, 0.5], ['模型', 0.86, 0.5]]
    art = nodes.map(([n, fx, fy]) => {
      const w = 132, h = 68
      const x = X + 40 + fx * (W - 200), y = Y + 30 + fy * (H - 130)
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${n === '网关' ? 'url(#acc)' : '#ffffff'}" stroke="${p.from}" stroke-opacity="0.4"/>
  <text x="${x + w / 2}" y="${y + 42}" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="600" fill="${n === '网关' ? '#ffffff' : '#334155'}">${esc(n)}</text>`
    }).join('\n  ')
    art += `
  <path d="M${X + 40 + 0.16 * (W - 200) + 132} ${Y + 30 + 0.24 * (H - 130) + 34} L ${X + 40 + 0.52 * (W - 200)} ${Y + 30 + 0.5 * (H - 130) + 34}" stroke="${p.to}" stroke-width="3" marker-end="url(#ar)"/>
  <path d="M${X + 40 + 0.16 * (W - 200) + 132} ${Y + 30 + 0.76 * (H - 130) + 34} L ${X + 40 + 0.52 * (W - 200)} ${Y + 30 + 0.5 * (H - 130) + 34}" stroke="${p.to}" stroke-width="3" marker-end="url(#ar)"/>
  <path d="M${X + 40 + 0.52 * (W - 200) + 132} ${Y + 30 + 0.5 * (H - 130) + 34} L ${X + 40 + 0.86 * (W - 200)} ${Y + 30 + 0.5 * (H - 130) + 34}" stroke="${p.to}" stroke-width="3" marker-end="url(#ar)"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520" role="img" aria-label="${esc(caption || '')}">
  <defs>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
    <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="${p.to}"/>
    </marker>
  </defs>
  <rect x="1" y="1" width="998" height="518" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
  <rect x="48" y="42" width="46" height="4" rx="2" fill="url(#acc)"/>
  <text x="48" y="82" font-family="${FONT}" font-size="22" font-weight="700" fill="#0f172a">${esc(cap)}</text>
  ${art}
  <text x="952" y="486" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="15" fill="#94a3b8">${esc(BRAND.name)} / diagram</text>
</svg>
`
}

// 包内 hero 主视觉（不占用 uploads）
function heroSvg() {
  const p = PALETTE.code
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${esc(BRAND.name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f2f8ff"/><stop offset="1" stop-color="#eaf0ff"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" fill="none" stroke="#0f172a" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#grid)"/>
  <circle cx="1420" cy="180" r="260" fill="${p.from}" fill-opacity="0.07"/>
  <circle cx="180" cy="780" r="220" fill="${p.to}" fill-opacity="0.07"/>
  ${motif('code', 1180, 520, 300, p.from, p.to, p.soft)}
  <rect x="120" y="300" width="72" height="6" rx="3" fill="url(#acc)"/>
  <text x="120" y="392" font-family="ui-monospace, Menlo, monospace" font-size="30" letter-spacing="10" fill="${p.from}" font-weight="600">${esc(BRAND.en)}</text>
  <text x="118" y="500" font-family="${FONT}" font-size="96" font-weight="800" fill="#0f172a">${esc(BRAND.name)}</text>
  <text x="122" y="576" font-family="${FONT}" font-size="34" fill="#475569">编程 · Token · AI · 机器人 · 开源</text>
  ${['只写验证过的', '写清代价', '写边界'].map((t, i) => {
    const w = units(t) * 26 + 48
    const x = 120 + i * (w + 18)
    return `<rect x="${x}" y="632" width="${w}" height="56" rx="28" fill="#ffffff" stroke="#dbe4f0"/>
  <text x="${x + w / 2}" y="669" text-anchor="middle" font-family="${FONT}" font-size="25" fill="#334155">${esc(t)}</text>`
  }).join('\n  ')}
  <rect x="0" y="892" width="1600" height="8" fill="url(#acc)"/>
</svg>
`
}

// ---------------------------------------------------------------- 清理旧内容
console.log('=== 1) 清理旧内容 ===')
db.pragma('foreign_keys = OFF')
const counts = {}
for (const t of ['article_tags', 'article_likes', 'article_views', 'content_reviews', 'articles', 'categories', 'sections', 'tags', 'friend_links', 'media']) {
  counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c
  db.prepare(`DELETE FROM ${t}`).run()
}
db.pragma('foreign_keys = ON')
console.log('  删除:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '))

// 清掉旧站的媒体文件
for (const d of LEGACY_UPLOAD_DIRS) {
  const abs = path.join(UPLOADS, d)
  if (fs.existsSync(abs)) {
    fs.rmSync(abs, { recursive: true, force: true })
    console.log('  删除旧媒体目录:', d)
  }
}

// ---------------------------------------------------------------- 生成媒体
console.log('=== 2) 生成 SVG 媒体 ===')
fs.mkdirSync(OUT_MEDIA, { recursive: true })
const mediaRows = []
function writeMedia(name, svgOrBuf, mime, w, h) {
  const abs = path.join(OUT_MEDIA, name)
  fs.writeFileSync(abs, svgOrBuf)
  mediaRows.push({
    filename: name, original_name: name, mime_type: mime,
    size: fs.statSync(abs).size, url: MEDIA_URL + name,
    width: w, height: h,
  })
}

const content = [
  ...JSON.parse(fs.readFileSync('/tmp/_blog_c1.json', 'utf8')).articles,
  ...JSON.parse(fs.readFileSync('/tmp/_blog_c2.json', 'utf8')).articles,
]
const secBySlug = new Map(SECTIONS.map((s) => [s.slug, s]))
const catByKey = new Map(CATEGORIES.map((c) => [c.section + '/' + c.slug, c]))

let figTotal = 0
for (const a of content) {
  const sec = secBySlug.get(a.section)
  if (!sec) throw new Error('未知板块: ' + a.section)
  const cat = a.category ? catByKey.get(a.section + '/' + a.category) : null
  if (a.category && !cat) throw new Error('未知分类: ' + a.section + '/' + a.category)

  writeMedia(`${a.slug}-cover.svg`, coverSvg(a, sec, cat), 'image/svg+xml', 1200, 630)

  // 内文插图：从 markdown 的图注里取标题
  const figs = [...a.content.matchAll(/!\[([^\]]*)\]\(\{\{F(\d+)\}\}\)/g)]
  for (const [, caption, idx] of figs) {
    const n = Number(idx)
    writeMedia(`${a.slug}-fig${n}.svg`, figureSvg(caption, sec, n - 1), 'image/svg+xml', 1000, 520)
    figTotal++
  }
  a.content = a.content.replace(/\{\{F(\d+)\}\}/g, (_m, n) => `${MEDIA_URL}${a.slug}-fig${n}.svg`)
}

// 页脚二维码（由 Python 生成的真二维码）
const QR = [['qr-mp.png', 348], ['qr-github.png', 348]]
for (const [name, size] of QR) {
  const src = path.join('/tmp/_qr_blog', name)
  if (!fs.existsSync(src)) throw new Error('缺少二维码文件: ' + src)
  writeMedia(name, fs.readFileSync(src), 'image/png', size, size)
}

// 包内 hero 主视觉
fs.mkdirSync(HERO_OUT, { recursive: true })
fs.writeFileSync(path.join(HERO_OUT, 'hero-cover.svg'), heroSvg())

console.log(`  封面 ${content.length} | 插图 ${figTotal} | 二维码 ${QR.length} | 合计文件 ${mediaRows.length}`)

const insMedia = db.prepare(
  'INSERT INTO media (filename, original_name, mime_type, size, url, width, height, uploaded_by, is_reviewed) VALUES (?,?,?,?,?,?,?,?,1)'
)
for (const m of mediaRows) insMedia.run(m.filename, m.original_name, m.mime_type, m.size, m.url, m.width, m.height, AUTHOR_ID)

// ---------------------------------------------------------------- 写内容
console.log('=== 3) 写入博客 IA 与文章 ===')
const insSection = db.prepare(
  'INSERT INTO sections (name, slug, path, description, sort_order, is_active, kind, template) VALUES (?,?,?,?,?,1,?,?)'
)
const sectionIdBySlug = new Map()
for (const s of SECTIONS) {
  const r = insSection.run(s.name, s.slug, s.path, s.description, s.sortOrder, 'articles', s.template)
  sectionIdBySlug.set(s.slug, Number(r.lastInsertRowid))
}

const insCategory = db.prepare(
  'INSERT INTO categories (name, slug, section_id, description, sort_order, template) VALUES (?,?,?,?,?,?)'
)
const catIdByKey = new Map()
for (const c of CATEGORIES) {
  const sid = sectionIdBySlug.get(c.section)
  const sec = secBySlug.get(c.section)
  const r = insCategory.run(c.name, c.slug, sid, null, c.sortOrder, sec.template)
  catIdByKey.set(c.section + '/' + c.slug, Number(r.lastInsertRowid))
}

const insArticle = db.prepare(
  'INSERT INTO articles (title, slug, content, excerpt, cover_image, section_id, category_id, status, author_id, published_at, meta, article_template, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?,0)'
)
const insTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
const findTag = db.prepare('SELECT id FROM tags WHERE name=?')
const insAT = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?,?)')

for (const a of content) {
  const sid = sectionIdBySlug.get(a.section)
  const cid = a.category ? catIdByKey.get(a.section + '/' + a.category) : null
  const r = insArticle.run(a.title, a.slug, a.content, a.excerpt, `${MEDIA_URL}${a.slug}-cover.svg`, sid, cid, 'published', AUTHOR_ID, a.publishedAt, 'standard')
  const aid = Number(r.lastInsertRowid)
  for (const t of a.tags || []) {
    insTag.run(t)
    insAT.run(aid, findTag.get(t).id)
  }
}

const insLink = db.prepare('INSERT INTO friend_links (name, url, description, sort_order, is_active) VALUES (?,?,?,?,1)')
for (const l of FRIEND_LINKS) insLink.run(l.name, l.url, l.description, l.sortOrder)

// ---------------------------------------------------------------- 站点设置
console.log('=== 4) 更新站点设置 ===')
function setSetting(key, value) {
  const cur = db.prepare('SELECT id FROM site_settings WHERE key=?').get(key)
  const v = typeof value === 'string' ? value : JSON.stringify(value)
  if (cur) db.prepare("UPDATE site_settings SET value=?, updated_at=datetime('now') WHERE id=?").run(v, cur.id)
  else db.prepare('INSERT INTO site_settings (key, value) VALUES (?,?)').run(key, v)
}

const footerNav = [
  {
    title: '板块',
    links: SECTIONS.filter((s) => s.slug !== 'about').map((s) => ({ name: s.name, url: s.path })),
  },
  {
    title: '热门分类',
    links: [
      { name: '前端', url: '/code?category=frontend' },
      { name: '工程效能', url: '/code?category=devops' },
      { name: 'RAG', url: '/ai?category=rag' },
      { name: 'Agent', url: '/ai?category=agent' },
      { name: '边缘推理', url: '/robotics?category=edge' },
    ],
  },
  {
    title: '更多',
    links: [
      { name: '全部文章', url: '/articles' },
      { name: '关于本站', url: '/about' },
    ],
  },
  {
    title: '订阅与联系',
    html:
      '<div style="display:flex;gap:14px">' +
      '<figure style="margin:0;text-align:center">\n' +
      `<img src="${MEDIA_URL}qr-mp.png" alt="公众号" width="104" height="104" style="display:block;border-radius:10px;background:#fff;padding:6px" />\n` +
      '<figcaption style="margin-top:8px;font-size:12px;letter-spacing:.04em">公众号</figcaption>\n' +
      '</figure>' +
      '<figure style="margin:0;text-align:center">\n' +
      `<img src="${MEDIA_URL}qr-github.png" alt="GitHub" width="104" height="104" style="display:block;border-radius:10px;background:#fff;padding:6px" />\n` +
      '<figcaption style="margin-top:8px;font-size:12px;letter-spacing:.04em">GitHub</figcaption>\n' +
      '</figure></div>',
  },
]

const heroSlides = [
  { id: 'blog-hero-cover', imageUrl: '/styles/blog/media/hero-cover.svg', linkUrl: '/articles', linkTarget: '_self' },
  { id: 'blog-hero-code', imageUrl: `${MEDIA_URL}react-server-components-boundary-cover.svg`, linkUrl: '/code/react-server-components-boundary', linkTarget: '_self' },
  { id: 'blog-hero-rag', imageUrl: `${MEDIA_URL}rag-chunking-strategy-cover.svg`, linkUrl: '/ai/rag-chunking-strategy', linkTarget: '_self' },
]

const heroCta = [
  { label: { zh: '浏览全部文章', en: 'Browse all posts' }, href: '/articles', target: '_self', variant: 'primary' },
  { label: { zh: 'AI 工程', en: 'AI Engineering' }, href: '/ai', target: '_self', variant: 'secondary' },
  { label: { zh: '关于本站', en: 'About' }, href: '/about', target: '_self', variant: 'secondary' },
]

const homeBanners = [
  {
    id: 'home_main',
    enabled: true,
    type: 'cta',
    position: 'after_hero',
    cta: {
      title: { zh: '把踩过的坑写成可复用的做法', en: 'Turn hard-won lessons into reusable practice' },
      subtitle: { zh: '极客手记 · 编程 / Token / AI / 机器人 / 开源', en: 'GeekNotes · Code / Token / AI / Robotics / Open source' },
      buttonText: { zh: '浏览全部文章', en: 'Browse all posts' },
      buttonLink: '/articles',
    },
  },
  {
    id: 'home_bottom',
    enabled: true,
    type: 'cta',
    position: 'after_list',
    cta: {
      title: { zh: '内容与装修是分开的', en: 'Content and styling are decoupled' },
      subtitle: { zh: '文章存在数据库，版式由风格包定义——换一套风格包，文章一条都不会动。', en: 'Posts live in the database, layout comes from a style pack.' },
      buttonText: { zh: '看看 AI 工程', en: 'Explore AI engineering' },
      buttonLink: '/ai',
    },
  },
]

setSetting('site_name', BRAND.name)
setSetting('site_description', BRAND.description)
setSetting('copyright_text', BRAND.copyright)
setSetting('footer_nav', footerNav)
setSetting('footer_nav_columns', '4')
setSetting('friend_links_columns', '3')
setSetting('default_theme', 'light')
setSetting('hero_slides', heroSlides)
setSetting('hero_cta_buttons', heroCta)
setSetting('hero_carousel_use_articles', 'true')
setSetting('hero_carousel_article_source', 'latest')
setSetting('hero_carousel_max_items', '5')
setSetting('hero_carousel_interval', '5')
setSetting('hero_effect', 'fade')
setSetting('hero_size', 'full')
setSetting('home_banners', homeBanners)
setSetting('home_banner_enabled', 'true')
setSetting('home_banner_position', 'after_hero')

// ---------------------------------------------------------------- 校验
try { db.prepare("INSERT INTO articles_fts(articles_fts) VALUES('rebuild')").run() } catch (e) { console.log('  FTS rebuild 跳过:', e.message) }

console.log('=== 完成 ===')
const q = (sql) => db.prepare(sql).get().c
console.log('  sections:', q('SELECT COUNT(*) c FROM sections'), '| categories:', q('SELECT COUNT(*) c FROM categories'),
  '| articles:', q('SELECT COUNT(*) c FROM articles'), '| tags:', q('SELECT COUNT(*) c FROM tags'),
  '| article_tags:', q('SELECT COUNT(*) c FROM article_tags'), '| friend_links:', q('SELECT COUNT(*) c FROM friend_links'),
  '| media:', q('SELECT COUNT(*) c FROM media'))
console.log('  站点名:', db.prepare("SELECT value FROM site_settings WHERE key='site_name'").get().value)
console.log('  hero 主视觉:', path.join(HERO_OUT, 'hero-cover.svg'), fs.statSync(path.join(HERO_OUT, 'hero-cover.svg')).size, 'B')

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Database, Loader2, ShieldCheck, Sparkles } from 'lucide-react'

/**
 * 首次安装向导：
 *   ① 创建管理员账号（弱口令在服务端被拒绝）
 *   ② 选择风格包并激活
 *   ③ 可选：安装该包自带的演示示例内容（板块/分类/文章/标签/友链/站点设置）
 * 不勾选示例内容时，站点就是一个干净的全空白站。
 */

interface PackInfo {
  id: string
  name: string
  previewUrl: string
  hasDemo: boolean
  demo: { available: boolean; sections: number; categories: number; articles: number; tags: number; friendLinks: number; siteSettings: number; media: number }
}

interface SetupResult {
  username: string
  stylePackId: string
  demo: Record<string, number> | null
  message: string
}

export default function SetupPage() {
  const [loading, setLoading] = useState(true)
  const [installed, setInstalled] = useState(false)
  const [packs, setPacks] = useState<PackInfo[]>([])

  const [step, setStep] = useState(1)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [packId, setPackId] = useState('')
  const [withDemo, setWithDemo] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SetupResult | null>(null)

  useEffect(() => {
    fetch('/api/v1/setup/status')
      .then((r) => r.json())
      .then((j) => {
        setInstalled(!!j.data?.installed)
        setPacks(j.data?.packs || [])
        // 默认选中第一个含示例内容的包，否则第一个包
        const list: PackInfo[] = j.data?.packs || []
        const preferred = list.find((p) => p.hasDemo) || list[0]
        if (preferred) setPackId(preferred.id)
      })
      .catch(() => setError('无法连接服务器，请确认后端已启动'))
      .finally(() => setLoading(false))
  }, [])

  const selectedPack = packs.find((p) => p.id === packId)

  async function submit() {
    setError('')
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return setError('用户名需为 3-32 位字母/数字/下划线')
    if (password.length < 8) return setError('密码至少 8 位')
    if (password !== password2) return setError('两次输入的密码不一致')
    if (!packId) return setError('请选择一个风格包')
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName, stylePackId: packId, installDemo: withDemo }),
      })
      const j = await res.json()
      if (!j.success) throw new Error(j.error || '初始化失败')
      setResult(j.data)
      setStep(4)
    } catch (e: any) {
      setError(e.message || '初始化失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg-primary">
        <Loader2 className="w-8 h-8 animate-spin text-t-accent-blue" />
      </div>
    )
  }

  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-t-bg-primary px-4">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-t-text-primary mb-2">站点已初始化</h1>
          <p className="text-t-text-secondary mb-6">安装向导仅在新站点首次部署时可用。</p>
          <Link href="/" className="inline-block px-4 py-2 text-sm rounded-lg bg-t-accent-blue text-white hover:bg-t-accent-blue-dim transition-colors">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-t-border bg-t-bg-primary text-t-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-t-accent-blue/40'

  return (
    <div className="min-h-screen bg-t-bg-primary flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-t-accent-blue mb-2">
            <Sparkles size={20} />
            <span className="text-xs font-semibold tracking-widest uppercase">TokenPress Setup</span>
          </div>
          <h1 className="text-3xl font-bold text-t-text-primary">欢迎使用 TokenPress</h1>
          <p className="text-t-text-secondary mt-2 text-sm">三步完成初始化：创建管理员 → 选择风格包 → 决定是否装入演示内容</p>
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['账号', '风格包', '内容', '完成'].map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${active ? 'bg-t-accent-blue text-white' : done ? 'bg-green-500/15 text-green-600' : 'bg-t-bg-tertiary text-t-text-muted'}`}>
                  {done ? <CheckCircle2 size={13} /> : <span>{n}</span>}
                  {label}
                </div>
                {n < 4 && <ChevronRight size={14} className="text-t-text-muted" />}
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-t-border bg-t-bg-secondary p-6 sm:p-8">
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 text-red-600 text-sm">{error}</div>
          )}

          {/* Step 1：管理员账号 */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-t-accent-blue mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-t-text-primary">创建管理员账号</h2>
                  <p className="text-sm text-t-text-secondary mt-1">
                    这是站点的超级管理员，请妥善保管。
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm text-t-text-secondary mb-1.5">用户名（3-32 位字母/数字/下划线）</label>
                <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1.5">密码（至少 8 位）</label>
                  <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </div>
                <div>
                  <label className="block text-sm text-t-text-secondary mb-1.5">确认密码</label>
                  <input type="password" className={inputCls} value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-t-text-secondary mb-1.5">显示名称（可选，文章元信息里展示的名字）</label>
                <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="如：HXP" />
              </div>
              <button
                className="w-full py-3 rounded-xl bg-t-accent-blue text-white font-medium hover:bg-t-accent-blue-dim transition-colors disabled:opacity-50"
                onClick={() => {
                  setError('')
                  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) return setError('用户名需为 3-32 位字母/数字/下划线')
                  if (password.length < 8) return setError('密码至少 8 位')
                  if (password !== password2) return setError('两次输入的密码不一致')
                  setStep(2)
                }}
              >
                下一步：选择风格包
              </button>
            </div>
          )}

          {/* Step 2：选择风格包 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-t-text-primary">选择风格包</h2>
                <p className="text-sm text-t-text-secondary mt-1">风格包决定站点的布局、配色与装修，激活后仍可在后台随时切换或继续定制。</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {packs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPackId(p.id)}
                    className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
                      packId === p.id ? 'border-t-accent-blue shadow-lg shadow-t-accent-blue/10' : 'border-t-border hover:border-t-accent-blue/40'
                    }`}
                  >
                    <div className="aspect-[1216/832] bg-t-bg-tertiary">
                      {p.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.previewUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-t-text-muted text-xs">无预览</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-t-text-primary text-sm">{p.name}</span>
                        {packId === p.id && <CheckCircle2 size={16} className="text-t-accent-blue" />}
                      </div>
                      <div className="text-xs text-t-text-muted mt-0.5">{p.id}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button className="px-5 py-3 rounded-xl border border-t-border text-t-text-secondary hover:bg-t-hover transition-colors" onClick={() => setStep(1)}>
                  上一步
                </button>
                <button
                  className="flex-1 py-3 rounded-xl bg-t-accent-blue text-white font-medium hover:bg-t-accent-blue-dim transition-colors disabled:opacity-50"
                  disabled={!packId}
                  onClick={() => setStep(3)}
                >
                  下一步：示例内容
                </button>
              </div>
            </div>
          )}

          {/* Step 3：示例内容 */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-t-accent-blue mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-t-text-primary">安装演示示例内容？</h2>
                  <p className="text-sm text-t-text-secondary mt-1">
                    {selectedPack?.hasDemo
                      ? '该风格包自带一套完整的演示站点内容，适合快速预览效果；之后可在后台删除。'
                      : '当前风格包未提供演示内容。'}
                  </p>
                </div>
              </div>

              {selectedPack?.hasDemo && selectedPack.demo && (
                <label className={`block rounded-xl border-2 p-4 cursor-pointer transition-all ${withDemo ? 'border-t-accent-blue bg-t-accent-blue/5' : 'border-t-border'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 accent-[var(--accent-blue)]" checked={withDemo} onChange={(e) => setWithDemo(e.target.checked)} />
                    <div>
                      <div className="font-medium text-t-text-primary text-sm">安装「{selectedPack.name}」演示示例内容</div>
                      <div className="text-xs text-t-text-secondary mt-2 grid grid-cols-3 gap-y-1.5">
                        <span>板块 {selectedPack.demo.sections}</span>
                        <span>分类 {selectedPack.demo.categories}</span>
                        <span>文章 {selectedPack.demo.articles}</span>
                        <span>标签 {selectedPack.demo.tags}</span>
                        <span>友链 {selectedPack.demo.friendLinks}</span>
                        <span>站点设置 {selectedPack.demo.siteSettings} 项</span>
                      </div>
                      <div className="text-xs text-t-text-muted mt-2">
                        幂等安装：目标站已有的同名板块/文章/设置会自动跳过，不会覆盖你的数据。
                      </div>
                    </div>
                  </div>
                </label>
              )}

              {!withDemo && (
                <div className="rounded-xl border border-t-border p-4 text-sm text-t-text-secondary">
                  不安装示例内容 —— 站点将是<strong className="text-t-text-primary">全空白</strong>（无板块、无文章），全部由你从零创建。
                </div>
              )}

              <div className="flex gap-3">
                <button className="px-5 py-3 rounded-xl border border-t-border text-t-text-secondary hover:bg-t-hover transition-colors" onClick={() => setStep(2)}>
                  上一步
                </button>
                <button
                  className="flex-1 py-3 rounded-xl bg-t-accent-blue text-white font-medium hover:bg-t-accent-blue-dim transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={submitting}
                  onClick={submit}
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? '正在初始化…' : '完成初始化'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4：完成 */}
          {step === 4 && result && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-t-text-primary mb-2">初始化完成 🎉</h2>
              <p className="text-sm text-t-text-secondary mb-1">
                管理员 <strong className="text-t-text-primary">{result.username}</strong> · 风格包{' '}
                <strong className="text-t-text-primary">{result.stylePackId}</strong>
              </p>
              {result.demo && (
                <p className="text-xs text-t-text-muted mb-6">
                  已安装演示内容：板块 {result.demo.sections} · 分类 {result.demo.categories} · 文章 {result.demo.articles} · 标签 {result.demo.tags} · 友链{' '}
                  {result.demo.friendLinks} · 站点设置 {result.demo.siteSettings}
                </p>
              )}
              {!result.demo && <p className="text-xs text-t-text-muted mb-6">站点当前为空白，可从后台开始创建内容。</p>}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/auth/login" className="px-5 py-2.5 rounded-xl bg-t-accent-blue text-white text-sm font-medium hover:bg-t-accent-blue-dim transition-colors">
                  去登录
                </a>
                <a href="/" className="px-5 py-2.5 rounded-xl border border-t-border text-t-text-secondary text-sm hover:bg-t-hover transition-colors">
                  查看站点
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

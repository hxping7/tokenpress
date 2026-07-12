'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { LogIn, Eye, EyeOff, RefreshCw } from 'lucide-react'

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()

  // 获取验证码
  const fetchCaptcha = async () => {
    try {
      const res = await api.get<{ success: boolean; data: { captchaId: string; image: string } }>('/auth/captcha')
      if (res.success && res.data) {
        setCaptchaId(res.data.captchaId)
        setCaptchaImage(res.data.image)
      }
    } catch (err) {
      console.error('Failed to fetch captcha:', err)
    }
  }

  // 首次加载验证码（如需要）
  useEffect(() => {
    if (captchaRequired && !captchaImage) {
      fetchCaptcha()
    }
  }, [captchaRequired, captchaImage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.login(username, password, captchaId, captchaCode)
      if (res.success && res.data) {
        setAuth(res.data.token, res.data.refreshToken, res.data.user)
        const redirect = searchParams.get('redirect') || '/'
        router.push(redirect)
      } else {
        setError('登录失败')
      }
    } catch (err: any) {
      // 检查是否需要验证码
      if (err instanceof ApiError && err.message.includes('验证码')) {
        if (!captchaRequired) {
          setCaptchaRequired(true)
          await fetchCaptcha()
        }
        setError(err.message)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('网络错误，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCaptchaRefresh = async () => {
    setCaptchaCode('')
    await fetchCaptcha()
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface p-6 space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-400/10 rounded-lg border border-red-400/20">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-t-text-secondary mb-1.5">用户名</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          className="w-full px-3 py-2.5 bg-t-bg-tertiary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30 transition-colors"
          placeholder="请输入用户名"
        />
      </div>

      <div>
        <label className="block text-sm text-t-text-secondary mb-1.5">密码</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 pr-10 bg-t-bg-tertiary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30 transition-colors"
            placeholder="请输入密码"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-t-text-muted hover:text-t-text-secondary"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {captchaRequired && (
        <div>
          <label className="block text-sm text-t-text-secondary mb-1.5">验证码</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={captchaCode}
              onChange={(e) => setCaptchaCode(e.target.value)}
              required
              className="flex-1 px-3 py-2.5 bg-t-bg-tertiary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30 transition-colors"
              placeholder="请输入验证码"
              maxLength={4}
            />
            <button
              type="button"
              onClick={handleCaptchaRefresh}
              className="px-3 py-2 bg-t-bg-tertiary border border-t-border rounded-lg hover:bg-t-bg-secondary transition-colors flex items-center justify-center"
              title="刷新验证码"
            >
              <RefreshCw size={18} className="text-t-text-secondary" />
            </button>
          </div>
          {captchaImage && (
            <div
              className="mt-2 flex justify-center"
              dangerouslySetInnerHTML={{ __html: captchaImage }}
            />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-glow py-2.5 bg-gradient-accent text-white font-medium rounded-lg text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <LogIn size={16} />
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen pt-16 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold gradient-text">
            TokenPress
          </Link>
          <p className="text-sm text-t-text-secondary mt-2">登录管理后台</p>
        </div>

        <Suspense fallback={<div className="card-surface p-6">Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-t-text-muted mt-6">
          TokenPress · AI 赋能综合内容平台
        </p>
      </div>
    </div>
  )
}

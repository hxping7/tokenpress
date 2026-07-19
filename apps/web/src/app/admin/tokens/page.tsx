'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { API_PERMISSION_CATALOG, API_PERMISSION_CATEGORY_ORDER, API_PERMISSION_CATEGORY_LABELS } from '@tokenpress/shared'
import { Plus, Trash2, X, Check, Copy, Key, Clock, Shield, Activity } from 'lucide-react'

interface ApiToken {
  id: number
  name: string
  token: string
  permissions: string[]
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

// 权限选项派生自共享目录（packages/shared），与后端白名单/角色口径单一来源一致
const allPermissionOptions = API_PERMISSION_CATALOG.map((p) => ({
  value: p.value,
  labelKey: p.labelKey,
  roles: p.roles,
  category: p.category,
}))

export default function TokensPage() {
  const queryClient = useQueryClient()
  const { token, user: currentUser } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const currentRole = currentUser?.role || 'user'
  const permissionOptions = allPermissionOptions.filter(opt => opt.roles.includes(currentRole))
  // 按分类分组（仅保留当前角色可授予的权限），用于前端 UI 分组展示
  const permissionGroups = API_PERMISSION_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    labelKey: API_PERMISSION_CATEGORY_LABELS[cat],
    options: permissionOptions.filter((opt) => opt.category === cat),
  })).filter((g) => g.options.length > 0)
  const [showEditor, setShowEditor] = useState(false)
  const [showToken, setShowToken] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Editor state
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<string[]>(['article:write'])
  const [expiresAt, setExpiresAt] = useState('')

  const { data: tokensData, isLoading } = useQuery({
    queryKey: ['admin-tokens'],
    queryFn: () => api.get('/tokens'),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/tokens', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tokens'] })
      setShowToken(res.data.token)
      setShowEditor(false)
      resetEditor()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tokens/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tokens'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/tokens/${id}`, { is_active: isActive }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tokens'] }),
  })

  const resetEditor = () => {
    setName('')
    setPermissions(['article:write'])
    setExpiresAt('')
  }

  const handleSubmit = () => {
    const data: any = {
      name,
      permissions,
    }
    if (expiresAt) {
      data.expires_at = expiresAt
    }
    createMutation.mutate(data)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatDate = (date: string | null) => {
    if (!date) return t('tokens.neverExpires', backendLocale)
    return new Date(date).toLocaleDateString('zh-CN')
  }

  const getPermissionLabel = (value: string) => {
    const opt = permissionOptions.find(p => p.value === value)
    return opt ? t(opt.labelKey, backendLocale) : value
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('tokens.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('tokens.desc', backendLocale)}</p>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
        >
          <Plus size={18} />
          {t('tokens.createToken', backendLocale)}
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Key size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium">{t('tokens.aiIntegration', backendLocale)}</h3>
            <p className="text-sm text-t-text-secondary mt-1">
              {t('tokens.aiIntegrationDesc', backendLocale)}
            </p>
          </div>
        </div>
      </div>

      {/* Tokens List */}
      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.loading', backendLocale)}</div>
      ) : tokensData?.data?.length === 0 ? (
        <div className="text-center py-12 text-t-text-secondary">
          <Key size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t('tokens.noTokens', backendLocale)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tokensData?.data?.map((tokenItem: ApiToken) => (
            <div key={tokenItem.id} className="bg-t-bg-primary border border-t-border rounded-xl p-5 hover:border-t-accent-blue/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-t-accent-blue/20 to-t-accent-purple/20 flex items-center justify-center">
                    <Key size={24} className="text-t-accent-blue" />
                  </div>
                  <div>
                    <h3 className="font-medium">{tokenItem.name}</h3>
                    <p className="text-sm text-t-text-secondary mt-1 font-mono">
                      {tokenItem.token.substring(0, 20)}...
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        tokenItem.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tokenItem.is_active ? t('common.enabled', backendLocale) : t('common.disabled', backendLocale)}
                      </span>
                      {tokenItem.last_used_at && (
                        <span className="flex items-center gap-1 text-xs text-t-text-secondary">
                          <Activity size={12} />
                          {t('tokens.lastUsed')}: {new Date(tokenItem.last_used_at).toLocaleString('zh-CN')}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-t-text-secondary">
                        <Clock size={12} />
                        {t('tokens.expires', backendLocale)}: {formatDate(tokenItem.expires_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleMutation.mutate({ id: tokenItem.id, isActive: !tokenItem.is_active })}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      tokenItem.is_active
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {tokenItem.is_active ? t('common.disabled', backendLocale) : t('common.enabled', backendLocale)}
                  </button>
                  <button
                    onClick={() => { if (confirm(t('tokens.confirmDelete', backendLocale))) deleteMutation.mutate(tokenItem.id) }}
                    className="p-2 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {/* Permissions */}
              <div className="mt-4 pt-4 border-t border-t-border">
                <div className="flex flex-wrap gap-2">
                  {tokenItem.permissions.map((perm) => (
                    <span key={perm} className="px-2 py-1 bg-t-bg-secondary text-sm text-t-text-secondary rounded-lg">
                      {getPermissionLabel(perm)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowEditor(false)} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{t('tokens.createToken', backendLocale)}</h2>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('tokens.tokenName', backendLocale)}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('tokens.tokenNamePlaceholder', backendLocale)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('tokens.permissions', backendLocale)}</label>
                <div className="space-y-4">
                  {permissionGroups.map((group) => (
                    <div key={group.category}>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-t-text-secondary mb-2">
                        {t(group.labelKey, backendLocale)}
                      </h4>
                      <div className="space-y-2">
                        {group.options.map((opt) => (
                          <label key={opt.value} className="flex items-center gap-3 p-3 bg-t-bg-secondary rounded-lg cursor-pointer hover:bg-t-hover">
                            <input
                              type="checkbox"
                              checked={permissions.includes(opt.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPermissions([...permissions, opt.value])
                                } else {
                                  setPermissions(permissions.filter(p => p !== opt.value))
                                }
                              }}
                              className="w-4 h-4 rounded text-t-accent-blue"
                            />
                            <span>{t(opt.labelKey, backendLocale)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('tokens.expiresAt', backendLocale)}</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
                <p className="text-xs text-t-text-secondary mt-1">{t('tokens.expiresHint', backendLocale)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', backendLocale)}</button>
              <button onClick={handleSubmit} disabled={!name || permissions.length === 0 || createMutation.isPending} className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50">
                <Check size={18} /> {t('common.create', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Reveal Modal */}
      {showToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowToken(null)} />
          <div className="relative w-full max-w-lg bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold text-green-400">{t('tokens.tokenCreated', backendLocale)}</h2>
              <button onClick={() => setShowToken(null)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-400">
                  {t('tokens.tokenWarning', backendLocale)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Token</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg font-mono text-sm break-all">
                    {showToken}
                  </code>
                  <button
                    onClick={() => copyToClipboard(showToken)}
                    className="p-3 bg-t-accent-blue text-black rounded-lg hover:bg-t-accent-blue/90"
                  >
                    {copied === showToken ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={() => setShowToken(null)} className="px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90">
                {t('tokens.copied', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

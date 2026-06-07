'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Plus, Edit, Trash2, X, Check, Shield, Crown, User as UserIcon, KeyRound, Power, Copy, Shuffle, Eye, EyeOff } from 'lucide-react'

interface User {
  id: number
  username: string
  display_name: string | null
  role: 'superadmin' | 'admin' | 'user'
  is_active: boolean
  created_at: string
}

const allRoleOptions = [
  { value: 'superadmin', labelKey: 'users.roleSuperAdmin', icon: Crown },
  { value: 'admin', labelKey: 'users.roleAdmin', icon: Shield },
  { value: 'user', labelKey: 'users.roleUser', icon: UserIcon },
]

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { token, user: currentUser } = useAuthStore()
  const { backendLocale } = useLocaleStore()
  const currentRole = currentUser?.role || 'user'
  const canManageUsers = currentRole === 'superadmin' || currentRole === 'admin'

  const [showEditor, setShowEditor] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [resetPassword, setResetPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Change password modal
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [changePasswordUser, setChangePasswordUser] = useState<User | null>(null)
  const [cpCurrentPassword, setCpCurrentPassword] = useState('')
  const [cpNewPassword, setCpNewPassword] = useState('')
  const [cpConfirmPassword, setCpConfirmPassword] = useState('')
  const [cpShowCurrent, setCpShowCurrent] = useState(false)
  const [cpShowNew, setCpShowNew] = useState(false)
  const [cpShowConfirm, setCpShowConfirm] = useState(false)
  const [cpError, setCpError] = useState('')
  const [cpSuccess, setCpSuccess] = useState(false)

  // Editor state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'superadmin' | 'admin' | 'user'>('user')
  const [isActive, setIsActive] = useState(true)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      return api.get(`/users?${params}`)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowEditor(false)
      resetEditor()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/users/${id}`, data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowEditor(false)
      setEditingUser(null)
      resetEditor()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.put(`/users/${id}`, { isActive }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/users/${id}/reset-password`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: (res) => {
      setResetPassword(res.data.password)
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.meChangePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCpSuccess(true)
    },
    onError: (err: any) => {
      if (err instanceof ApiError) {
        if (err.message.includes('incorrect')) {
          setCpError(t('changePassword.currentPasswordError', backendLocale))
        } else {
          setCpError(err.message)
        }
      } else {
        setCpError(t('changePassword.networkError', backendLocale))
      }
    },
  })

  const resetEditor = () => {
    setUsername('')
    setPassword('')
    setDisplayName('')
    setRole('user')
    setIsActive(true)
  }

  const openEditor = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setUsername(user.username)
      setPassword('')
      setDisplayName(user.display_name || '')
      setRole(user.role)
      setIsActive(user.is_active)
    } else {
      setEditingUser(null)
      resetEditor()
    }
    setShowEditor(true)
  }

  const openChangePassword = (user: User) => {
    setChangePasswordUser(user)
    setCpCurrentPassword('')
    setCpNewPassword('')
    setCpConfirmPassword('')
    setCpShowCurrent(false)
    setCpShowNew(false)
    setCpShowConfirm(false)
    setCpError('')
    setCpSuccess(false)
    setShowChangePassword(true)
  }

  const handleChangePassword = () => {
    setCpError('')
    if (cpNewPassword.length < 6) {
      setCpError(t('changePassword.minLengthError', backendLocale))
      return
    }
    if (cpNewPassword !== cpConfirmPassword) {
      setCpError(t('changePassword.mismatchError', backendLocale))
      return
    }
    if (cpNewPassword === cpCurrentPassword) {
      setCpError(t('changePassword.sameError', backendLocale))
      return
    }
    changePasswordMutation.mutate({ currentPassword: cpCurrentPassword, newPassword: cpNewPassword })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = () => {
    const data: any = {
      displayName: displayName || null,
      role,
      isActive,
    }
    if (!editingUser) {
      data.username = username
      data.password = password
    }

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return t('users.roleSuperAdmin', backendLocale)
      case 'admin': return t('users.roleAdmin', backendLocale)
      default: return t('users.roleUser', backendLocale)
    }
  }

  const isSelf = (user: User) => user.id === currentUser?.id

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('users.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">
            {canManageUsers ? t('users.desc', backendLocale) : t('users.descSelf', backendLocale)}
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
          >
            <Plus size={18} />
            {t('users.addUser', backendLocale)}
          </button>
        )}
      </div>

      {/* Search — only for admin+ */}
      {canManageUsers && (
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder={t('users.searchPlaceholder', backendLocale)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-t-text-primary placeholder-t-text-secondary focus:outline-none focus:border-t-accent-blue"
        />
      </div>
      )}

      {/* Users Table */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-t-bg-secondary border-b border-t-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">{t('users.displayName', backendLocale)}</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">{t('users.username', backendLocale)}</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">{t('users.role', backendLocale)}</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">{t('common.enabled', backendLocale)}</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-t-text-secondary">{t('users.createdAt', backendLocale)}</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-t-text-secondary">{t('articles.actions', backendLocale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-t-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-t-text-secondary">{t('common.loading', backendLocale)}</td></tr>
              ) : usersData?.data?.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-t-text-secondary">{t('users.noUsers', backendLocale)}</td></tr>
              ) : (
                usersData?.data?.map((user: User) => (
                  <tr key={user.id} className="hover:bg-t-hover transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-t-accent-blue to-t-accent-purple flex items-center justify-center text-white font-medium">
                          {user.display_name?.[0] || user.username[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{user.display_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-t-text-secondary">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'superadmin' ? 'bg-amber-500/20 text-amber-400' :
                        user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {user.is_active ? t('common.enabled', backendLocale) : t('common.disabled', backendLocale)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-t-text-secondary">
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Change password — for self (any role) */}
                        {isSelf(user) && (
                          <button
                            onClick={() => openChangePassword(user)}
                            className="p-2 text-t-text-secondary hover:text-t-accent-blue hover:bg-t-accent-blue/10 rounded-lg"
                            title={t('users.changePassword', backendLocale)}
                          >
                            <KeyRound size={16} />
                          </button>
                        )}
                        {/* Reset password — admin can reset user; superadmin can reset admin+user */}
                        {canManageUsers && !isSelf(user) && (currentRole === 'superadmin' ? user.role !== 'superadmin' : user.role === 'user') && (
                          <button
                            onClick={() => { if (confirm(t('users.confirmResetPassword', backendLocale))) resetPasswordMutation.mutate(user.id) }}
                            className="p-2 text-t-text-secondary hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg"
                            title={t('users.resetPassword', backendLocale)}
                          >
                            <Shuffle size={16} />
                          </button>
                        )}
                        {/* Toggle active — admin can toggle user; superadmin can toggle all except self */}
                        {canManageUsers && !isSelf(user) && (currentRole === 'superadmin' || user.role === 'user') && (
                          <button
                            onClick={() => {
                              const action = user.is_active ? t('common.disabled', backendLocale) : t('common.enabled', backendLocale)
                              if (confirm(t('users.confirmToggle', backendLocale).replace('{action}', action).replace('{username}', user.username))) {
                                toggleMutation.mutate({ id: user.id, isActive: !user.is_active })
                              }
                            }}
                            className={`p-2 rounded-lg ${
                              user.is_active
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-green-400 hover:bg-green-500/10'
                            }`}
                            title={user.is_active ? t('common.disabled', backendLocale) : t('common.enabled', backendLocale)}
                          >
                            <Power size={16} />
                          </button>
                        )}
                        {/* Edit — admin can edit user; superadmin can edit admin+user */}
                        {canManageUsers && !isSelf(user) && (currentRole === 'superadmin' ? user.role !== 'superadmin' : user.role === 'user') && (
                          <button
                            onClick={() => openEditor(user)}
                            className="p-2 text-t-text-secondary hover:text-t-text-primary hover:bg-t-bg-secondary rounded-lg"
                            title={t('common.edit', backendLocale)}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {/* Delete — admin can delete user; superadmin can delete admin+user */}
                        {canManageUsers && !isSelf(user) && (currentRole === 'superadmin' ? user.role !== 'superadmin' : user.role === 'user') && (
                          <button
                            onClick={() => { if (confirm(t('users.confirmDelete', backendLocale))) deleteMutation.mutate(user.id) }}
                            className="p-2 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            title={t('common.delete', backendLocale)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal — admin only */}
      {showEditor && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowEditor(false)} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{editingUser ? t('users.editUser', backendLocale) : t('users.addUser', backendLocale)}</h2>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('users.username', backendLocale)}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('users.usernamePlaceholder', backendLocale)}
                      className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('users.password', backendLocale)}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('users.passwordPlaceholder', backendLocale)}
                      className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">{t('users.displayName', backendLocale)}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('users.displayNamePlaceholder', backendLocale)}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('users.role', backendLocale)}</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'superadmin' | 'admin' | 'user')}
                  className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                >
                  {allRoleOptions
                    .filter(opt => {
                      if (currentRole === 'admin') return opt.value === 'user'
                      if (currentRole === 'superadmin') return opt.value !== 'superadmin'
                      return false
                    })
                    .map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey, backendLocale)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-t-accent-blue"
                  />
                  <span className="text-sm">{t('users.enableAccount', backendLocale)}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', backendLocale)}</button>
              <button
                onClick={handleSubmit}
                disabled={(editingUser ? false : (!username || !password)) || createMutation.isPending || updateMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Check size={18} /> {t('common.save', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && changePasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowChangePassword(false)} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{t('users.changePassword', backendLocale)}</h2>
              <button onClick={() => setShowChangePassword(false)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {cpSuccess ? (
                <div className="text-center space-y-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                    <Check size={24} className="text-green-500" />
                  </div>
                  <p className="text-sm text-t-text-secondary">{t('changePassword.successDesc', backendLocale)}</p>
                </div>
              ) : (
                <>
                  {cpError && (
                    <div className="p-3 text-sm text-red-400 bg-red-400/10 rounded-lg border border-red-400/20">
                      {cpError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('changePassword.currentPassword', backendLocale)}</label>
                    <div className="relative">
                      <input
                        type={cpShowCurrent ? 'text' : 'password'}
                        value={cpCurrentPassword}
                        onChange={(e) => setCpCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-10 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                        placeholder={t('changePassword.currentPasswordPlaceholder', backendLocale)}
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowCurrent(!cpShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-t-text-muted hover:text-t-text-secondary"
                      >
                        {cpShowCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('changePassword.newPassword', backendLocale)}</label>
                    <div className="relative">
                      <input
                        type={cpShowNew ? 'text' : 'password'}
                        value={cpNewPassword}
                        onChange={(e) => setCpNewPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-10 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                        placeholder={t('changePassword.newPasswordPlaceholder', backendLocale)}
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowNew(!cpShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-t-text-muted hover:text-t-text-secondary"
                      >
                        {cpShowNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('changePassword.confirmPassword', backendLocale)}</label>
                    <div className="relative">
                      <input
                        type={cpShowConfirm ? 'text' : 'password'}
                        value={cpConfirmPassword}
                        onChange={(e) => setCpConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-10 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                        placeholder={t('changePassword.confirmPasswordPlaceholder', backendLocale)}
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowConfirm(!cpShowConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-t-text-muted hover:text-t-text-secondary"
                      >
                        {cpShowConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {!cpSuccess && (
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
                <button onClick={() => setShowChangePassword(false)} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', backendLocale)}</button>
                <button
                  onClick={handleChangePassword}
                  disabled={!cpCurrentPassword || !cpNewPassword || !cpConfirmPassword || changePasswordMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
                >
                  <KeyRound size={18} />
                  {changePasswordMutation.isPending ? t('changePassword.changing', backendLocale) : t('changePassword.submit', backendLocale)}
                </button>
              </div>
            )}
            {cpSuccess && (
              <div className="flex justify-end px-6 py-4 border-t border-t-border bg-t-bg-secondary">
                <button onClick={() => setShowChangePassword(false)} className="px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90">
                  {t('common.confirm', backendLocale)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Modal — admin only */}
      {resetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setResetPassword(null)} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold text-green-400">{t('users.passwordReset', backendLocale)}</h2>
              <button onClick={() => setResetPassword(null)} className="p-2 hover:bg-t-hover rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-400">
                  {t('users.passwordResetHint', backendLocale)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('users.newPassword', backendLocale)}</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg font-mono text-lg tracking-wider">
                    {resetPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard(resetPassword)}
                    className="p-3 bg-t-accent-blue text-black rounded-lg hover:bg-t-accent-blue/90"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={() => setResetPassword(null)} className="px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90">
                {t('users.copied', backendLocale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Layers,
  Users,
  Key,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Zap,
  Home,
  Globe,
  ScrollText,
  Shield,
  ShieldAlert,
  Megaphone,
} from 'lucide-react'
import { useState } from 'react'
import { t } from '@/lib/i18n'

function useMenuItems() {
  const { backendLocale } = useLocaleStore()
  const { user } = useAuthStore()
  const role = user?.role || 'user'

  const allItems = [
    { key: '/admin', label: t('admin.dashboard', backendLocale), icon: LayoutDashboard, roles: ['superadmin', 'admin'] },
    { key: '/admin/articles', label: t('admin.articles', backendLocale), icon: FileText, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/media', label: t('admin.media', backendLocale), icon: FolderOpen, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/categories', label: t('admin.categories', backendLocale), icon: Layers, roles: ['superadmin', 'admin'] },
    { key: '/admin/users', label: t('admin.users', backendLocale), icon: Users, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/tokens', label: t('admin.tokens', backendLocale), icon: Key, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/stats', label: t('admin.stats', backendLocale), icon: BarChart3, roles: ['superadmin', 'admin'] },
    { key: '/admin/ai-debug', label: t('admin.aiDebug', backendLocale), icon: Zap, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/reviews', label: t('admin.reviews', backendLocale), icon: Shield, roles: ['superadmin', 'admin'] },
    { key: '/admin/sensitive-keywords', label: t('admin.sensitiveKeywords', backendLocale), icon: ShieldAlert, roles: ['superadmin', 'admin'] },
    { key: '/admin/ads', label: t('admin.ads', backendLocale), icon: Megaphone, roles: ['superadmin', 'admin'] },
    { key: '/admin/logs', label: t('admin.logs', backendLocale), icon: ScrollText, roles: ['superadmin', 'admin', 'user'] },
    { key: '/admin/settings', label: t('admin.settings', backendLocale), icon: Settings, roles: ['superadmin'] },
    { key: '/admin/statichtml', label: t('admin.staticHtml', backendLocale), icon: Globe, roles: ['superadmin', 'admin'] },
  ]

  return allItems.filter(item => item.roles.includes(role)).map(({ key, label, icon }) => ({ key, label, icon }))
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, token, logout } = useAuthStore()
  const { backendLocale, setBackendLocale } = useLocaleStore()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuItems = useMenuItems()

  useEffect(() => {
    if (!token || !user) {
      router.push('/auth/login?redirect=/admin')
    }
  }, [token, user, router])

  if (!token || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex bg-t-bg-secondary">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-t-border bg-t-bg-primary transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center px-2 border-b border-t-border">
          {sidebarOpen ? (
            <>
              <Link href="/admin" className="flex items-center gap-2 flex-1">
                <span className="text-xl font-bold gradient-text">TokenPress</span>
                <span className="text-sm text-t-text-secondary">Admin</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover rounded-lg"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover rounded-lg"
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = item.key === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.key)
            return (
              <Link
                key={item.key}
                href={item.key}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'text-t-accent-blue bg-t-accent-blue/10'
                    : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
                }`}
              >
                <Icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Info */}
        <div className="p-3 border-t border-t-border">
          <div className={`flex items-center gap-3 px-3 py-2 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-t-accent-blue to-t-accent-purple flex items-center justify-center text-white text-sm font-medium">
              {user.displayName?.[0] || user.username[0].toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-t-text-primary truncate">
                  {user.displayName || user.username}
                </p>
                <p className="text-xs text-t-text-secondary capitalize">{user.role}</p>
              </div>
            )}
          </div>
          {/* 返回前端 */}
          <Link
            href="/"
            className={`flex items-center gap-3 w-full mt-2 px-3 py-2 text-sm text-t-text-secondary hover:text-t-accent-blue hover:bg-t-accent-blue/10 rounded-lg transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <Home size={18} />
            {sidebarOpen && <span>{t('admin.backToSite', backendLocale)}</span>}
          </Link>
          {/* 后台语言切换 */}
          <button
            onClick={() => setBackendLocale(backendLocale === 'zh' ? 'en' : 'zh')}
            className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-t-text-secondary hover:text-t-accent-blue hover:bg-t-accent-blue/10 rounded-lg transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <Globe size={18} />
            {sidebarOpen && <span>{backendLocale === 'zh' ? 'English' : '中文'}</span>}
          </button>
          {/* 退出登录 */}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2 text-sm text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>{t('common.logout', backendLocale)}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-t-bg-primary border-r border-t-border">
            <div className="h-16 flex items-center justify-between px-4 border-b border-t-border">
              <Link href="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <span className="text-xl font-bold gradient-text">TokenPress</span>
                <span className="text-sm text-t-text-secondary">Admin</span>
              </Link>
              <button onClick={() => setMobileOpen(false)} className="p-2 text-t-text-secondary">
                <X size={20} />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = item.key === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.key)
                return (
                  <Link
                    key={item.key}
                    href={item.key}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg ${
                      isActive
                        ? 'text-t-accent-blue bg-t-accent-blue/10'
                        : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              <div className="pt-2 mt-2 border-t border-t-border">
                <Link
                  href="/"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-t-text-secondary hover:text-t-accent-blue hover:bg-t-accent-blue/10 rounded-lg"
                  onClick={() => setMobileOpen(false)}
                >
                  <Home size={20} />
                  <span>返回前端</span>
                </Link>
              </div>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-t-border bg-t-bg-primary">
          <button onClick={() => setMobileOpen(true)} className="p-2 text-t-text-secondary">
            <Menu size={24} />
          </button>
          <span className="font-bold gradient-text">TokenPress Admin</span>
          <div className="flex items-center gap-1">
            <Link href="/" className="p-2 text-t-text-secondary hover:text-t-accent-blue">
              <Home size={20} />
            </Link>
            <button onClick={handleLogout} className="p-2 text-t-text-secondary hover:text-red-400">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

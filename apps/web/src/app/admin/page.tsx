'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { FileText, Image, Users, TrendingUp, Clock } from 'lucide-react'

interface Stats {
  articles: number
  published: number
  works: number
  media: number
  users: number
  categories: number
}

interface RecentArticle {
  id: number
  title: string
  section: { id: number; name: string; slug: string; path: string }
  status: string
  createdAt: string
  author: string
}

export default function AdminDashboard() {
  const { backendLocale } = useLocaleStore()

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [articlesRes, aiWorksRes, usersRes, categoriesRes] = await Promise.all([
        api.get('/articles?limit=1'),
        api.get('/articles?section=ai_works&limit=1'),
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
      ])
      return {
        articles: articlesRes.pagination?.total || 0,
        published: articlesRes.pagination?.total || 0,
        works: aiWorksRes.pagination?.total || 0,
        media: 0,
        users: usersRes.data?.length || 0,
        categories: categoriesRes.data?.length || 0,
      }
    },
  })

  const { data: recentArticles } = useQuery<{ data: RecentArticle[] }>({
    queryKey: ['admin-recent-articles'],
    queryFn: async () => {
      const res = await api.get('/articles?limit=5')
      return res
    },
  })

  const statCards = [
    { label: t('admin.totalArticles', backendLocale), value: stats?.articles || 0, icon: FileText, color: 'from-blue-500 to-cyan-500' },
    { label: t('admin.published', backendLocale), value: stats?.published || 0, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
    { label: t('admin.aiWorks', backendLocale), value: stats?.works || 0, icon: Image, color: 'from-purple-500 to-violet-500' },
    { label: t('admin.registeredUsers', backendLocale), value: stats?.users || 0, icon: Users, color: 'from-orange-500 to-amber-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('admin.dashboard', backendLocale)}</h1>
        <p className="text-t-text-secondary mt-1">{t('admin.welcomeBack', backendLocale)}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-t-bg-primary border border-t-border rounded-xl p-5 hover:border-t-accent-blue/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-t-text-secondary">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center opacity-80`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Articles */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="px-6 py-4 border-b border-t-border">
          <h2 className="text-lg font-semibold">{t('admin.recentArticles', backendLocale)}</h2>
        </div>
        <div className="divide-y divide-t-border">
          {recentArticles?.data?.length ? (
            recentArticles.data.map((article) => (
              <div
                key={article.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-t-hover transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" dangerouslySetInnerHTML={{ __html: article.title }} />
                  <div className="flex items-center gap-4 mt-1 text-sm text-t-text-secondary">
                    <span className="capitalize">{article.section?.name || '-'}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(article.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    article.status === 'published'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {article.status === 'published' ? t('common.published', backendLocale) : t('common.draft', backendLocale)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-t-text-secondary">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p>{t('admin.noArticles', backendLocale)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Eye, Users, Heart, TrendingUp, Globe, Monitor } from 'lucide-react'

export default function StatsPage() {
  const { backendLocale } = useLocaleStore()

  const { data, isLoading } = useQuery({
    queryKey: ['view-stats-overview'],
    queryFn: () => api.getViewStatsOverview(),
  })

  const stats = data?.data

  const umamiShareUrl = process.env.NEXT_PUBLIC_UMAMI_SHARE_URL || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('viewStats.title', backendLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('viewStats.desc', backendLocale)}</p>
        </div>
        {umamiShareUrl && (
          <a
            href={umamiShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-t-accent-blue hover:underline"
          >
            Umami →
          </a>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-t-text-secondary">{t('common.loading', backendLocale)}</div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Eye size={20} className="text-t-accent-blue" />
                <span className="text-sm text-t-text-secondary">{t('viewStats.totalViews', backendLocale)}</span>
              </div>
              <p className="text-3xl font-bold text-t-text-primary">{stats?.totalViews || 0}</p>
            </div>
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users size={20} className="text-green-400" />
                <span className="text-sm text-t-text-secondary">{t('viewStats.uniqueVisitors', backendLocale)}</span>
              </div>
              <p className="text-3xl font-bold text-t-text-primary">{stats?.uniqueVisitors || 0}</p>
            </div>
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Heart size={20} className="text-red-400" />
                <span className="text-sm text-t-text-secondary">{t('viewStats.totalLikes', backendLocale)}</span>
              </div>
              <p className="text-3xl font-bold text-t-text-primary">{stats?.totalLikes || 0}</p>
            </div>
          </div>

          {/* Two columns: Top Articles + Daily Views */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Articles */}
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-t-accent-blue" />
                {t('viewStats.topArticles', backendLocale)}
              </h2>
              {stats?.topArticles?.length > 0 ? (
                <div className="space-y-3">
                  {stats.topArticles.map((item: any, i: number) => (
                    <div key={item.articleId} className="flex items-center justify-between py-2 border-b border-t-border last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm text-t-text-muted w-6">{i + 1}</span>
                        <span className="text-sm text-t-text-primary truncate">{item.title}</span>
                      </div>
                      <span className="text-sm text-t-accent-blue font-medium ml-4">{item.views}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-t-text-muted">{t('stats.noData', backendLocale)}</p>
              )}
            </div>

            {/* Daily Views */}
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-400" />
                {t('viewStats.dailyViews', backendLocale)}
              </h2>
              {stats?.dailyViews?.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stats.dailyViews.map((item: any) => (
                    <div key={item.date} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-t-text-secondary">{item.date}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-t-text-primary">{item.views} {t('viewStats.views', backendLocale)}</span>
                        <span className="text-sm text-t-text-muted">{item.uniqueVisitors} UV</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-t-text-muted">{t('stats.noData', backendLocale)}</p>
              )}
            </div>
          </div>

          {/* Two columns: Referers + User Agents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Referers */}
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Globe size={18} className="text-t-accent-blue" />
                {t('viewStats.topReferers', backendLocale)}
              </h2>
              {stats?.topReferers?.length > 0 ? (
                <div className="space-y-2">
                  {stats.topReferers.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-t-border last:border-0">
                      <span className="text-sm text-t-text-primary truncate max-w-[300px]">{item.referer || t('viewStats.direct', backendLocale)}</span>
                      <span className="text-sm text-t-accent-blue font-medium ml-4">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-t-text-muted">{t('stats.noData', backendLocale)}</p>
              )}
            </div>

            {/* Top User Agents */}
            <div className="bg-t-bg-primary border border-t-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Monitor size={18} className="text-t-accent-blue" />
                {t('viewStats.topDevices', backendLocale)}
              </h2>
              {stats?.topUserAgents?.length > 0 ? (
                <div className="space-y-2">
                  {stats.topUserAgents.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-t-border last:border-0">
                      <span className="text-sm text-t-text-primary truncate max-w-[300px]">{parseUserAgent(item.userAgent)}</span>
                      <span className="text-sm text-t-accent-blue font-medium ml-4">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-t-text-muted">{t('stats.noData', backendLocale)}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Linux/.test(ua)) return 'Linux'
  if (/curl|python|scrapy|httpie/i.test(ua)) return 'Bot/CLI'
  return ua.slice(0, 50)
}

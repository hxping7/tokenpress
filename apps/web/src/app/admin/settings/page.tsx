'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLocaleStore } from '@/stores'
import { t } from '@/lib/i18n'
import { Plus, Edit, Trash2, X, Check, Link2, Settings, Image, Menu, Columns2, Save, Upload, FolderOpen, Database, Download, RotateCcw, Clock, HardDrive, FileText, BarChart3 } from 'lucide-react'
import { useRef } from 'react'

interface FriendLink {
  id: number
  name: string
  url: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

interface NavItem {
  name: string
  url: string
}

interface FooterNavGroup {
  title: string
  links?: NavItem[]
  html?: string
}

interface HeroSlide {
  id: string
  imageUrl: string
  linkUrl: string
  linkTarget: '_blank' | '_self'
}

type TabType = 'basic' | 'ui' | 'logo' | 'hero' | 'nav' | 'links' | 'footer' | 'backup' | 'analytics' | 'security'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { token } = useAuthStore()
  const { backendLocale: adminLocale } = useLocaleStore()
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('basic')

  // ===== Site Settings =====
  const { data: settingsData } = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: () => api.get('/site-settings'),
  })

  // ===== 基本信息 =====
  const [siteName, setSiteName] = useState('TokenPress')
  const [siteDesc, setSiteDesc] = useState('Token 力量无限放大 | AI 赋能综合内容平台')

  // ===== Logo 设置 =====
  const [headerLogo, setHeaderLogo] = useState('')
  const [footerLogo, setFooterLogo] = useState('')

  // ===== 首页宣传页 =====
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([])
  const [heroMediaBrowserTarget, setHeroMediaBrowserTarget] = useState<number | null>(null)
  const [heroEffect, setHeroEffect] = useState('fade')
  const [heroSize, setHeroSize] = useState('default')
  const [heroCarouselUseArticles, setHeroCarouselUseArticles] = useState(false)
  const [heroCarouselArticleSource, setHeroCarouselArticleSource] = useState('latest')
  const [heroCarouselMaxItems, setHeroCarouselMaxItems] = useState(5)

  // ===== 媒体库 =====
  const [showMediaBrowser, setShowMediaBrowser] = useState(false)
  const [mediaBrowserTarget, setMediaBrowserTarget] = useState<'header' | 'footer' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<'header' | 'footer' | number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ===== 底部导航（分组式） =====
  const [footerNav, setFooterNav] = useState<FooterNavGroup[]>([
    {
      title: '技术内容',
      links: [
        { name: 'Token 计划', url: '/token-plan' },
        { name: 'AI 编程', url: '/ai-coding' },
        { name: 'AI 作品', url: '/ai-works' },
        { name: '博客', url: '/blog' },
      ],
    },
    {
      title: '关于我们',
      links: [
        { name: '关于项目', url: '/about' },
        { name: '联系方式', url: '/contact' },
      ],
    },
  ])
  const [footerNavColumns, setFooterNavColumns] = useState('4')

  // ===== 友链管理 =====
  const [showLinkEditor, setShowLinkEditor] = useState(false)
  const [editingLink, setEditingLink] = useState<FriendLink | null>(null)
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [linkIsActive, setLinkIsActive] = useState(true)
  const [friendLinksColumns, setFriendLinksColumns] = useState('2')

  // ===== Footer 版权设置 =====
  const [copyrightText, setCopyrightText] = useState(`© ${new Date().getFullYear()} TokenPress. All rights reserved.`)
  const [icpNumber, setIcpNumber] = useState('')
  const [icpUrl, setIcpUrl] = useState('')
  const [poweredBy, setPoweredBy] = useState('')

  // ===== 外观设置 =====
  const [defaultTheme, setDefaultTheme] = useState('night')
  const [frontendLocale, setFrontendLocale] = useState('zh')
  const [backendLocaleSetting, setBackendLocaleSetting] = useState('zh')

  // ===== 备份设置 =====
  const [autoBackup, setAutoBackup] = useState(false)
  const [backupInterval, setBackupInterval] = useState(24)
  const [retentionDays, setRetentionDays] = useState(30)
  const [includeUploads, setIncludeUploads] = useState(true)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  // ===== 备份数据 =====
  interface BackupRecord {
    id: number
    filename: string
    size: number
    type: 'manual' | 'auto'
    status: 'pending' | 'completed' | 'failed'
    createdAt: string
  }

  // ===== 统计分析 =====
  const [analyticsCode, setAnalyticsCode] = useState('')

  // ===== 安全设置 =====
  const [antiScrapingEnabled, setAntiScrapingEnabled] = useState(true)
  const [contentReviewEnabled, setContentReviewEnabled] = useState(false)
  const [reviewCloudProvider, setReviewCloudProvider] = useState('none')

  // Provider API keys
  const [tencentSecretId, setTencentSecretId] = useState('')
  const [tencentSecretKey, setTencentSecretKey] = useState('')
  const [tencentRegion, setTencentRegion] = useState('ap-guangzhou')
  const [aliyunAccessKeyId, setAliyunAccessKeyId] = useState('')
  const [aliyunAccessKeySecret, setAliyunAccessKeySecret] = useState('')
  const [aliyunRegion, setAliyunRegion] = useState('cn-shanghai')
  const [baiduAppId, setBaiduAppId] = useState('')
  const [baiduApiKey, setBaiduApiKey] = useState('')
  const [baiduSecretKey, setBaiduSecretKey] = useState('')
  const [builtinAiApiUrl, setBuiltinAiApiUrl] = useState('')
  const [builtinAiApiKey, setBuiltinAiApiKey] = useState('')

  const { data: backupSettingsData } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: () => api.get('/backup/settings', { headers: { Authorization: `Bearer ${token}` } }),
  })

  const { data: backupListData, refetch: refetchBackups } = useQuery({
    queryKey: ['backup-list'],
    queryFn: () => api.get('/backup', { headers: { Authorization: `Bearer ${token}` } }),
  })

  const backups = (backupListData?.data || []) as BackupRecord[]

  useEffect(() => {
    if (backupSettingsData?.data) {
      setAutoBackup(backupSettingsData.data.autoBackup ?? false)
      setBackupInterval(backupSettingsData.data.intervalHours ?? 24)
      setRetentionDays(backupSettingsData.data.retentionDays ?? 30)
      setIncludeUploads(backupSettingsData.data.includeUploads ?? true)
    }
  }, [backupSettingsData])

  const saveBackupSettingsMutation = useMutation({
    mutationFn: (data: any) =>
      api.put('/backup/settings', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const createBackupMutation = useMutation({
    mutationFn: () =>
      api.post('/backup', { includeUploads }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      setBackingUp(false)
      refetchBackups()
    },
    onError: () => {
      setBackingUp(false)
    },
  })

  const deleteBackupMutation = useMutation({
    mutationFn: (id: number) =>
      api.delete(`/backup/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => refetchBackups(),
  })

  const restoreFromServerMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/backup/${id}/restore`, {}, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      alert(t('backup.restoreSuccess', adminLocale))
    },
    onError: (error: any) => {
      const errorMsg = error?.message || error?.error || 'Restore failed'
      alert('还原失败: ' + errorMsg)
    },
  })

  const restoreBackupMutation = useMutation({
    mutationFn: async (file: File) => {
      const reader = new FileReader()
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1]
            console.log('Uploading restore file:', file.name, 'size:', file.size, 'base64 length:', base64.length)
            const result = await api.post('/backup/restore', {
              fileData: base64,
              filename: file.name,
            }, { headers: { Authorization: `Bearer ${token}` } })
            resolve(result)
          } catch (err: any) {
            console.error('Restore error:', err)
            reject(err)
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
    },
    onSuccess: () => {
      setRestoring(false)
      setRestoreFile(null)
      alert(t('backup.restoreSuccess', adminLocale))
    },
    onError: (error: any) => {
      setRestoring(false)
      console.error('Restore failed:', error)
      const errorMsg = error?.message || error?.error || 'Restore failed'
      alert('还原失败: ' + errorMsg)
    },
  })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleDownload = async (backup: BackupRecord) => {
    try {
      const response = await fetch(`/api/v1/backup/${backup.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        alert('Download failed: ' + response.statusText)
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
      alert('Download failed')
    }
  }

  const handleRestore = () => {
    if (!restoreFile) return
    if (!confirm(t('backup.confirmRestore', adminLocale))) return
    setRestoring(true)
    restoreBackupMutation.mutate(restoreFile)
  }

  // Load settings when data arrives
  useEffect(() => {
    if (settingsData?.data) {
      const s = settingsData.data
      setSiteName(s.site_name || 'TokenPress')
      setSiteDesc(s.site_description || 'Token 力量无限放大 | AI 赋能综合内容平台')
      setHeaderLogo(s.header_logo || '')
      setFooterLogo(s.footer_logo || '')
      setFriendLinksColumns(s.friend_links_columns || '2')
      setFooterNavColumns(s.footer_nav_columns || '4')
      setDefaultTheme(s.default_theme || 'night')
      setFrontendLocale(s.frontend_locale || 'zh')
      setBackendLocaleSetting(s.backend_locale || 'zh')
      if (s.footer_nav) {
        try {
          const parsed = JSON.parse(s.footer_nav)
          // Backward compatibility: old flat format -> convert to grouped
          if (Array.isArray(parsed) && parsed.length > 0 && !Array.isArray(parsed[0]?.links)) {
            setFooterNav([{ title: '导航', links: parsed }])
          } else {
            setFooterNav(parsed)
          }
        } catch {}
      }
      if (s.hero_slides) {
        try { setHeroSlides(JSON.parse(s.hero_slides)) } catch {}
      }
      if (s.hero_effect) {
        setHeroEffect(s.hero_effect)
      }
      if (s.hero_size) {
        setHeroSize(s.hero_size)
      }
      if (s.hero_carousel_use_articles !== undefined) {
        setHeroCarouselUseArticles(s.hero_carousel_use_articles === 'true')
      }
      if (s.hero_carousel_article_source) {
        setHeroCarouselArticleSource(s.hero_carousel_article_source)
      }
      if (s.hero_carousel_max_items) {
        setHeroCarouselMaxItems(parseInt(s.hero_carousel_max_items) || 5)
      }
      if (s.copyright_text !== undefined) setCopyrightText(s.copyright_text)
      setIcpNumber(s.icp_number || '')
      setIcpUrl(s.icp_url || 'https://beian.miit.gov.cn/')
      setPoweredBy(s.powered_by || '')
      setAnalyticsCode(s.analytics_code || '')
      setAntiScrapingEnabled(s.anti_scraping_enabled !== 'false')
      setContentReviewEnabled(s.content_review_enabled === 'true')
      setReviewCloudProvider(s.review_cloud_provider || 'none')
      setTencentSecretId(s.review_tencent_secret_id || '')
      setTencentSecretKey(s.review_tencent_secret_key || '')
      setTencentRegion(s.review_tencent_region || 'ap-guangzhou')
      setAliyunAccessKeyId(s.review_aliyun_access_key_id || '')
      setAliyunAccessKeySecret(s.review_aliyun_access_key_secret || '')
      setAliyunRegion(s.review_aliyun_region || 'cn-shanghai')
      setBaiduAppId(s.review_baidu_app_id || '')
      setBaiduApiKey(s.review_baidu_api_key || '')
      setBaiduSecretKey(s.review_baidu_secret_key || '')
      setBuiltinAiApiUrl(s.review_builtin_ai_api_url || '')
      setBuiltinAiApiKey(s.review_builtin_ai_api_key || '')
    }
  }, [settingsData])

  // ===== Friend Links =====
  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ['friend-links'],
    queryFn: () => api.get('/friend-links'),
  })

  // ===== Media Library =====
  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media-library'],
    queryFn: () => api.get('/media'),
  })

  const mediaFiles = (mediaData?.data || []) as any[]
  const imageFiles = mediaFiles.filter((m: any) => m.mimeType?.startsWith('image/'))

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('uploadMutation called, file:', file.name, 'uploadTarget:', uploadTarget)
      return api.uploadMedia(file, 'logo')
    },
    onSuccess: (data) => {
      console.log('uploadMutation onSuccess, url:', data.data.url, 'uploadTarget:', uploadTarget)
      queryClient.invalidateQueries({ queryKey: ['media-library'] })
      const url = data.data.url
      // 使用 uploadTarget 来确定上传目标
      if (uploadTarget === 'header') {
        setHeaderLogo(url)
      } else if (uploadTarget === 'footer') {
        setFooterLogo(url)
      } else if (typeof uploadTarget === 'number') {
        const newSlides = [...heroSlides]
        newSlides[uploadTarget] = { ...newSlides[uploadTarget], imageUrl: url }
        setHeroSlides(newSlides)
      }
      setUploadTarget(null)
    },
    onSettled: () => {
      setUploading(false)
    },
    onError: (error) => {
      console.log('uploadMutation onError:', error)
      setUploading(false)
      setUploadTarget(null)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    console.log('handleFileSelect called, file:', file?.name, 'uploadTarget:', uploadTarget)
    if (file) {
      setUploading(true)
      uploadMutation.mutate(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理上传按钮点击，设置目标后触发文件选择
  const handleUploadClick = (target: 'header' | 'footer' | number) => {
    console.log('handleUploadClick called with target:', target)
    setUploadTarget(target)
    setTimeout(() => {
      console.log('fileInputRef.current:', fileInputRef.current)
      fileInputRef.current?.click()
    }, 0)
  }

  const openMediaBrowser = (target: 'header' | 'footer') => {
    setMediaBrowserTarget(target)
    setShowMediaBrowser(true)
  }

  const selectFromMediaBrowser = (url: string) => {
    // 优先检查 hero 情况
    if (heroMediaBrowserTarget !== null) {
      const newSlides = [...heroSlides]
      newSlides[heroMediaBrowserTarget] = { ...newSlides[heroMediaBrowserTarget], imageUrl: url }
      setHeroSlides(newSlides)
    } else if (mediaBrowserTarget === 'header') {
      setHeaderLogo(url)
    } else if (mediaBrowserTarget === 'footer') {
      setFooterLogo(url)
    }
    setShowMediaBrowser(false)
    setMediaBrowserTarget(null)
    setHeroMediaBrowserTarget(null)
  }

  // ===== 首页宣传页处理函数 =====
  const addHeroSlide = () => {
    const newSlide: HeroSlide = {
      id: Date.now().toString(),
      imageUrl: '',
      linkUrl: '',
      linkTarget: '_self',
    }
    setHeroSlides([...heroSlides, newSlide])
  }

  const updateHeroSlide = (index: number, field: keyof HeroSlide, value: string) => {
    const newSlides = [...heroSlides]
    newSlides[index] = { ...newSlides[index], [field]: value }
    setHeroSlides(newSlides)
  }

  const removeHeroSlide = (index: number) => {
    setHeroSlides(heroSlides.filter((_, i) => i !== index))
  }

  const openHeroMediaBrowser = (index: number) => {
    setHeroMediaBrowserTarget(index)
    setMediaBrowserTarget('header') // 复用媒体库
    setShowMediaBrowser(true)
  }

  const links = (linksData?.data || []) as FriendLink[]

  const createLinkMutation = useMutation({
    mutationFn: (data: any) => api.post('/friend-links', data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-links'] })
      closeLinkEditor()
    },
  })

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/friend-links/${id}`, data, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-links'] })
      closeLinkEditor()
    },
  })

  const deleteLinkMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/friend-links/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friend-links'] }),
  })

  const saveSettingsMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.put('/site-settings', { settings: data }, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const openLinkEditor = (link?: FriendLink) => {
    if (link) {
      setEditingLink(link)
      setLinkName(link.name)
      setLinkUrl(link.url)
      setLinkDescription(link.description || '')
      setLinkIsActive(link.isActive)
    } else {
      setEditingLink(null)
      setLinkName('')
      setLinkUrl('')
      setLinkDescription('')
      setLinkIsActive(true)
    }
    setShowLinkEditor(true)
  }

  const closeLinkEditor = () => {
    setShowLinkEditor(false)
    setEditingLink(null)
  }

  const handleLinkSubmit = () => {
    const data: any = { name: linkName, url: linkUrl, isActive: linkIsActive }
    if (linkDescription) data.description = linkDescription
    if (editingLink) {
      updateLinkMutation.mutate({ id: editingLink.id, data })
    } else {
      createLinkMutation.mutate(data)
    }
  }

  const handleSaveAll = () => {
    saveSettingsMutation.mutate({
      site_name: siteName,
      site_description: siteDesc,
      header_logo: headerLogo,
      footer_logo: footerLogo,
      footer_nav: JSON.stringify(footerNav),
      footer_nav_columns: footerNavColumns,
      hero_slides: JSON.stringify(heroSlides),
      hero_effect: heroEffect,
      hero_size: heroSize,
      hero_carousel_use_articles: heroCarouselUseArticles.toString(),
      hero_carousel_article_source: heroCarouselArticleSource,
      hero_carousel_max_items: heroCarouselMaxItems.toString(),
      friend_links_columns: friendLinksColumns,
      default_theme: defaultTheme,
      frontend_locale: frontendLocale,
      backend_locale: backendLocaleSetting,
      copyright_text: copyrightText,
      icp_number: icpNumber,
      icp_url: icpUrl,
      powered_by: poweredBy,
      analytics_code: analyticsCode,
      anti_scraping_enabled: antiScrapingEnabled.toString(),
      content_review_enabled: contentReviewEnabled.toString(),
      review_cloud_provider: reviewCloudProvider,
      review_tencent_secret_id: tencentSecretId,
      review_tencent_secret_key: tencentSecretKey,
      review_tencent_region: tencentRegion,
      review_aliyun_access_key_id: aliyunAccessKeyId,
      review_aliyun_access_key_secret: aliyunAccessKeySecret,
      review_aliyun_region: aliyunRegion,
      review_baidu_app_id: baiduAppId,
      review_baidu_api_key: baiduApiKey,
      review_baidu_secret_key: baiduSecretKey,
      review_builtin_ai_api_url: builtinAiApiUrl,
      review_builtin_ai_api_key: builtinAiApiKey,
    })
  }

  // ===== 底部导航操作函数 =====
  const addNavGroup = () => {
    setFooterNav([...footerNav, { title: '', links: [] }])
  }

  const addHtmlGroup = () => {
    setFooterNav([...footerNav, { title: '', html: '' }])
  }

  const removeNavGroup = (groupIdx: number) => {
    setFooterNav(footerNav.filter((_, i) => i !== groupIdx))
  }

  const updateNavGroupTitle = (groupIdx: number, title: string) => {
    const newNav = [...footerNav]
    newNav[groupIdx] = { ...newNav[groupIdx], title }
    setFooterNav(newNav)
  }

  const addNavLink = (groupIdx: number) => {
    const newNav = [...footerNav]
    const existingLinks = newNav[groupIdx].links || []
    newNav[groupIdx] = { ...newNav[groupIdx], links: [...existingLinks, { name: '', url: '' }] }
    setFooterNav(newNav)
  }

  const updateNavLink = (groupIdx: number, linkIdx: number, field: 'name' | 'url', value: string) => {
    const newNav = [...footerNav]
    const groupLinks = [...(newNav[groupIdx].links || [])]
    groupLinks[linkIdx] = { ...groupLinks[linkIdx], [field]: value }
    newNav[groupIdx] = { ...newNav[groupIdx], links: groupLinks }
    setFooterNav(newNav)
  }

  const removeNavLink = (groupIdx: number, linkIdx: number) => {
    const newNav = [...footerNav]
    newNav[groupIdx] = { ...newNav[groupIdx], links: newNav[groupIdx].links?.filter((_, i) => i !== linkIdx) }
    setFooterNav(newNav)
  }

  const updateNavGroupHtml = (groupIdx: number, html: string) => {
    const newNav = [...footerNav]
    newNav[groupIdx] = { ...newNav[groupIdx], html }
    setFooterNav(newNav)
  }

  const toggleGroupType = (groupIdx: number) => {
    const newNav = [...footerNav]
    const group = newNav[groupIdx]
    if (group.html !== undefined) {
      newNav[groupIdx] = { title: group.title, links: [] }
    } else {
      newNav[groupIdx] = { title: group.title, html: '' }
    }
    setFooterNav(newNav)
  }

  return (
    <div className="space-y-6">
      {/* 隐藏的文件输入，用于上传功能 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title', adminLocale)}</h1>
          <p className="text-t-text-secondary mt-1">{t('settings.desc', adminLocale)}</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saveSettingsMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
        >
          <Save size={18} />
          {t('settings.saveAll', adminLocale)}
        </button>
      </div>

      {/* Tab 菜单 */}
      <div className="bg-t-bg-primary border border-t-border rounded-xl p-1 flex gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'basic'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.basicInfo', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('ui')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'ui'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.logo', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('logo')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'logo'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.logoSection', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('hero')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'hero'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.heroSection', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('nav')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'nav'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.footerNavSection', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'links'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.friendLinks', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('footer')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'footer'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.footerSection', adminLocale) || '版权信息'}
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'backup'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('backup.title', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'analytics'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.analyticsTab', adminLocale)}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 min-w-fit px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'security'
              ? 'bg-t-accent-blue text-black'
              : 'text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover'
          }`}
        >
          {t('settings.securityTab', adminLocale)}
        </button>
      </div>

      {/* 基本信息 */}
      {activeTab === 'basic' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="px-6 py-4 border-b border-t-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Settings size={18} className="text-t-accent-blue" />
            {t('settings.basicInfo', adminLocale)}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.siteName', adminLocale)}</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full max-w-md px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.siteDesc', adminLocale)}</label>
            <textarea
              value={siteDesc}
              onChange={(e) => setSiteDesc(e.target.value)}
              rows={3}
              className="w-full max-w-md px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue resize-y"
            />
          </div>
        </div>
      </div>
      )}

      {/* UI设置 */}
      {activeTab === 'ui' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="px-6 py-4 border-b border-t-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Settings size={18} className="text-t-accent-blue" />
            {t('settings.logo', adminLocale)}
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.defaultTheme', adminLocale)}</label>
            <select
              value={defaultTheme}
              onChange={(e) => setDefaultTheme(e.target.value)}
              className="w-full max-w-xs px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
            >
              <option value="night">{t('settings.themeNight', adminLocale)}</option>
              <option value="cyber">{t('settings.themeCyber', adminLocale)}</option>
              <option value="lava">{t('settings.themeLava', adminLocale)}</option>
              <option value="light">{t('settings.themeLight', adminLocale)}</option>
              <option value="space">{t('settings.themeSpace', adminLocale)}</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.frontendLang', adminLocale)}</label>
              <select
                value={frontendLocale}
                onChange={(e) => setFrontendLocale(e.target.value)}
                className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
              >
                <option value="zh">{t('settings.langZh', adminLocale)}</option>
                <option value="en">{t('settings.langEn', adminLocale)}</option>
              </select>
              <p className="text-xs text-t-text-muted mt-1">{adminLocale === 'en' ? 'Controls frontend display language' : '控制前台界面显示语言'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.backendLang', adminLocale)}</label>
              <select
                value={backendLocaleSetting}
                onChange={(e) => setBackendLocaleSetting(e.target.value)}
                className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
              >
                <option value="zh">{t('settings.langZh', adminLocale)}</option>
                <option value="en">{t('settings.langEn', adminLocale)}</option>
              </select>
              <p className="text-xs text-t-text-muted mt-1">{adminLocale === 'en' ? 'Controls backend menu language only' : '仅控制后台菜单显示语言'}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Logo 设置 */}
      {activeTab === 'logo' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="px-6 py-4 border-b border-t-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Image size={18} className="text-t-accent-blue" />
            {t('settings.logoSection', adminLocale)}
          </h2>
        </div>
        <div className="p-6 space-y-6">
          {/* 头部 Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.headerLogoDesc', adminLocale)}</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={headerLogo}
                onChange={(e) => setHeaderLogo(e.target.value)}
                placeholder={t('settings.headerLogoPlaceholder', adminLocale)}
                className="flex-1 px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
              />
              <button
                type="button"
                onClick={() => openMediaBrowser('header')}
                className="flex items-center gap-2 px-4 py-2 bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
              >
                <FolderOpen size={18} />
                {t('settings.browse', adminLocale)}
              </button>
              <button
                type="button"
                onClick={() => handleUploadClick('header')}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Upload size={18} />
                {t('settings.upload', adminLocale)}
              </button>
            </div>
            {headerLogo && (
              <div className="mt-3 p-4 bg-t-bg-secondary rounded-lg inline-block">
                <img src={headerLogo} alt={t('settings.logoPreview', adminLocale)} className="h-10" />
              </div>
            )}
          </div>

          {/* 底部 Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('settings.footerLogoDesc', adminLocale)}</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={footerLogo}
                onChange={(e) => setFooterLogo(e.target.value)}
                placeholder={t('settings.footerLogoPlaceholder', adminLocale)}
                className="flex-1 px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
              />
              <button
                type="button"
                onClick={() => openMediaBrowser('footer')}
                className="flex items-center gap-2 px-4 py-2 bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover transition-colors"
              >
                <FolderOpen size={18} />
                {t('settings.browse', adminLocale)}
              </button>
              <button
                type="button"
                onClick={() => handleUploadClick('footer')}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Upload size={18} />
                {t('settings.upload', adminLocale)}
              </button>
            </div>
            {footerLogo && (
              <div className="mt-3 p-4 bg-t-bg-secondary rounded-lg inline-block">
                <img src={footerLogo} alt={t('settings.footerLogoPreview', adminLocale)} className="h-10" />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* 首页宣传页设置 */}
      {activeTab === 'hero' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Image size={18} className="text-t-accent-blue" />
            {t('settings.heroSection', adminLocale)}
          </h2>
          <button
            onClick={addHeroSlide}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
          >
            <Plus size={16} />
            {t('settings.addHeroSlide', adminLocale)}
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-t-text-secondary">{t('settings.heroSectionDesc', adminLocale)}</p>

          {/* 启用文章轮播图 */}
          <div className="flex items-center justify-between p-4 bg-t-bg-secondary rounded-lg">
            <div>
              <span className="text-sm font-medium text-t-text-secondary">{t('settings.heroCarouselUseArticles', adminLocale) || '启用文章轮播图'}</span>
              <p className="text-xs text-t-text-muted mt-1">{t('settings.heroCarouselUseArticlesDesc', adminLocale) || '使用文章封面图作为轮播图，而不是自定义图片'}</p>
            </div>
            <button
              type="button"
              onClick={() => setHeroCarouselUseArticles(!heroCarouselUseArticles)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                heroCarouselUseArticles ? 'bg-t-accent-blue' : 'bg-t-bg-tertiary'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  heroCarouselUseArticles ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 文章来源选择 - 只有启用了文章轮播图才显示 */}
          {heroCarouselUseArticles && (
            <div className="flex items-center gap-4 p-4 bg-t-bg-secondary rounded-lg">
              <span className="text-sm font-medium text-t-text-secondary">{t('settings.heroCarouselArticleSource', adminLocale) || '文章来源'}</span>
              <select
                value={heroCarouselArticleSource}
                onChange={(e) => setHeroCarouselArticleSource(e.target.value)}
                className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
              >
                <option value="latest">{t('settings.heroCarouselArticleSourceLatest', adminLocale) || '最新文章'}</option>
                <option value="hot">{t('settings.heroCarouselArticleSourceHot', adminLocale) || '热点文章'}</option>
              </select>
            </div>
          )}

          {/* 轮播数量设置 - 只有启用了文章轮播图才显示 */}
          {heroCarouselUseArticles && (
            <div className="flex items-center gap-4 p-4 bg-t-bg-secondary rounded-lg">
              <span className="text-sm font-medium text-t-text-secondary">{t('settings.heroCarouselMaxItems', adminLocale) || '轮播数量'}</span>
              <select
                value={heroCarouselMaxItems}
                onChange={(e) => setHeroCarouselMaxItems(parseInt(e.target.value))}
                className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* 轮播效果选择 */}
          <div className="flex items-center gap-4 p-4 bg-t-bg-secondary rounded-lg">
            <span className="text-sm font-medium text-t-text-secondary">{t('settings.heroEffect', adminLocale)}</span>
            <select
              value={heroEffect}
              onChange={(e) => setHeroEffect(e.target.value)}
              className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
            >
              <option value="fade">{t('settings.heroEffectFade', adminLocale)}</option>
              <option value="slide">{t('settings.heroEffectSlide', adminLocale)}</option>
              <option value="zoom">{t('settings.heroEffectZoom', adminLocale)}</option>
              <option value="flip">{t('settings.heroEffectFlip', adminLocale)}</option>
            </select>
          </div>

          {/* 轮播尺寸选择 */}
          <div className="flex items-center gap-4 p-4 bg-t-bg-secondary rounded-lg">
            <span className="text-sm font-medium text-t-text-secondary">{t('settings.heroSize', adminLocale)}</span>
            <select
              value={heroSize}
              onChange={(e) => setHeroSize(e.target.value)}
              className="px-4 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
            >
              <option value="default">{t('settings.heroSizeDefault', adminLocale)}</option>
              <option value="wide">{t('settings.heroSizeWide', adminLocale)}</option>
              <option value="fullscreen">{t('settings.heroSizeFullscreen', adminLocale)}</option>
            </select>
          </div>

          {heroSlides.length === 0 ? (
            <p className="text-t-text-muted text-center py-8">{t('settings.noHeroSlides', adminLocale)}</p>
          ) : (
            <div className="space-y-4">
              {heroSlides.map((slide, index) => (
                <div key={slide.id} className="p-4 bg-t-bg-secondary rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-t-text-secondary">{t('settings.slide', adminLocale)} {index + 1}</span>
                    <button
                      onClick={() => removeHeroSlide(index)}
                      className="p-1.5 text-t-text-secondary hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 图片 URL */}
                    <div>
                      <label className="block text-xs text-t-text-muted mb-1">{t('settings.heroImageUrl', adminLocale)}</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={slide.imageUrl}
                          onChange={(e) => updateHeroSlide(index, 'imageUrl', e.target.value)}
                          placeholder={t('settings.heroImageUrlPlaceholder', adminLocale)}
                          className="flex-1 px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                        />
                        <button
                          type="button"
                          onClick={() => openHeroMediaBrowser(index)}
                          className="flex items-center gap-1 px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg hover:bg-t-hover text-sm"
                        >
                          <FolderOpen size={16} />
                          {t('settings.browse', adminLocale)}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUploadClick(index)}
                          disabled={uploading}
                          className="flex items-center gap-1 px-3 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50 text-sm"
                        >
                          <Upload size={16} />
                        </button>
                      </div>
                      {slide.imageUrl && (
                        <div className="mt-2 p-2 bg-t-bg-primary rounded-lg inline-block max-w-[200px]">
                          <img src={slide.imageUrl} alt="Preview" className="max-h-16 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* 链接 URL */}
                    <div>
                      <label className="block text-xs text-t-text-muted mb-1">{t('settings.heroLinkUrl', adminLocale)}</label>
                      <input
                        type="url"
                        value={slide.linkUrl}
                        onChange={(e) => updateHeroSlide(index, 'linkUrl', e.target.value)}
                        placeholder={t('settings.heroLinkUrlPlaceholder', adminLocale)}
                        className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                      />
                    </div>
                  </div>

                  {/* 链接打开方式 */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={slide.linkTarget === '_blank'}
                        onChange={(e) => updateHeroSlide(index, 'linkTarget', e.target.checked ? '_blank' : '_self')}
                        className="w-4 h-4 rounded text-t-accent-blue"
                      />
                      <span className="text-sm text-t-text-secondary">{t('settings.heroOpenNewTab', adminLocale)}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 底部导航管理（分组式） */}
      {activeTab === 'nav' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <div className="flex items-center gap-2">
            <Menu size={18} className="text-t-accent-blue" />
            <h2 className="font-semibold">{t('settings.footerNavSection', adminLocale)}</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* 列数选择 */}
            <div className="flex items-center gap-2 text-sm text-t-text-secondary">
              <Columns2 size={16} />
              <select
                value={footerNavColumns}
                onChange={(e) => setFooterNavColumns(e.target.value)}
                className="px-2 py-1 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} {t('settings.columns', adminLocale)}</option>
                ))}
              </select>
            </div>
            <button
              onClick={addNavGroup}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
            >
              <Plus size={16} />
              {t('settings.addNavGroup', adminLocale) || '添加分组'}
            </button>
            <button
              onClick={addHtmlGroup}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-t-accent-green text-black font-medium rounded-lg hover:bg-t-accent-green/90"
            >
              <Plus size={16} />
              {t('settings.addHtmlGroup', adminLocale) || '添加HTML分组'}
            </button>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-t-text-secondary mb-4">
            {adminLocale === 'en'
              ? 'Organize footer navigation into vertical columns. Link groups show navigation links; HTML groups render custom HTML content (e.g. QR codes, contact info).'
              : '将底部导航按竖向分组排列。链接分组显示导航链接；HTML分组可自定义HTML内容（如二维码、联系方式等）。'}
          </p>

          {footerNav.length === 0 ? (
            <p className="text-t-text-muted text-center py-8">{t('settings.noNavGroups', adminLocale) || '暂无导航分组，点击上方按钮添加'}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {footerNav.map((group, gIdx) => (
                <div key={gIdx} className="bg-t-bg-secondary rounded-lg p-4 space-y-3">
                  {/* 分组标题行 */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${group.html !== undefined ? 'bg-t-accent-green/20 text-t-accent-green' : 'bg-t-accent-blue/20 text-t-accent-blue'}`}>
                      {group.html !== undefined ? 'HTML' : 'LINK'}
                    </span>
                    <input
                      type="text"
                      value={group.title}
                      onChange={(e) => updateNavGroupTitle(gIdx, e.target.value)}
                      placeholder={t('settings.navGroupTitlePlaceholder', adminLocale) || '分组标题，如：技术内容'}
                      className="flex-1 px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm font-medium focus:outline-none focus:border-t-accent-blue"
                    />
                    <button
                      onClick={() => toggleGroupType(gIdx)}
                      className="p-1.5 text-t-text-secondary hover:text-t-accent-blue shrink-0"
                      title={adminLocale === 'en' ? 'Toggle type' : '切换类型'}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => removeNavGroup(gIdx)}
                      className="p-1.5 text-t-text-secondary hover:text-red-400 shrink-0"
                      title={t('settings.deleteGroup', adminLocale) || '删除分组'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* HTML 内容分组 */}
                  {group.html !== undefined && (
                    <textarea
                      value={group.html}
                      onChange={(e) => updateNavGroupHtml(gIdx, e.target.value)}
                      placeholder={t('settings.htmlGroupPlaceholder', adminLocale) || '输入HTML内容，如二维码、联系方式等'}
                      rows={8}
                      className="w-full px-3 py-2 bg-t-bg-primary border border-t-border rounded-lg text-sm font-mono focus:outline-none focus:border-t-accent-green resize-y"
                    />
                  )}

                  {/* 链接分组 */}
                  {group.html === undefined && (
                    <>
                      <div className="space-y-2">
                        {(group.links || []).map((link, lIdx) => (
                          <div key={lIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={link.name}
                              onChange={(e) => updateNavLink(gIdx, lIdx, 'name', e.target.value)}
                              placeholder={t('settings.navNamePlaceholder', adminLocale)}
                              className="flex-1 px-3 py-1.5 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                            />
                            <input
                              type="text"
                              value={link.url}
                              onChange={(e) => updateNavLink(gIdx, lIdx, 'url', e.target.value)}
                              placeholder="/path or https://..."
                              className="flex-1 px-3 py-1.5 bg-t-bg-primary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                            />
                            <button
                              onClick={() => removeNavLink(gIdx, lIdx)}
                              className="p-1 text-t-text-secondary hover:text-red-400 shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => addNavLink(gIdx)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-t-text-muted border border-dashed border-t-border rounded-lg hover:text-t-text-primary hover:border-t-accent-blue transition-colors"
                      >
                        <Plus size={14} />
                        {t('settings.addNavLink', adminLocale) || '添加链接'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 友链管理 - 独立 Tab */}
      {activeTab === 'links' && (
      <div className="bg-t-bg-primary border border-t-border rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-t-accent-blue" />
            <h2 className="font-semibold">{t('settings.friendLinks', adminLocale)}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-t-text-secondary">
              <Columns2 size={16} />
              <select
                value={friendLinksColumns}
                onChange={(e) => setFriendLinksColumns(e.target.value)}
                className="px-2 py-1 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} {t('settings.linkRows', adminLocale) || '行'}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => openLinkEditor()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90"
            >
              <Plus size={16} />
              {t('settings.addLink', adminLocale)}
            </button>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-t-text-secondary mb-4">
            {adminLocale === 'en'
              ? 'Friend links are displayed horizontally below the footer navigation groups. Set the number of rows to control layout.'
              : '友情链接在底部导航分组下方水平展示，可设置显示行数。'}
          </p>

          {linksLoading ? (
            <p className="text-t-text-secondary text-center py-4">{t('common.loading', adminLocale)}</p>
          ) : links.length === 0 ? (
            <p className="text-t-text-muted text-center py-4">{t('settings.noLinks', adminLocale)}</p>
          ) : (
            <div className="bg-t-bg-secondary rounded-lg p-4 space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center gap-3 hover:bg-t-bg-primary rounded-lg px-3 py-2 transition-colors">
                  <Link2 size={14} className="text-t-text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-t-text-primary text-sm font-medium">{link.name}</span>
                      {link.description && (
                        <span className="text-xs text-t-text-muted">({link.description})</span>
                      )}
                    </div>
                    <span className="text-xs text-t-text-secondary block truncate">{link.url}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${link.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {link.isActive ? t('common.enabled', adminLocale) : t('common.disabled', adminLocale)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openLinkEditor(link)} className="p-1.5 text-t-text-secondary hover:text-t-text-primary hover:bg-t-hover rounded">
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm(t('settings.deleteConfirm', adminLocale))) deleteLinkMutation.mutate(link.id) }}
                      className="p-1.5 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Footer 版权信息 */}
      {activeTab === 'footer' && (
        <div className="space-y-6">
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-t-border">
              <FileText size={18} className="text-t-accent-blue" />
              <h2 className="font-semibold">{t('settings.footerSection', adminLocale)}</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* 版权文本 */}
              <div>
                <label className="block text-sm font-medium text-t-text-secondary mb-2">
                  {t('settings.footerCopyrightText', adminLocale)}
                </label>
                <input
                  type="text"
                  value={copyrightText}
                  onChange={(e) => setCopyrightText(e.target.value)}
                  placeholder={t('settings.footerCopyrightPlaceholder', adminLocale)}
                  className="w-full px-4 py-2.5 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30"
                />
                <p className="mt-1 text-xs text-t-text-muted">
                  {t('settings.footerCopyrightHint', adminLocale)}
                </p>
              </div>

              {/* 备案号 */}
              <div>
                <label className="block text-sm font-medium text-t-text-secondary mb-2">
                  {t('settings.footerIcpNumber', adminLocale)}
                </label>
                <input
                  type="text"
                  value={icpNumber}
                  onChange={(e) => setIcpNumber(e.target.value)}
                  placeholder={t('settings.footerIcpPlaceholder', adminLocale)}
                  className="w-full px-4 py-2.5 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30"
                />
                <p className="mt-1 text-xs text-t-text-muted">
                  {t('settings.footerIcpHint', adminLocale)}
                </p>
              </div>

              {/* 备案链接 */}
              <div>
                <label className="block text-sm font-medium text-t-text-secondary mb-2">
                  {t('settings.footerIcpUrl', adminLocale)}
                </label>
                <input
                  type="text"
                  value={icpUrl}
                  onChange={(e) => setIcpUrl(e.target.value)}
                  placeholder="https://beian.miit.gov.cn/"
                  className="w-full px-4 py-2.5 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30"
                />
              </div>

              {/* 技术栈/Powered by */}
              <div>
                <label className="block text-sm font-medium text-t-text-secondary mb-2">
                  {t('settings.poweredBy', adminLocale)}
                </label>
                <input
                  type="text"
                  value={poweredBy}
                  onChange={(e) => setPoweredBy(e.target.value)}
                  placeholder={t('settings.poweredByPlaceholder', adminLocale)}
                  className="w-full px-4 py-2.5 bg-t-bg-secondary border border-t-border rounded-lg text-sm text-t-text-primary placeholder:text-t-text-muted focus:outline-none focus:border-t-accent-blue/30"
                />
                <p className="mt-1 text-xs text-t-text-muted">
                  {t('settings.poweredByHint', adminLocale)}
                </p>
              </div>

              {/* 预览 */}
              <div>
                <label className="block text-sm font-medium text-t-text-secondary mb-2">
                  {t('settings.footerPreview', adminLocale)}
                </label>
                <div className="p-4 bg-t-bg-secondary rounded-lg border border-t-border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs text-t-text-muted">
                    <div className="flex flex-col items-center md:items-start gap-2">
                      <span>{copyrightText || `© ${new Date().getFullYear()} TokenPress. All rights reserved.`}</span>
                    </div>
                    <div className="flex justify-center">
                      {icpNumber && <span>{icpNumber}</span>}
                    </div>
                    <div className="flex justify-center md:justify-end">
                      {poweredBy && <span>{poweredBy}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 备份还原 */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* 自动备份设置 */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Clock size={18} className="text-t-accent-blue" />
                {t('backup.autoSettings', adminLocale)}
              </h2>
              <button
                onClick={() => saveBackupSettingsMutation.mutate({
                  autoBackup,
                  intervalHours: backupInterval,
                  retentionDays,
                  includeUploads,
                })}
                disabled={saveBackupSettingsMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Save size={18} />
                {t('backup.saveSettings', adminLocale)}
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  className="w-5 h-5 rounded text-t-accent-blue"
                />
                <span className="font-medium">{t('backup.enableAutoBackup', adminLocale)}</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-t-text-secondary mb-2">{t('backup.backupInterval', adminLocale)}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={backupInterval}
                      onChange={(e) => setBackupInterval(parseInt(e.target.value) || 24)}
                      className="w-24 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                    <span className="text-sm text-t-text-secondary">{t('backup.hours', adminLocale)}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-t-text-secondary mb-2">{t('backup.retentionDays', adminLocale)}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
                      className="w-24 px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue"
                    />
                    <span className="text-sm text-t-text-secondary">{t('backup.days', adminLocale)}</span>
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUploads}
                      onChange={(e) => setIncludeUploads(e.target.checked)}
                      className="w-4 h-4 rounded text-t-accent-blue"
                    />
                    <span className="text-sm">{t('backup.includeUploads', adminLocale)}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 手动操作 */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="px-6 py-4 border-b border-t-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Database size={18} className="text-t-accent-blue" />
                {t('backup.manualActions', adminLocale)}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setBackingUp(true); createBackupMutation.mutate() }}
                  disabled={backingUp}
                  className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
                >
                  <HardDrive size={18} />
                  {backingUp ? t('backup.backupInProgress', adminLocale) : t('backup.backupNow', adminLocale)}
                </button>
                <label className="flex items-center gap-2 px-4 py-2 bg-t-bg-secondary border border-t-border rounded-lg hover:bg-t-hover cursor-pointer">
                  <RotateCcw size={18} />
                  <span>{t('backup.restoreFromUpload', adminLocale)}</span>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {restoreFile && (
                  <button
                    onClick={handleRestore}
                    disabled={restoring}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {restoring ? t('backup.restoreInProgress', adminLocale) : `Restore: ${restoreFile.name}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 备份列表 */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="px-6 py-4 border-b border-t-border">
              <h2 className="font-semibold flex items-center gap-2">
                <HardDrive size={18} className="text-t-accent-blue" />
                {t('backup.backupList', adminLocale)}
              </h2>
            </div>
            <div className="p-6">
              {backups.length === 0 ? (
                <p className="text-t-text-muted text-center py-8">{t('backup.noBackups', adminLocale)}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-t-border">
                        <th className="text-left py-3 px-4 font-medium text-t-text-secondary">{t('backup.type', adminLocale)}</th>
                        <th className="text-left py-3 px-4 font-medium text-t-text-secondary">{t('backup.size', adminLocale)}</th>
                        <th className="text-left py-3 px-4 font-medium text-t-text-secondary">{t('backup.createdAt', adminLocale)}</th>
                        <th className="text-left py-3 px-4 font-medium text-t-text-secondary">{t('backup.status', adminLocale)}</th>
                        <th className="text-left py-3 px-4 font-medium text-t-text-secondary">{t('backup.actions', adminLocale)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup) => (
                        <tr key={backup.id} className="border-b border-t-border hover:bg-t-hover">
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${backup.type === 'manual' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                              {backup.type === 'manual' ? t('backup.typeManual', adminLocale) : t('backup.typeAuto', adminLocale)}
                            </span>
                          </td>
                          <td className="py-3 px-4">{formatSize(backup.size)}</td>
                          <td className="py-3 px-4">{new Date(backup.createdAt).toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${backup.status === 'completed' ? 'bg-green-500/20 text-green-400' : backup.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                              {backup.status === 'completed' ? t('backup.statusCompleted', adminLocale) : backup.status === 'pending' ? t('backup.statusPending', adminLocale) : t('backup.statusFailed', adminLocale)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDownload(backup)}
                                disabled={backup.status !== 'completed'}
                                className="p-1.5 text-t-text-secondary hover:text-t-accent-blue hover:bg-t-bg-secondary rounded disabled:opacity-50"
                                title={t('backup.download', adminLocale)}
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => { if (confirm(t('backup.confirmRestore', adminLocale))) restoreFromServerMutation.mutate(backup.id) }}
                                disabled={backup.status !== 'completed'}
                                className="p-1.5 text-t-text-secondary hover:text-green-400 hover:bg-green-500/10 rounded disabled:opacity-50"
                                title={t('backup.restoreFromServer', adminLocale) || 'Restore'}
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                onClick={() => { if (confirm(t('backup.confirmDelete', adminLocale))) deleteBackupMutation.mutate(backup.id) }}
                                className="p-1.5 text-t-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded"
                                title={t('common.delete', adminLocale)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 统计分析 */}
      {activeTab === 'analytics' && (
        <div className="bg-t-bg-primary border border-t-border rounded-xl">
          <div className="px-6 py-4 border-b border-t-border">
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart3 size={18} className="text-t-accent-blue" />
              {t('settings.analyticsTitle', adminLocale)}
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-t-text-secondary">
              {t('settings.analyticsDesc', adminLocale)}
            </p>

            {/* 快速模板 */}
            <div className="flex flex-wrap gap-2 p-4 bg-t-bg-secondary rounded-lg">
              <span className="text-sm text-t-text-secondary">{t('settings.analyticsQuickTemplates', adminLocale)}</span>
              <button
                onClick={() => setAnalyticsCode('<script defer src="http://YOUR_UMAMI_SERVER:PORT/collect" data-website-id="YOUR_WEBSITE_ID"></script>')}
                className="px-3 py-1 text-xs bg-t-bg-primary border border-t-border rounded-full hover:border-t-accent-blue transition-colors"
              >
                Umami
              </button>
              <button
                onClick={() => setAnalyticsCode('<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_MEASUREMENT_ID"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag("js", new Date());\n  gtag("config", "YOUR_MEASUREMENT_ID");\n</script>')}
                className="px-3 py-1 text-xs bg-t-bg-primary border border-t-border rounded-full hover:border-t-accent-blue transition-colors"
              >
                Google Analytics
              </button>
              <button
                onClick={() => setAnalyticsCode('<script>\nvar _hmt = _hmt || [];\n(function() {\n  var hm = document.createElement("script");\n  hm.src = "https://hm.baidu.com/hm.js?YOUR_HM_ID";\n  var s = document.getElementsByTagName("script")[0];\n  s.parentNode.insertBefore(hm, s);\n})();\n</script>')}
                className="px-3 py-1 text-xs bg-t-bg-primary border border-t-border rounded-full hover:border-t-accent-blue transition-colors"
              >
                百度统计
              </button>
              <button
                onClick={() => setAnalyticsCode('')}
                className="px-3 py-1 text-xs text-t-text-secondary hover:text-t-text-primary"
              >
                {t('common.clear', adminLocale) || '清空'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('settings.analyticsCodeLabel', adminLocale)}</label>
              <textarea
                value={analyticsCode}
                onChange={(e) => setAnalyticsCode(e.target.value)}
                rows={10}
                placeholder={t('settings.analyticsCodePlaceholder', adminLocale)}
                className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg font-mono text-sm focus:outline-none focus:border-t-accent-blue resize-y"
              />
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">{t('settings.analyticsTip', adminLocale)}</p>
            </div>
          </div>
        </div>
      )}

      {/* 安全设置 */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* 反爬虫防护 */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="px-6 py-4 border-b border-t-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings size={18} className="text-t-accent-blue" />
                {t('settings.securityAntiScraping', adminLocale)}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-t-text-secondary">
                {t('settings.securityAntiScrapingDesc', adminLocale)}
              </p>

              <div className="flex items-center justify-between p-4 bg-t-bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{t('settings.securityAntiScrapingEnabled', adminLocale)}</span>
                </div>
                <button
                  onClick={() => setAntiScrapingEnabled(!antiScrapingEnabled)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    antiScrapingEnabled ? 'bg-t-accent-blue' : 'bg-t-border'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      antiScrapingEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-400">
                  {adminLocale === 'en'
                    ? 'Note: Changes take effect immediately. Disabled means all User-Agent requests will be allowed (except explicitly blocked).'
                    : '注意：修改立即生效。关闭后除明确拦截的爬虫外所有 User-Agent 都将允许访问。'}
                </p>
              </div>
            </div>
          </div>

          {/* 内容审查 */}
          <div className="bg-t-bg-primary border border-t-border rounded-xl">
            <div className="px-6 py-4 border-b border-t-border">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings size={18} className="text-t-accent-blue" />
                {adminLocale === 'zh' ? '内容审查' : 'Content Review'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-t-text-secondary">
                {adminLocale === 'zh'
                  ? '启用后，发布内容需经过审查通过后才能公开显示。支持本地敏感词扫描和云服务商 AI 审核。'
                  : 'When enabled, published content must pass review before being publicly visible. Supports local keyword scanning and cloud AI review.'}
              </p>

              {/* 审核开关 */}
              <div className="flex items-center justify-between p-4 bg-t-bg-secondary rounded-lg">
                <div>
                  <span className="font-medium">{adminLocale === 'zh' ? '启用内容审查' : 'Enable Content Review'}</span>
                  <p className="text-xs text-t-text-secondary mt-1">
                    {adminLocale === 'zh'
                      ? '开启后，文章、广告、媒体等内容的发布需通过审查'
                      : 'When enabled, articles, ads, media etc. must pass review before publishing'}
                  </p>
                </div>
                <button
                  onClick={() => setContentReviewEnabled(!contentReviewEnabled)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    contentReviewEnabled ? 'bg-t-accent-blue' : 'bg-t-border'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      contentReviewEnabled ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* 审查模式选择 */}
              {contentReviewEnabled && (
                <div className="p-4 bg-t-bg-secondary rounded-lg space-y-3">
                  <div>
                    <span className="font-medium">{adminLocale === 'zh' ? '审查模式' : 'Review Mode'}</span>
                    <p className="text-xs text-t-text-secondary mt-1">
                      {adminLocale === 'zh'
                        ? '选择内容审查方式。本地敏感词始终生效，云服务商提供 AI 智能审核能力。'
                        : 'Choose review method. Local keywords always apply; cloud providers add AI-powered review.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {/* 本地敏感词 */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reviewCloudProvider === 'none'
                        ? 'border-t-accent-blue bg-t-accent-blue/10'
                        : 'border-t-border hover:border-t-accent-blue/50'
                    }`}>
                      <input
                        type="radio"
                        name="reviewCloudProvider"
                        value="none"
                        checked={reviewCloudProvider === 'none'}
                        onChange={() => setReviewCloudProvider('none')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{adminLocale === 'zh' ? '本地敏感词' : 'Local Keywords'}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">{adminLocale === 'zh' ? '默认' : 'Default'}</span>
                        </div>
                        <p className="text-xs text-t-text-secondary mt-0.5">
                          {adminLocale === 'zh'
                            ? '基于本地敏感词库扫描，支持手动添加关键词，毫秒级响应'
                            : 'Scan against local keyword database, supports manual additions, millisecond response'}
                        </p>
                      </div>
                    </label>

                    {/* 腾讯云 */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reviewCloudProvider === 'tencent'
                        ? 'border-t-accent-blue bg-t-accent-blue/10'
                        : 'border-t-border hover:border-t-accent-blue/50'
                    }`}>
                      <input
                        type="radio"
                        name="reviewCloudProvider"
                        value="tencent"
                        checked={reviewCloudProvider === 'tencent'}
                        onChange={() => setReviewCloudProvider('tencent')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{adminLocale === 'zh' ? '腾讯云内容安全' : 'Tencent Cloud CMS'}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">{adminLocale === 'zh' ? '推荐' : 'Recommended'}</span>
                        </div>
                        <p className="text-xs text-t-text-secondary mt-0.5">
                          {adminLocale === 'zh'
                            ? '腾讯云内容安全（CMS），支持文本+图片审核，需配置 API 密钥'
                            : 'Tencent Cloud Content Moderation, text+image review, requires API key configuration'}
                        </p>
                      </div>
                    </label>

                    {/* 阿里云 */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reviewCloudProvider === 'aliyun'
                        ? 'border-t-accent-blue bg-t-accent-blue/10'
                        : 'border-t-border hover:border-t-accent-blue/50'
                    }`}>
                      <input
                        type="radio"
                        name="reviewCloudProvider"
                        value="aliyun"
                        checked={reviewCloudProvider === 'aliyun'}
                        onChange={() => setReviewCloudProvider('aliyun')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{adminLocale === 'zh' ? '阿里云内容安全' : 'Alibaba Cloud Green'}</span>
                        </div>
                        <p className="text-xs text-t-text-secondary mt-0.5">
                          {adminLocale === 'zh'
                            ? '阿里云绿网内容安全，需配置 AccessKey'
                            : 'Alibaba Cloud Green moderation, requires AccessKey configuration'}
                        </p>
                      </div>
                    </label>

                    {/* 百度云 */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reviewCloudProvider === 'baidu'
                        ? 'border-t-accent-blue bg-t-accent-blue/10'
                        : 'border-t-border hover:border-t-accent-blue/50'
                    }`}>
                      <input
                        type="radio"
                        name="reviewCloudProvider"
                        value="baidu"
                        checked={reviewCloudProvider === 'baidu'}
                        onChange={() => setReviewCloudProvider('baidu')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{adminLocale === 'zh' ? '百度云内容审核' : 'Baidu AI Review'}</span>
                        </div>
                        <p className="text-xs text-t-text-secondary mt-0.5">
                          {adminLocale === 'zh'
                            ? '百度 AI 内容审核平台，需配置 API Key'
                            : 'Baidu AI Content Review Platform, requires API Key configuration'}
                        </p>
                      </div>
                    </label>

                    {/* 内置AI */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      reviewCloudProvider === 'built_in_ai'
                        ? 'border-t-accent-blue bg-t-accent-blue/10'
                        : 'border-t-border hover:border-t-accent-blue/50'
                    }`}>
                      <input
                        type="radio"
                        name="reviewCloudProvider"
                        value="built_in_ai"
                        checked={reviewCloudProvider === 'built_in_ai'}
                        onChange={() => setReviewCloudProvider('built_in_ai')}
                        className="w-4 h-4 text-t-accent-blue"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{adminLocale === 'zh' ? '内置 AI 巡检' : 'Built-in AI Patrol'}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">{adminLocale === 'zh' ? '预留' : 'Reserved'}</span>
                        </div>
                        <p className="text-xs text-t-text-secondary mt-0.5">
                          {adminLocale === 'zh'
                            ? '自研 AI 巡检引擎，对已发布内容周期性复查，发现违规自动下架'
                            : 'Built-in AI patrol engine, periodically re-checks published content, auto-takes down violations'}
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* 模式说明 */}
                  <div className="p-3 bg-t-bg-primary rounded-lg border border-t-border">
                    <p className="text-xs text-t-text-secondary">
                      {adminLocale === 'zh'
                        ? '💡 所有模式均包含本地敏感词扫描。云服务商模式在本地扫描通过后，额外调用 AI 接口进行文本和图片审核。敏感词可在「内容审核」页面管理。'
                        : '💡 All modes include local keyword scanning. Cloud provider modes additionally call AI APIs for text and image review after local scan passes. Keywords can be managed in the Content Review page.'}
                    </p>
                  </div>

                  {/* 腾讯云密钥配置 */}
                  {reviewCloudProvider === 'tencent' && (
                    <div className="p-4 bg-t-bg-primary rounded-lg border border-t-border space-y-3">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-400 rounded-full" />
                        {adminLocale === 'zh' ? '腾讯云 API 密钥' : 'Tencent Cloud API Keys'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">SecretId</label>
                          <input
                            type="password"
                            value={tencentSecretId}
                            onChange={(e) => setTencentSecretId(e.target.value)}
                            placeholder="AKIDxxxx..."
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">SecretKey</label>
                          <input
                            type="password"
                            value={tencentSecretKey}
                            onChange={(e) => setTencentSecretKey(e.target.value)}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-t-text-secondary mb-1">{adminLocale === 'zh' ? '区域' : 'Region'}</label>
                        <select
                          value={tencentRegion}
                          onChange={(e) => setTencentRegion(e.target.value)}
                          className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                        >
                          <option value="ap-guangzhou">ap-guangzhou (广州)</option>
                          <option value="ap-beijing">ap-beijing (北京)</option>
                          <option value="ap-shanghai">ap-shanghai (上海)</option>
                          <option value="ap-chengdu">ap-chengdu (成都)</option>
                          <option value="ap-singapore">ap-singapore (新加坡)</option>
                        </select>
                      </div>
                      <p className="text-xs text-t-text-secondary">
                        {adminLocale === 'zh'
                          ? '在腾讯云控制台 → 访问管理 → API 密钥管理中获取。需开通内容安全（CMS）服务。'
                          : 'Get from Tencent Cloud Console → Access Management → API Key Management. Content Moderation (CMS) service must be enabled.'}
                      </p>
                    </div>
                  )}

                  {/* 阿里云密钥配置 */}
                  {reviewCloudProvider === 'aliyun' && (
                    <div className="p-4 bg-t-bg-primary rounded-lg border border-t-border space-y-3">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-orange-400 rounded-full" />
                        {adminLocale === 'zh' ? '阿里云 AccessKey' : 'Alibaba Cloud AccessKey'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">AccessKey ID</label>
                          <input
                            type="password"
                            value={aliyunAccessKeyId}
                            onChange={(e) => setAliyunAccessKeyId(e.target.value)}
                            placeholder="LTAI5txxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">AccessKey Secret</label>
                          <input
                            type="password"
                            value={aliyunAccessKeySecret}
                            onChange={(e) => setAliyunAccessKeySecret(e.target.value)}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-t-text-secondary mb-1">{adminLocale === 'zh' ? '区域' : 'Region'}</label>
                        <select
                          value={aliyunRegion}
                          onChange={(e) => setAliyunRegion(e.target.value)}
                          className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                        >
                          <option value="cn-shanghai">cn-shanghai (上海)</option>
                          <option value="cn-beijing">cn-beijing (北京)</option>
                          <option value="cn-shenzhen">cn-shenzhen (深圳)</option>
                          <option value="cn-hangzhou">cn-hangzhou (杭州)</option>
                        </select>
                      </div>
                      <p className="text-xs text-t-text-secondary">
                        {adminLocale === 'zh'
                          ? '在阿里云控制台 → RAM用户 → AccessKey 管理中获取。需开通内容安全（绿网）服务，并授权 AliyunYundunGreenWebFullAccess 权限。'
                          : 'Get from Alibaba Cloud Console → RAM → AccessKey Management. Content Security (Green) service must be enabled with AliyunYundunGreenWebFullAccess permission.'}
                      </p>
                    </div>
                  )}

                  {/* 百度云密钥配置 */}
                  {reviewCloudProvider === 'baidu' && (
                    <div className="p-4 bg-t-bg-primary rounded-lg border border-t-border space-y-3">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full" />
                        {adminLocale === 'zh' ? '百度云 API 密钥' : 'Baidu Cloud API Keys'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">AppID</label>
                          <input
                            type="password"
                            value={baiduAppId}
                            onChange={(e) => setBaiduAppId(e.target.value)}
                            placeholder="12345678"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">API Key</label>
                          <input
                            type="password"
                            value={baiduApiKey}
                            onChange={(e) => setBaiduApiKey(e.target.value)}
                            placeholder="xxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">Secret Key</label>
                          <input
                            type="password"
                            value={baiduSecretKey}
                            onChange={(e) => setBaiduSecretKey(e.target.value)}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-t-text-secondary">
                        {adminLocale === 'zh'
                          ? '在百度智能云控制台 → 内容审核平台 → 应用列表中获取 API Key 和 Secret Key。需开通内容审核服务。'
                          : 'Get from Baidu AI Cloud Console → Content Review Platform → Application List. Content Review service must be enabled.'}
                      </p>
                    </div>
                  )}

                  {/* 内置AI配置 */}
                  {reviewCloudProvider === 'built_in_ai' && (
                    <div className="p-4 bg-t-bg-primary rounded-lg border border-t-border space-y-3">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-purple-400 rounded-full" />
                        {adminLocale === 'zh' ? '内置 AI 巡检配置' : 'Built-in AI Patrol Config'}
                        <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">{adminLocale === 'zh' ? '预留' : 'Reserved'}</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">{adminLocale === 'zh' ? 'API 地址' : 'API URL'}</label>
                          <input
                            type="text"
                            value={builtinAiApiUrl}
                            onChange={(e) => setBuiltinAiApiUrl(e.target.value)}
                            placeholder="http://localhost:8000/v1/moderate"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-t-text-secondary mb-1">API Key</label>
                          <input
                            type="password"
                            value={builtinAiApiKey}
                            onChange={(e) => setBuiltinAiApiKey(e.target.value)}
                            placeholder="sk-xxxxxxxxxxxxxxxx"
                            className="w-full px-3 py-2 bg-t-bg-secondary border border-t-border rounded-lg text-sm focus:outline-none focus:border-t-accent-blue"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-t-text-secondary">
                        {adminLocale === 'zh'
                          ? '自研 AI 巡检引擎的 API 接口地址和密钥。当前为预留功能，暂不可用。'
                          : 'API endpoint and key for the built-in AI patrol engine. This is a reserved feature, not yet available.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 友链编辑弹窗 */}
      {showLinkEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeLinkEditor} />
          <div className="relative w-full max-w-md bg-t-bg-primary border border-t-border rounded-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{editingLink ? t('settings.editLink', adminLocale) : t('settings.addLink', adminLocale)}</h2>
              <button onClick={closeLinkEditor} className="p-2 hover:bg-t-hover rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.linkName', adminLocale)}</label>
                <input type="text" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder={t('settings.linkNamePlaceholder', adminLocale)} className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.linkUrl', adminLocale)}</label>
                <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={t('settings.linkUrlPlaceholder', adminLocale)} className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.linkDesc', adminLocale)} <span className="text-t-text-secondary text-xs">{t('settings.linkDescHint', adminLocale)}</span></label>
                <input type="text" value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} placeholder={t('settings.linkDescPlaceholder', adminLocale)} className="w-full px-4 py-3 bg-t-bg-secondary border border-t-border rounded-lg focus:outline-none focus:border-t-accent-blue" />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={linkIsActive} onChange={(e) => setLinkIsActive(e.target.checked)} className="w-4 h-4 rounded text-t-accent-blue" />
                  <span className="text-sm">{t('common.enabled', adminLocale)}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button onClick={closeLinkEditor} className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary">{t('common.cancel', adminLocale)}</button>
              <button
                onClick={handleLinkSubmit}
                disabled={!linkName || !linkUrl || createLinkMutation.isPending || updateLinkMutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Check size={18} /> {t('common.save', adminLocale)}
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium animate-bounce">
          {t('settings.saved', adminLocale)}
        </div>
      )}

      {/* 媒体库浏览弹窗 */}
      {showMediaBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowMediaBrowser(false); setMediaBrowserTarget(null); setHeroMediaBrowserTarget(null) }} />
          <div className="relative w-full max-w-3xl max-h-[80vh] bg-t-bg-primary border border-t-border rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-t-border">
              <h2 className="text-lg font-semibold">{t('settings.mediaLibrary', adminLocale)}</h2>
              <button onClick={() => { setShowMediaBrowser(false); setMediaBrowserTarget(null); setHeroMediaBrowserTarget(null) }} className="p-2 hover:bg-t-hover rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {mediaLoading ? (
                <p className="text-t-text-secondary text-center py-8">{t('common.loading', adminLocale)}</p>
              ) : imageFiles.length === 0 ? (
                <p className="text-t-text-secondary text-center py-8">{t('settings.noMedia', adminLocale)}</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {imageFiles.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => selectFromMediaBrowser(item.url)}
                      className="relative aspect-square bg-t-bg-secondary rounded-lg overflow-hidden border-2 border-transparent hover:border-t-accent-blue transition-colors group"
                    >
                      <img src={item.url} alt={item.originalName} className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm">{t('settings.select', adminLocale)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center px-6 py-4 border-t border-t-border bg-t-bg-secondary">
              <button
                onClick={() => {
                  const target = heroMediaBrowserTarget !== null ? heroMediaBrowserTarget : (mediaBrowserTarget || 'header')
                  handleUploadClick(target as 'header' | 'footer' | number)
                }}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-t-accent-blue text-black font-medium rounded-lg hover:bg-t-accent-blue/90 disabled:opacity-50"
              >
                <Upload size={18} />
                {t('settings.uploadNew', adminLocale)}
              </button>
              <button
                onClick={() => { setShowMediaBrowser(false); setMediaBrowserTarget(null); setHeroMediaBrowserTarget(null) }}
                className="px-4 py-2 text-t-text-secondary hover:text-t-text-primary"
              >
                {t('common.cancel', adminLocale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
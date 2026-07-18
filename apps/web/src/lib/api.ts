// 统一 baseUrl 不带 /api/v1 前缀
// 客户端：使用 NEXT_PUBLIC_API_URL 或相对路径（走 nginx 代理）
const CLIENT_API_BASE = process.env.NEXT_PUBLIC_API_URL || ''
// 服务器端：使用 BACKEND_URL（Docker 内网直连后端）或默认地址
const SERVER_API_BASE = process.env.BACKEND_URL || 'http://localhost:4001'

function getApiBase(): string {
  if (typeof window === 'undefined') return SERVER_API_BASE
  return CLIENT_API_BASE
}

class ApiClient {
  private get baseUrl(): string { return getApiBase() }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // 确保 path 以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    
    // 构建完整URL，统一添加 /api/v1 前缀
    const url = `${this.baseUrl}/api/v1${normalizedPath}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(url, {
      ...options,
      headers,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new ApiError(res.status, body.error || body.message || 'Request failed')
    }

    return res.json()
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('token00-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed?.state?.token || null
      }
    } catch {}
    return null
  }

  // ===== Generic HTTP methods =====
  async get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  async post<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T = any>(path: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T = any>(path: string, options?: RequestInit & { data?: any }): Promise<T> {
    const { data, ...rest } = options || {}
    return this.request<T>(path, {
      ...rest,
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  // ===== Auth =====
  async login(username: string, password: string, captchaId?: string, captchaCode?: string) {
    return this.request<{ success: boolean; data: { token: string; refreshToken: string; user: any } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password, captchaId, captchaCode }) }
    )
  }

  async getMe() {
    return this.request<{ success: boolean; data: any }>('/auth/me')
  }

  async meChangePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/users/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  // ===== Articles =====
  async getArticles(params: { page?: number; limit?: number; section?: string; category?: string; search?: string; status?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.section) query.set('section', params.section)
    if (params.category) query.set('category', params.category)
    if (params.search) query.set('search', params.search)
    if (params.status) query.set('status', params.status)
    return this.request<{ success: boolean; data: any[]; pagination: any }>(
      `/articles?${query.toString()}`
    )
  }

  async getArticle(idOrSlug: string | number) {
    return this.request<{ success: boolean; data: any }>(`/articles/${idOrSlug}`)
  }

  // ===== Categories =====
  async getCategories(section?: string) {
    const q = section ? `?section=${encodeURIComponent(section)}` : ''
    return this.request<{ success: boolean; data: any[] }>(`/categories${q}`)
  }

  // ===== Friend Links =====
  async getFriendLinks() {
    return this.request<{ success: boolean; data: any[] }>('/friend-links').then((r) => r.data || [])
  }

  // ===== Admin Articles =====
  async getAdminArticle(id: number) {
    return this.request<{ success: boolean; data: any }>(`/admin/articles/${id}`)
  }

  async createArticle(data: any) {
    return this.request<{ success: boolean; data: any }>('/admin/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateArticle(id: number, data: any) {
    return this.request<{ success: boolean; data: any }>(`/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteArticle(id: number) {
    return this.request<{ success: boolean; message: string }>(`/admin/articles/${id}`, {
      method: 'DELETE',
    })
  }

  async batchArticles(
    action: 'delete' | 'updateStatus' | 'updateCategory' | 'updateSection' | 'updatePin',
    ids: number[],
    data?: { status?: string; categoryId?: number | null; sectionId?: number | null; pinnedScope?: string }
  ) {
    return this.request<{ success: boolean; message: string; data?: any }>('/admin/articles/batch', {
      method: 'POST',
      body: JSON.stringify({ action, ids, data }),
    })
  }

  // ===== Tokens =====
  async createToken(data: { name: string; permissions: string[] }) {
    return this.request<{ success: boolean; data: any }>('/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getTokens() {
    return this.request<{ success: boolean; data: any[] }>('/tokens')
  }

  async deleteToken(id: number) {
    return this.request<{ success: boolean; message: string }>(`/tokens/${id}`, {
      method: 'DELETE',
    })
  }

  // ===== Users (admin) =====
  async getUsers() {
    return this.request<{ success: boolean; data: any[] }>('/users')
  }

  async createUser(data: { username: string; password: string; displayName?: string; role?: string }) {
    return this.request<{ success: boolean; data: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: number, data: any) {
    return this.request<{ success: boolean; data: any }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // ===== Works =====
  async getWorks(params: { page?: number; limit?: number; search?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    return this.request<{ success: boolean; data: any[]; pagination: any }>(
      `/works?${query.toString()}`
    )
  }

  async createWork(data: any) {
    return this.request<{ success: boolean; data: any }>('/works', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateWork(id: number, data: any) {
    return this.request<{ success: boolean; data: any }>(`/works/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteWork(id: number) {
    return this.request<{ success: boolean; message: string }>(`/works/${id}`, {
      method: 'DELETE',
    })
  }

  // ===== Media =====
  async getMedia(params: { page?: number; limit?: number; search?: string; type?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.search) query.set('search', params.search)
    if (params.type) query.set('type', params.type)
    return this.request<{ success: boolean; data: any[]; pagination: any }>(
      `/media?${query.toString()}`
    )
  }

  async uploadMedia(file: File, section?: string): Promise<{ success: boolean; data: any }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]
          const result = await this.request<{ success: boolean; data: any }>('/media', {
            method: 'POST',
            body: JSON.stringify({
              file: base64,
              filename: file.name,
              mimeType: file.type,
              section,
            }),
          })
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async deleteMedia(id: number) {
    return this.request<{ success: boolean; message: string }>(`/media/${id}`, {
      method: 'DELETE',
    })
  }

  // ===== Categories =====
  async createCategory(data: { name: string; section: string; description?: string }) {
    return this.request<{ success: boolean; data: any }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: number, data: any) {
    return this.request<{ success: boolean; data: any }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: number) {
    return this.request<{ success: boolean; message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    })
  }

  // ===== Token Toggle =====
  async toggleToken(id: number, isActive: boolean) {
    return this.request<{ success: boolean; data: any }>(`/tokens/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    })
  }

  // ===== Stats =====
  async getStats() {
    return this.request<{ success: boolean; data: any }>('/stats')
  }

  // ===== Article Interactions =====
  async toggleArticleLike(articleId: number) {
    return this.request<{ success: boolean; data: { liked: boolean; likeCount: number } }>(
      `/interactions/${articleId}/like`,
      { method: 'POST' }
    )
  }

  async getArticleLikeStatus(articleId: number) {
    return this.request<{ success: boolean; data: { liked: boolean; likeCount: number } }>(
      `/interactions/${articleId}/like`
    )
  }

  async trackArticleView(articleId: number) {
    return this.request<{ success: boolean; data: { viewCount: number } }>(
      `/interactions/${articleId}/view`,
      { method: 'POST' }
    )
  }

  async getArticleViewCount(articleId: number) {
    return this.request<{ success: boolean; data: { viewCount: number; uniqueViewCount: number } }>(
      `/interactions/${articleId}/view`
    )
  }

  async getViewStatsOverview() {
    return this.request<{ success: boolean; data: any }>('/interactions/stats/overview')
  }

  // ===== Style Packs =====
  // 公开：当前激活包配置（供 SSR 渲染）
  async getActiveStyle() {
    return this.request<{ success: boolean; data: any }>('/styles/active')
  }

  // 列出全部包（需 styles:read，或管理员 JWT）
  async getStyles() {
    return this.request<{ success: boolean; data: any[] }>('/styles')
  }

  // 取某包完整配置（需 styles:read，或管理员 JWT）
  async getStyle(id: string) {
    return this.request<{ success: boolean; data: any }>(`/styles/${id}`)
  }

  // 新建/上传模板包（需 styles:write）
  async createStyle(data: {
    id: string
    manifest: any
    theme?: string
    layouts?: any
    header?: any
    footer?: any
  }) {
    return this.request<{ success: boolean; data: any }>('/styles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // 局部更新模板包（需 styles:write）
  async updateStyle(id: string, data: {
    manifest?: any
    theme?: string
    layouts?: any
    header?: any
    footer?: any
  }) {
    return this.request<{ success: boolean; data: any }>(`/styles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // 删除自定义包（需 styles:write）
  async deleteStyle(id: string) {
    return this.request<{ success: boolean; message: string }>(`/styles/${id}`, {
      method: 'DELETE',
    })
  }

  // 恢复内置模板包到出厂默认（需 styles:write）：从镜像内置源重新拷贝覆盖个人修改
  async restoreStyle(id: string) {
    return this.request<{ success: boolean; data: any }>(`/styles/${id}/restore`, {
      method: 'POST',
    })
  }

  // 激活某模板包（复用 site-settings 的 settings:write）
  async setActiveStyle(id: string) {
    return this.request<{ success: boolean; data: any }>('/site-settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { active_style: id } }),
    })
  }
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const api = new ApiClient()

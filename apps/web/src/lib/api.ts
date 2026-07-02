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
    
    // 构建完整URL，避免重复 /api/v1 前缀
    let url: string
    if (this.baseUrl && this.baseUrl !== '') {
      // 如果 baseUrl 不为空，直接使用（假设它已经包含了必要的前缀）
      url = `${this.baseUrl}${normalizedPath}`
    } else {
      // 如果 baseUrl 为空，添加 /api/v1 前缀
      url = `/api/v1${normalizedPath}`
    }

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

  async delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' })
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
  async getArticles(params: { page?: number; limit?: number; section?: string; category?: string; search?: string } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.section) query.set('section', params.section)
    if (params.category) query.set('category', params.category)
    if (params.search) query.set('search', params.search)
    return this.request<{ success: boolean; data: any[]; pagination: any }>(
      `/articles?${query.toString()}`
    )
  }

  async getArticle(idOrSlug: string | number) {
    return this.request<{ success: boolean; data: any }>(`/articles/${idOrSlug}`)
  }

  // ===== Categories =====
  async getCategories() {
    return this.request<{ success: boolean; data: any[] }>('/categories')
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

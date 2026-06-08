import type { CloudProvider, ProviderConfig, ProviderResult } from '../types.js'
import logger from '../../../utils/logger.js'

let _config: ProviderConfig | null = null
let _provider: CloudProvider | null = null

export function initProviders(config: ProviderConfig) {
  _config = config
  _provider = null
}

export function getProvider(): CloudProvider | null {
  if (!_config) return null
  if (_config.provider === 'none') return null

  if (!_provider) {
    switch (_config.provider) {
      case 'tencent':
        _provider = createTencentProvider(_config)
        break
      case 'aliyun':
        _provider = createAliyunProvider(_config)
        break
      case 'baidu':
        _provider = createBaiduProvider(_config)
        break
      case 'built_in_ai':
        _provider = createBuiltInAiProvider(_config)
        break
    }
  }
  return _provider
}

export function getConfig(): ProviderConfig | null {
  return _config
}

export function loadProviderConfigFromEnv(): ProviderConfig {
  return {
    provider: (process.env.REVIEW_CLOUD_PROVIDER as any) || 'none',
    passThreshold: parseFloat(process.env.REVIEW_PASS_THRESHOLD || '60'),
    rejectThreshold: parseFloat(process.env.REVIEW_REJECT_THRESHOLD || '90'),
    tencent: {
      secretId: process.env.TENCENT_SECRET_ID || '',
      secretKey: process.env.TENCENT_SECRET_KEY || '',
      region: process.env.TENCENT_REGION || 'ap-guangzhou',
    },
    aliyun: {
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
      region: process.env.ALIYUN_REGION || 'cn-shanghai',
    },
    baidu: {
      appId: process.env.BAIDU_APP_ID || '',
      apiKey: process.env.BAIDU_API_KEY || '',
      secretKey: process.env.BAIDU_SECRET_KEY || '',
    },
  }
}

export async function loadProviderConfigFromDB(): Promise<ProviderConfig | null> {
  try {
    const { db } = await import('../../../db/index.js')
    const { siteSettings } = await import('../../../db/schema.js')
    const { eq } = await import('drizzle-orm')

    const allSettings = await db.select().from(siteSettings).all()
    const s: Record<string, string> = {}
    allSettings.forEach(row => { s[row.key] = row.value || '' })

    const provider = s.review_cloud_provider || 'none'
    if (provider === 'none') return null

    const envConfig = loadProviderConfigFromEnv()
    envConfig.provider = provider as ProviderConfig['provider']

    // DB values override env vars for each provider's credentials
    if (s.review_tencent_secret_id) envConfig.tencent.secretId = s.review_tencent_secret_id
    if (s.review_tencent_secret_key) envConfig.tencent.secretKey = s.review_tencent_secret_key
    if (s.review_tencent_region) envConfig.tencent.region = s.review_tencent_region

    if (s.review_aliyun_access_key_id) envConfig.aliyun.accessKeyId = s.review_aliyun_access_key_id
    if (s.review_aliyun_access_key_secret) envConfig.aliyun.accessKeySecret = s.review_aliyun_access_key_secret
    if (s.review_aliyun_region) envConfig.aliyun.region = s.review_aliyun_region

    if (s.review_baidu_app_id) envConfig.baidu.appId = s.review_baidu_app_id
    if (s.review_baidu_api_key) envConfig.baidu.apiKey = s.review_baidu_api_key
    if (s.review_baidu_secret_key) envConfig.baidu.secretKey = s.review_baidu_secret_key

    // Built-in AI
    if (s.review_builtin_ai_api_url || s.review_builtin_ai_api_key) {
      ;(envConfig as any).builtInAi = {
        apiUrl: s.review_builtin_ai_api_url || '',
        apiKey: s.review_builtin_ai_api_key || '',
      }
    }

    return envConfig
  } catch {
    return null
  }
}

export async function reloadProviderFromDB(): Promise<void> {
  const dbConfig = await loadProviderConfigFromDB()
  if (dbConfig) {
    initProviders(dbConfig)
    logger.info({ provider: dbConfig.provider }, 'Content review provider reloaded from DB')
  } else {
    const envConfig = loadProviderConfigFromEnv()
    initProviders(envConfig)
    logger.info({ provider: envConfig.provider }, 'Content review provider loaded from env')
  }
}

function createTencentProvider(config: ProviderConfig): CloudProvider {
  return {
    name: 'tencent',
    async reviewText(text: string): Promise<ProviderResult> {
      try {
        const tencent = await import('./tencent.js')
        return await tencent.reviewText(text, config)
      } catch (err: any) {
        logger.error({ err }, 'Tencent text review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      try {
        const tencent = await import('./tencent.js')
        return await tencent.reviewImage(image, config)
      } catch (err: any) {
        logger.error({ err }, 'Tencent image review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async healthCheck(): Promise<boolean> {
      try {
        const tencent = await import('./tencent.js')
        return await tencent.healthCheck(config)
      } catch {
        return false
      }
    },
  }
}

function createAliyunProvider(config: ProviderConfig): CloudProvider {
  return {
    name: 'aliyun',
    async reviewText(text: string): Promise<ProviderResult> {
      try {
        const aliyun = await import('./aliyun.js')
        return await aliyun.reviewText(text, config)
      } catch (err: any) {
        logger.error({ err }, 'Aliyun text review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      try {
        const aliyun = await import('./aliyun.js')
        return await aliyun.reviewImage(image, config)
      } catch (err: any) {
        logger.error({ err }, 'Aliyun image review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async healthCheck(): Promise<boolean> {
      try {
        const aliyun = await import('./aliyun.js')
        return await aliyun.healthCheck(config)
      } catch {
        return false
      }
    },
  }
}

function createBaiduProvider(config: ProviderConfig): CloudProvider {
  return {
    name: 'baidu',
    async reviewText(text: string): Promise<ProviderResult> {
      try {
        const baidu = await import('./baidu.js')
        return await baidu.reviewText(text, config)
      } catch (err: any) {
        logger.error({ err }, 'Baidu text review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      try {
        const baidu = await import('./baidu.js')
        return await baidu.reviewImage(image, config)
      } catch (err: any) {
        logger.error({ err }, 'Baidu image review failed')
        return { verdict: 'error', label: 'error', score: 0, detail: { error: err.message } }
      }
    },
    async healthCheck(): Promise<boolean> {
      try {
        const baidu = await import('./baidu.js')
        return await baidu.healthCheck(config)
      } catch {
        return false
      }
    },
  }
}

function createBuiltInAiProvider(config: ProviderConfig): CloudProvider {
  return {
    name: 'built_in_ai',
    async reviewText(text: string): Promise<ProviderResult> {
      logger.warn('Built-in AI text review: reserved, not implemented, returning error')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: 'Built-in AI provider not implemented' } }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      logger.warn('Built-in AI image review: reserved, not implemented, returning error')
      return { verdict: 'error', label: 'error', score: 0, detail: { error: 'Built-in AI provider not implemented' } }
    },
    async healthCheck(): Promise<boolean> {
      return false
    },
  }
}

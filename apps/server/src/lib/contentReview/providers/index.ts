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
      logger.info('Aliyun text review: not implemented, returning pass')
      return { verdict: 'pass', label: 'normal', score: 0, detail: null }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      logger.info('Aliyun image review: not implemented, returning pass')
      return { verdict: 'pass', label: 'normal', score: 0, detail: null }
    },
    async healthCheck(): Promise<boolean> {
      return false
    },
  }
}

function createBaiduProvider(config: ProviderConfig): CloudProvider {
  return {
    name: 'baidu',
    async reviewText(text: string): Promise<ProviderResult> {
      logger.info('Baidu text review: not implemented, returning pass')
      return { verdict: 'pass', label: 'normal', score: 0, detail: null }
    },
    async reviewImage(image: Buffer | string): Promise<ProviderResult> {
      logger.info('Baidu image review: not implemented, returning pass')
      return { verdict: 'pass', label: 'normal', score: 0, detail: null }
    },
    async healthCheck(): Promise<boolean> {
      return false
    },
  }
}

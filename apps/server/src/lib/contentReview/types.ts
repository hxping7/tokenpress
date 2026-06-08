export type TargetType = 'article' | 'media' | 'ad' | 'friend_link' | 'site_setting'

export type Verdict = 'pass' | 'reject' | 'pending' | 'error'

export type ScanStatus = 'pending' | 'pass' | 'fail'

export type ManualStatus = 'pending' | 'approved' | 'rejected'

export interface ReviewInput {
  targetType: TargetType
  targetId: number
  text?: string
  imageUrls?: string[]
}

export interface ScanResult {
  matched: boolean
  keywords: string[]
  severity: 'low' | 'medium' | 'high' | null
  action: 'block' | 'review' | null
}

export interface ProviderResult {
  verdict: Verdict
  label: string
  score: number
  detail: Record<string, any> | null
}

export interface CloudProvider {
  name: string
  reviewText(text: string): Promise<ProviderResult>
  reviewImage(image: Buffer | string): Promise<ProviderResult>
  healthCheck(): Promise<boolean>
}

export interface ProviderConfig {
  provider: 'tencent' | 'aliyun' | 'baidu' | 'built_in_ai' | 'none'
  passThreshold: number
  rejectThreshold: number
  tencent: { secretId: string; secretKey: string; region: string }
  aliyun: { accessKeyId: string; accessKeySecret: string; region: string }
  baidu: { appId: string; apiKey: string; secretKey: string }
}

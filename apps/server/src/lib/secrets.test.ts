// SEC-05：密钥解析不得再静默回退到硬编码默认值。
// 生产环境缺失或强度不足必须终止启动，非生产环境使用一次性随机密钥。
import { describe, it, expect, afterEach } from 'vitest'
import { getJwtSecret, getRevalidateSecret, resetSecretCache } from './secrets.js'

const STRONG = 'a'.repeat(64)

function useEnv(nodeEnv: string, jwt?: string) {
  process.env.NODE_ENV = nodeEnv
  if (jwt === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = jwt
  resetSecretCache()
}

afterEach(() => {
  process.env.NODE_ENV = 'test'
  delete process.env.JWT_SECRET
  delete process.env.REVALIDATE_SECRET
  resetSecretCache()
})

describe('secrets：生产环境强校验', () => {
  it('缺失 JWT_SECRET 时拒绝启动', () => {
    useEnv('production')
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/)
  })

  it('密钥长度不足 32 位时拒绝启动', () => {
    useEnv('production', 'short-secret')
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/)
  })

  it('强随机密钥应直接使用', () => {
    useEnv('production', STRONG)
    expect(getJwtSecret()).toBe(STRONG)
  })

  it('REVALIDATE_SECRET 同样纳入强校验', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.REVALIDATE_SECRET
    resetSecretCache()
    expect(() => getRevalidateSecret()).toThrow(/REVALIDATE_SECRET/)
  })
})

describe('secrets：非生产环境降级', () => {
  it('缺失时生成一次性随机开发密钥，且不回退硬编码值', () => {
    useEnv('test')
    const first = getJwtSecret()
    expect(first).toHaveLength(64)
    expect(first).not.toBe('token00-dev-secret-change-in-production')

    resetSecretCache()
    expect(getJwtSecret()).not.toBe(first) // 每次解析都重新生成 → 重启即失效
  })

  it('弱密钥不阻断启动，但保留原值以便本地复用', () => {
    useEnv('development', 'dev-weak-but-fine')
    expect(getJwtSecret()).toBe('dev-weak-but-fine')
  })
})

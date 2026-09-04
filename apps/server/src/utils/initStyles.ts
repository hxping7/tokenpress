import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STYLES_DIR } from './paths.js'
import logger from './logger.js'

// 镜像内置模板包来源目录（Dockerfile 在构建期 COPY 进镜像）
export const BUILTIN_SOURCE = path.resolve(process.cwd(), 'styles-builtin')

/**
 * 首次启动将内置三包（blog/enterprise/design）拷贝进 STYLES_DIR（持久卷）。
 * 仅当目标包目录不存在时才拷贝，避免覆盖用户自定义包或已初始化的内置包。
 */
export async function initBuiltinStyles(): Promise<void> {
  try {
    if (!fs.existsSync(BUILTIN_SOURCE)) {
      logger.info('[styles] 无内置模板包来源目录，跳过初始化')
      return
    }
    await fsp.mkdir(STYLES_DIR, { recursive: true })
    const entries = fs
      .readdirSync(BUILTIN_SOURCE, { withFileTypes: true })
      .filter((e) => e.isDirectory())

    if (entries.length === 0) {
      logger.info('[styles] 内置模板包来源为空，跳过初始化')
      return
    }

    for (const e of entries) {
      const target = path.join(STYLES_DIR, e.name)
      if (fs.existsSync(target)) {
        logger.info(`[styles] 已存在模板包，跳过：${e.name}`)
        continue
      }
      fs.cpSync(path.join(BUILTIN_SOURCE, e.name), target, { recursive: true })
      logger.info(`[styles] 已初始化内置模板包：${e.name}`)
    }
  } catch (err) {
    logger.error({ err }, '[styles] 初始化内置模板包失败')
  }
}

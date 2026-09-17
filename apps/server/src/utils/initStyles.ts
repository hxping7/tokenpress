import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STYLES_DIR } from './paths.js'
import logger from './logger.js'

// 镜像内置模板包来源目录（Dockerfile 在构建期 COPY 进镜像）
export const BUILTIN_SOURCE = path.resolve(process.cwd(), 'styles-builtin')

/**
 * 启动时同步内置模板包（blog/enterprise/design）到 STYLES_DIR（持久卷）。
 *
 * 策略：**文件级合并** ——
 *  - 卷里不存在的包：整包拷贝；
 *  - 已存在的包：只补充镜像里**新增的文件**（如内置包升级时新增的 demo.json /
 *    demo-media/），用户已拥有的文件一律不覆盖，避免动到用户改过的包。
 *
 * 此前是「目录不存在才整体拷贝」，导致内置包升级（新增文件）必须删卷才能生效。
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

    let added = 0
    const mergeDir = (src: string, dst: string): void => {
      fs.mkdirSync(dst, { recursive: true })
      for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name)
        const t = path.join(dst, e.name)
        if (e.isDirectory()) {
          mergeDir(s, t)
        } else if (!fs.existsSync(t)) {
          fs.copyFileSync(s, t)
          added++
        }
      }
    }

    for (const e of entries) {
      const target = path.join(STYLES_DIR, e.name)
      if (!fs.existsSync(target)) {
        fs.cpSync(path.join(BUILTIN_SOURCE, e.name), target, { recursive: true })
        logger.info(`[styles] 已初始化内置模板包：${e.name}`)
      } else {
        const before = added
        mergeDir(path.join(BUILTIN_SOURCE, e.name), target)
        if (added > before) logger.info(`[styles] 已为内置包补齐新增文件：${e.name}（+${added - before}）`)
      }
    }
    if (added === 0) logger.info('[styles] 内置模板包已同步（无新增文件）')
  } catch (err) {
    logger.error({ err }, '[styles] 初始化内置模板包失败')
  }
}

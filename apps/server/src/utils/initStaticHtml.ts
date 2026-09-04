import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STATIC_HTML_DIR } from './paths.js'
import logger from './logger.js'

// 镜像内置欢迎页预置来源目录（Dockerfile 在构建期 COPY 进镜像）
const BUILTIN_SOURCE = path.resolve(process.cwd(), 'statichtml-presets', 'welcome')

/**
 * 首次启动将内置欢迎页（welcome*.html）拷贝进 STATIC_HTML_DIR（持久卷）。
 * 仅当目标文件不存在时才拷贝，避免覆盖后台 /admin/statichtml 中的手动编辑。
 * 与 Style Pack 的 initBuiltinStyles 同策略。
 */
export async function initBuiltinStaticHtml(): Promise<void> {
  try {
    if (!fs.existsSync(BUILTIN_SOURCE)) {
      logger.info('[statichtml] 无内置欢迎页来源目录，跳过初始化')
      return
    }
    await fsp.mkdir(STATIC_HTML_DIR, { recursive: true })
    const files = fs
      .readdirSync(BUILTIN_SOURCE, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.html?$/i.test(e.name))

    if (files.length === 0) {
      logger.info('[statichtml] 内置欢迎页来源为空，跳过初始化')
      return
    }

    for (const f of files) {
      const target = path.join(STATIC_HTML_DIR, f.name)
      if (fs.existsSync(target)) {
        logger.info(`[statichtml] 已存在欢迎页，跳过：${f.name}`)
        continue
      }
      fs.copyFileSync(path.join(BUILTIN_SOURCE, f.name), target)
      logger.info(`[statichtml] 已初始化内置欢迎页：${f.name}`)
    }
  } catch (err) {
    logger.error({ err }, '[statichtml] 初始化内置欢迎页失败')
  }
}

import path from 'node:path'

export const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads')
export const MEDIA_URL_PREFIX = '/api/v1/media/files/'
export const STATIC_HTML_DIR = path.resolve(process.cwd(), 'data', 'statichtml')
// Style Pack 目录：Docker 下由环境变量指向共享卷（/app/apps/server/data/styles），
// 本地开发默认指向仓库内 apps/web/public/styles。
export const STYLES_DIR = process.env.STYLES_DIR
  || path.resolve(process.cwd(), '..', '..', 'apps', 'web', 'public', 'styles')
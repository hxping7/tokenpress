import path from 'node:path'

// 测试环境统一使用 data-test 目录（与 getDbPath 的约定一致），
// 否则测试期间上传/复制的媒体会写进生产 uploads 目录。
const DATA_DIR = path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? 'data-test' : 'data')

export const UPLOAD_DIR = path.resolve(DATA_DIR, 'uploads')
export const MEDIA_URL_PREFIX = '/api/v1/media/files/'
export const STATIC_HTML_DIR = path.resolve(DATA_DIR, 'statichtml')
// Style Pack 目录：Docker 下由环境变量指向共享卷（/app/apps/server/data/styles），
// 本地开发默认指向仓库内 apps/web/public/styles。
export const STYLES_DIR = process.env.STYLES_DIR
  || path.resolve(process.cwd(), '..', '..', 'apps', 'web', 'public', 'styles')

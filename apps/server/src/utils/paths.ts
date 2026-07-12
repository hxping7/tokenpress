import path from 'node:path'

export const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads')
export const MEDIA_URL_PREFIX = '/api/v1/media/files/'
export const STATIC_HTML_DIR = path.resolve(process.cwd(), 'data', 'statichtml')
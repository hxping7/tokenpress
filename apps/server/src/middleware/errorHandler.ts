import type { Request, Response, NextFunction } from 'express'

/**
 * 把已知客户端错误映射为语义正确的状态码（SEC-01）。
 * 旧实现一律返回 500：请求体超限该是 413、JSON 语法错误该是 400，
 * 被吞成 500 后既掩盖攻击特征，也让监控告警失去意义。
 */
function resolveStatus(err: any): number {
  // body-parser / multer 等库自带语义状态
  const declared = typeof err.status === 'number' ? err.status : err.statusCode
  if (typeof declared === 'number' && declared >= 400 && declared <= 499) {
    return declared
  }

  switch (err.type) {
    case 'entity.too.large':
      return 413
    case 'entity.parse.failed':
      return 400
    case 'encoding.unsupported':
      return 415
    case 'parameters.too.many':
      return 413
    case 'charset.unsupported':
      return 415
    default:
      break
  }

  // multer 用 code 而非 status 表达体积/数量超限
  if (typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
    return 413
  }

  return 500
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = resolveStatus(err)

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message)
  } else {
    console.warn(`[WARN] ${req.method} ${req.path} -> ${status}:`, err.message)
  }

  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : errorMessage(status),
  })
}

function errorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request'
    case 413:
      return 'Payload too large'
    case 415:
      return 'Unsupported media type'
    default:
      return 'Internal server error'
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  })
}

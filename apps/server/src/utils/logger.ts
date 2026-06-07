import pino from 'pino'

/**
 * 结构化日志配置
 * - 开发环境: 彩色格式化输出
 * - 生产环境: JSON 结构化输出
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'token00-api',
  },
})

export default logger

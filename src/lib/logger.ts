/**
 * 全局日志系统
 * - 环形缓冲存储在 localStorage，保留最近 500 条
 * - 自动捕获 window.onerror / unhandledrejection
 * - 支持导出为 JSON / 文本
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  ts: number          // 时间戳 ms
  level: LogLevel
  module: string      // 模块名，如 'auth' | 'ai' | 'verify' | 'shop' | 'dungeon'
  message: string
  context?: any       // 可选上下文数据（自动 JSON 序列化）
}

const STORAGE_KEY = 'app-logger-buffer'
const MAX_ENTRIES = 500

let buffer: LogEntry[] = []

// 从 localStorage 恢复
try {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    buffer = JSON.parse(raw) as LogEntry[]
  }
} catch {
  buffer = []
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function persist() {
  try {
    // 只保留最新 MAX_ENTRIES 条
    if (buffer.length > MAX_ENTRIES) {
      buffer = buffer.slice(buffer.length - MAX_ENTRIES)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer))
  } catch (e) {
    // localStorage 满了或不可用，静默失败
    console.warn('[Logger] persist failed', e)
  }
}

function write(level: LogLevel, module: string, message: string, context?: any) {
  const entry: LogEntry = {
    id: genId(),
    ts: Date.now(),
    level,
    module,
    message,
    context: context !== undefined ? safeSerialize(context) : undefined
  }
  buffer.push(entry)
  persist()

  // 同时输出到 console 方便调试
  const prefix = `[${level.toUpperCase()}][${module}]`
  if (level === 'error') console.error(prefix, message, context ?? '')
  else if (level === 'warn') console.warn(prefix, message, context ?? '')
  else console.log(prefix, message, context ?? '')
}

function safeSerialize(value: any): any {
  try {
    // 限制深度和大小，避免存储爆炸
    const json = JSON.stringify(value, (key, val) => {
      if (typeof val === 'string' && val.length > 200) return val.slice(0, 200) + '...'
      return val
    })
    if (json && json.length > 2000) return json.slice(0, 2000) + '...'
    return JSON.parse(json)
  } catch {
    return String(value)
  }
}

export const logger = {
  debug: (module: string, message: string, context?: any) => write('debug', module, message, context),
  info: (module: string, message: string, context?: any) => write('info', module, message, context),
  warn: (module: string, message: string, context?: any) => write('warn', module, message, context),
  error: (module: string, message: string, context?: any) => write('error', module, message, context),

  /** 获取全部日志（最新在前） */
  getAll(): LogEntry[] {
    return [...buffer].reverse()
  },

  /** 按级别筛选 */
  getByLevel(level: LogLevel): LogEntry[] {
    return buffer.filter(e => e.level === level).reverse()
  },

  /** 按模块筛选 */
  getByModule(module: string): LogEntry[] {
    return buffer.filter(e => e.module === module).reverse()
  },

  /** 导出为 JSON 字符串 */
  exportJSON(): string {
    return JSON.stringify(buffer, null, 2)
  },

  /** 导出为可读文本 */
  exportText(): string {
    return buffer.map(e => {
      const d = new Date(e.ts)
      const time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      const ctx = e.context !== undefined ? ` | ${JSON.stringify(e.context)}` : ''
      return `[${time}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}${ctx}`
    }).join('\n')
  },

  /** 清空日志 */
  clear() {
    buffer = []
    persist()
  },

  /** 日志条数 */
  count(): number {
    return buffer.length
  }
}

/**
 * 安装全局错误捕获
 * 应在 main.tsx 中调用一次
 */
export function installGlobalErrorHandlers() {
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('global', `Uncaught error: ${message}`, {
      source, lineno, colno,
      stack: error?.stack?.slice(0, 500)
    })
    return false // 不阻止默认行为
  }

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const msg = reason instanceof Error ? reason.message : String(reason)
    logger.error('global', `Unhandled promise rejection: ${msg}`, {
      stack: reason instanceof Error ? reason.stack?.slice(0, 500) : undefined
    })
  })

  logger.info('logger', 'Logger initialized, global error handlers installed')
}

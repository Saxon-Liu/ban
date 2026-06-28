import electron from 'electron'

const { contextBridge, ipcRenderer } = electron
const originalConsoleError = console.error.bind(console)

// 序列化深度与对象键数量上限，避免对 Error.stack 之外的大对象做无界深拷贝
const MAX_SERIALIZE_DEPTH = 6
const MAX_OBJECT_KEYS = 50
const MAX_ARRAY_ITEMS = 50
const MAX_STRING_LENGTH = 2000

function truncateLogString(value: string) {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH}]`
    : value
}

function serializeForLog(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return truncateLogString(value)
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateLogString(value.message),
      stack: value.stack ? truncateLogString(value.stack) : undefined,
    }
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (typeof value === 'object') {
    if (depth >= MAX_SERIALIZE_DEPTH) return '[MaxDepth]'
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    if (Array.isArray(value)) {
      const slice = value.slice(0, MAX_ARRAY_ITEMS).map((item) => serializeForLog(item, depth + 1, seen))
      if (value.length > MAX_ARRAY_ITEMS) {
        slice.push(`[...${value.length - MAX_ARRAY_ITEMS} more]`)
      }
      return slice
    }

    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS)
    const plainObject: Record<string, unknown> = {}
    for (const key of keys) {
      plainObject[key] = serializeForLog((value as Record<string, unknown>)[key], depth + 1, seen)
    }
    const totalKeys = Object.keys(value).length
    if (totalKeys > MAX_OBJECT_KEYS) {
      plainObject.__truncatedKeys = totalKeys - MAX_OBJECT_KEYS
    }
    return plainObject
  }

  return String(value)
}

function safeSerializeForLog(value: unknown) {
  try {
    return serializeForLog(value)
  } catch (error) {
    return {
      serializationError: error instanceof Error ? error.message : String(error),
    }
  }
}

// Token-bucket 限流：每秒最多上报 30 条，避免高频路径（如拖拽）打日志风暴
const LOG_RATE_PER_SECOND = 30
let logTokens = LOG_RATE_PER_SECOND
let droppedLogs = 0
setInterval(() => {
  if (droppedLogs > 0) {
    void ipcRenderer.invoke('logRenderer', {
      level: 'warn',
      source: 'preload-rate-limit',
      message: '渲染端日志被限流丢弃',
      data: { droppedInLastSecond: droppedLogs },
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString(),
    }).catch(() => {
      // 限流摘要本身失败时不再处理，避免回路
    })
    droppedLogs = 0
  }
  logTokens = LOG_RATE_PER_SECOND
}, 1000)

function sendRendererLog(level: 'info' | 'warn' | 'error', source: string, message: string, data?: unknown) {
  if (logTokens <= 0) {
    droppedLogs += 1
    return
  }
  logTokens -= 1

  void ipcRenderer
    .invoke('logRenderer', {
      level,
      source,
      message,
      data: safeSerializeForLog(data),
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString(),
    })
    .catch((error) => {
      originalConsoleError('[renderer-log-forward-error]', error)
    })
}

function sendRendererError(source: string, message: string, data?: unknown) {
  sendRendererLog('error', source, message, data)
}

function safeStringifyForConsole(value: unknown) {
  try {
    return JSON.stringify(safeSerializeForLog(value))
  } catch (error) {
    return JSON.stringify({
      serializationError: error instanceof Error ? error.message : String(error),
    })
  }
}

function summarizeIpcArg(value: unknown): unknown {
  if (Array.isArray(value)) {
    return `[Array length=${value.length}]`
  }
  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer byteLength=${value.byteLength}]`
  }
  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor.name} byteLength=${value.byteLength}]`
  }
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    return `[String length=${value.length}]`
  }
  return safeSerializeForLog(value)
}

function summarizeIpcArgs(args: unknown[]) {
  return args.map((arg) => summarizeIpcArg(arg))
}

const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, data ? safeStringifyForConsole(data) : '')
  },
  error: (message: string, error?: unknown) => {
    originalConsoleError(`[${new Date().toISOString()}] [ERROR] ${message}`, error)
  },
}

const WHITELISTED_CHANNELS = ['getAppContext', 'getVersion', 'exportLog', 'saveTextFile', 'saveBinaryFile'] as const
type WhitelistedChannel = (typeof WHITELISTED_CHANNELS)[number]

function validateChannel(channel: string): asserts channel is WhitelistedChannel {
  if (!WHITELISTED_CHANNELS.includes(channel as WhitelistedChannel)) {
    throw new Error(`未授权的IPC通道: ${channel}`)
  }
}

function withErrorHandling<TArgs extends unknown[], TResult>(
  channel: WhitelistedChannel,
  handler: (...args: TArgs) => Promise<TResult>
) {
  return async (...args: TArgs) => {
    try {
      logger.info(`调用IPC通道: ${channel}`, summarizeIpcArgs(args))
      const result = await handler(...args)
      logger.info(`IPC通道调用成功: ${channel}`)
      return result
    } catch (error) {
      logger.error(`IPC通道调用失败: ${channel}`, {
        time: new Date().toISOString(),
        args: summarizeIpcArgs(args),
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      })
      throw error
    }
  }
}

async function safeInvoke(channel: string, ...args: unknown[]) {
  validateChannel(channel)
  return ipcRenderer.invoke(channel, ...args)
}

const electronAPI = {
  getAppContext: withErrorHandling('getAppContext', () => safeInvoke('getAppContext')),
  getVersion: withErrorHandling('getVersion', () => safeInvoke('getVersion')),
  exportLog: withErrorHandling('exportLog', () => safeInvoke('exportLog')),
  logRenderer: (
    payload: {
      level?: 'info' | 'warn' | 'error'
      source?: string
      message?: string
      data?: unknown
    }
  ) => {
    const level =
      payload.level === 'warn' || payload.level === 'error' ? payload.level : 'info'
    sendRendererLog(
      level,
      payload.source || 'renderer',
      payload.message || 'renderer diagnostic',
      payload.data
    )
    return Promise.resolve({ success: true })
  },
  saveTextFile: withErrorHandling(
    'saveTextFile',
    (
      defaultFileName: string,
      content: string,
      filters?: Array<{ name: string; extensions: string[] }>
    ) => safeInvoke('saveTextFile', defaultFileName, content, filters)
  ),
  saveBinaryFile: withErrorHandling(
    'saveBinaryFile',
    (
      defaultFileName: string,
      bytes: number[],
      filters?: Array<{ name: string; extensions: string[] }>
    ) => safeInvoke('saveBinaryFile', defaultFileName, bytes, filters)
  ),
  onThemeChange: (callback: (theme: 'dark' | 'light') => void) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => {
      callback(event.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  },
  platform: process.platform,
  isElectron: true as const,
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
    logger.info('Electron API 已暴露到渲染进程')
  } catch (error) {
    logger.error('暴露Electron API失败', error)
  }
} else {
  // @ts-expect-error fallback for disabled context isolation
  window.electronAPI = electronAPI
}

window.addEventListener('error', (event) => {
  const details = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  }
  logger.error('页面错误', details)
  sendRendererError('window-error', event.message || '页面错误', details)
})

window.addEventListener('unhandledrejection', (event) => {
  const details = {
    reason: event.reason,
    promise: event.promise,
  }
  logger.error('未处理的Promise拒绝', details)
  sendRendererError('unhandledrejection', '未处理的Promise拒绝', details)
})

// 只劫持 console.error：info/warn 在拖拽等高频路径会被业务代码大量调用，
// 走 IPC 转发会让渲染主线程因同步序列化而卡死。
// info/warn 仍保留原生输出，可通过 DevTools 查看；如需主进程持久化，业务代码可显式调用 electronAPI 上报。
console.error = (...args: unknown[]) => {
  originalConsoleError(...args)
  sendRendererError('console-error', String(args[0] || 'console.error'), args)
}

logger.info('预加载脚本加载完成')

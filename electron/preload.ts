import electron from 'electron'

const { contextBridge, ipcRenderer } = electron
const originalConsoleError = console.error.bind(console)

function serializeForLog(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    if (Array.isArray(value)) {
      return value.map((item) => serializeForLog(item, seen))
    }

    const plainObject: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      plainObject[key] = serializeForLog((value as Record<string, unknown>)[key], seen)
    }
    return plainObject
  }

  return String(value)
}

function sendRendererError(source: string, message: string, data?: unknown) {
  void ipcRenderer
    .invoke('logRenderer', {
      source,
      message,
      data: serializeForLog(data),
      url: window.location.href,
      userAgent: navigator.userAgent,
      time: new Date().toISOString(),
    })
    .catch((error) => {
      originalConsoleError('[renderer-log-forward-error]', error)
    })
}

const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, data ? JSON.stringify(data) : '')
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
      logger.info(`调用IPC通道: ${channel}`, args)
      const result = await handler(...args)
      logger.info(`IPC通道调用成功: ${channel}`)
      return result
    } catch (error) {
      logger.error(`IPC通道调用失败: ${channel}`, {
        time: new Date().toISOString(),
        args,
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

console.error = (...args: unknown[]) => {
  originalConsoleError(...args)
  sendRendererError('console-error', String(args[0] || 'console.error'), args)
}

logger.info('预加载脚本加载完成')

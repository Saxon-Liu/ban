import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, data ? JSON.stringify(data) : '')
  },
  error: (message: string, error?: unknown) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error)
  },
}

const WHITELISTED_CHANNELS = ['getAppContext', 'getVersion', 'exportLog'] as const
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
  logger.error('页面错误', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('未处理的Promise拒绝', {
    reason: event.reason,
    promise: event.promise,
  })
})

logger.info('预加载脚本加载完成')

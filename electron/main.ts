import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import electron from 'electron'
import { HOLIDAY_REMOTE_CONNECT_SOURCES } from '../shared/holidayRemote'
import { appLogger, errorLogger } from './logger'

const { app, BrowserWindow, dialog, ipcMain, Menu, session } = electron

const APP_NAME = '班'
const APP_ID = 'com.paiban.electron'
const AUTH_STORAGE_KEY = 'auth-token'
const AUTH_EXPIRY_KEY = 'auth-expiry'
const AUTH_SESSION_VERSION_KEY = 'auth-session-version'

if (app.getName() !== APP_NAME) {
  app.setName(APP_NAME)
}
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

class AppManager {
  private mainWindow: InstanceType<typeof BrowserWindow> | null = null
  private securityInitialized = false
  private isClearingAuthSessionOnClose = false
  private readonly appContext = {
    userName: '本地用户',
    roles: ['user'],
    permissions: ['read', 'write'],
    routeBase: '',
    defaultRoute: '/#/',
    themeMode: 'system',
    locale: 'zh-CN',
  }

  private getRendererEntry() {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL
    if (devServerUrl) return { type: 'url' as const, value: devServerUrl }
    return {
      type: 'file' as const,
      value: path.resolve(__dirname, '../dist/index.html'),
    }
  }

  private getDevOrigins() {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL
    if (!devServerUrl) {
      return []
    }

    try {
      const url = new URL(devServerUrl)
      return [url.origin, `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`]
    } catch {
      return []
    }
  }

  private isDevelopment() {
    return !app.isPackaged || Boolean(process.env.VITE_DEV_SERVER_URL)
  }

  private shouldOpenDevTools() {
    if (!this.isDevelopment()) {
      return false
    }
    return process.env.ELECTRON_OPEN_DEVTOOLS !== '0'
  }

  private buildContentSecurityPolicy() {
    const allowedOrigins = [...this.getDevOrigins()]
    const scriptSources = ["'self'"]
    const connectSources = [
      "'self'",
      ...allowedOrigins,
      ...HOLIDAY_REMOTE_CONNECT_SOURCES,
    ]

    if (this.isDevelopment()) {
      scriptSources.push("'unsafe-eval'")
      connectSources.push('http://127.0.0.1:2510', 'http://localhost:2510', 'ws://127.0.0.1:2510', 'ws://localhost:2510')
    }

    return [
      `default-src 'self'`,
      `script-src ${scriptSources.join(' ')}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob:`,
      `font-src 'self' data:`,
      `connect-src ${connectSources.join(' ')}`,
      `worker-src 'self' blob:`,
      `media-src 'self' data: blob:`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `frame-ancestors 'none'`,
    ].join('; ')
  }

  private getIconPath() {
    const candidates = [
      path.resolve(__dirname, '../resources/icon.ico'),
      path.resolve(__dirname, '../resources/icon.png'),
      path.resolve(__dirname, '../resources/icon.svg'),
    ]
    return candidates.find((candidate) => fs.existsSync(candidate))
  }

  private getPreloadPath() {
    const candidates = [
      path.resolve(__dirname, './preload.js'),
      path.resolve(__dirname, './preload.mjs'),
    ]
    const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate))
    if (!resolvedPath) {
      throw new Error('未找到预加载脚本产物')
    }
    return resolvedPath
  }

  private collectDiagnostics(reason = 'unknown') {
    return {
      reason,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime(),
      isPackaged: app.isPackaged,
      versions: process.versions,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      resourceUsage:
        typeof process.resourceUsage === 'function' ? process.resourceUsage() : undefined,
      systemMemory:
        typeof process.getSystemMemoryInfo === 'function' ? process.getSystemMemoryInfo() : undefined,
      os: {
        platform: os.platform(),
        release: os.release(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      },
      appMetrics:
        app.isReady() && typeof app.getAppMetrics === 'function'
          ? app.getAppMetrics().map((metric) => ({
              pid: metric.pid,
              type: metric.type,
              cpuPercent: metric.cpu?.percentCPUUsage,
              workingSetSize: metric.memory?.workingSetSize,
              privateBytes: metric.memory?.privateBytes,
              sandboxed: metric.sandboxed,
            }))
          : [],
    }
  }

  private logDiagnostics(level: 'info' | 'warn' | 'error', message: string, reason: string, extra = {}) {
    const logger = level === 'error' ? errorLogger : appLogger
    logger[level](message, {
      reason,
      diagnostics: this.collectDiagnostics(reason),
      ...extra,
    })
  }

  private async createWindow() {
    const icon = this.getIconPath()
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1100,
      minHeight: 600,
      title: '排班系统',
      icon,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.getPreloadPath(),
      },
    })

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show()
    })

    this.mainWindow.on('unresponsive', () => {
      this.logDiagnostics('error', '主窗口无响应', 'browser-window-unresponsive', {
        url: this.mainWindow?.webContents.getURL(),
      })
    })

    this.mainWindow.on('close', (event) => {
      if (this.isClearingAuthSessionOnClose) {
        return
      }

      event.preventDefault()
      void this.clearAuthSessionAndCloseWindow()
    })

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      this.isClearingAuthSessionOnClose = false
    })

    const rendererEntry = this.getRendererEntry()
    if (rendererEntry.type === 'url') {
      await this.mainWindow.loadURL(rendererEntry.value)
      if (this.shouldOpenDevTools()) {
        this.mainWindow.webContents.openDevTools()
      }
    } else {
      await this.mainWindow.loadFile(rendererEntry.value)
    }

    ;(this.mainWindow.webContents as any).on('crashed', (_event: unknown, killed: boolean) => {
      this.logDiagnostics('error', '渲染进程崩溃', 'webcontents-crashed', { killed })
    })

    ;(this.mainWindow.webContents as any).on(
      'render-process-gone',
      (_event: unknown, details: unknown) => {
      this.logDiagnostics('error', '渲染进程终止', 'render-process-gone', { details })
      }
    )

    this.mainWindow.webContents.on('unresponsive', () => {
      this.logDiagnostics('error', '渲染进程无响应', 'webcontents-unresponsive', {
        url: this.mainWindow?.webContents.getURL(),
      })
    })

    ;(this.mainWindow.webContents as any).on(
      'preload-error',
      (_event: unknown, preloadPath: string, error: Error) => {
      this.logDiagnostics('error', '预加载脚本异常', 'preload-error', {
        preloadPath,
        error: {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
        },
      })
      }
    )

    ;(this.mainWindow.webContents as any).on(
      'did-fail-load',
      (
        _event: unknown,
        errorCode: number,
        errorDescription: string,
        validatedURL: string,
        isMainFrame: boolean
      ) => {
        this.logDiagnostics('error', '页面加载失败', 'did-fail-load', {
          errorCode,
          errorDescription,
          validatedURL,
          isMainFrame,
        })
      }
    )
  }

  private async clearAuthSessionAndCloseWindow() {
    if (!this.mainWindow || this.mainWindow.isDestroyed() || this.isClearingAuthSessionOnClose) {
      return
    }

    this.isClearingAuthSessionOnClose = true

    try {
      await this.mainWindow.webContents.executeJavaScript(
        `
          try {
            localStorage.removeItem(${JSON.stringify(AUTH_STORAGE_KEY)});
            localStorage.removeItem(${JSON.stringify(AUTH_EXPIRY_KEY)});
            localStorage.removeItem(${JSON.stringify(AUTH_SESSION_VERSION_KEY)});
          } catch {}
        `,
        true
      )
    } catch (error) {
      errorLogger.error('关闭应用时清理登录态失败', {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      })
    } finally {
      const targetWindow = this.mainWindow
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.destroy()
      }
    }
  }

  private setupIPC() {
    ipcMain.handle('getAppContext', async () => this.appContext)
    ipcMain.handle('getVersion', async () => app.getVersion())
    ipcMain.handle('logRenderer', async (_event, payload) => {
      errorLogger.error('渲染进程错误', payload)
      return { success: true }
    })
    ipcMain.handle('exportLog', async () => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        title: '导出日志',
        defaultPath: `排班系统日志_${new Date().toISOString().slice(0, 10)}.log`,
        filters: [
          { name: '日志文件', extensions: ['log'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false }
      }

      const logDir = path.join(app.getPath('userData'), 'logs')
      if (!fs.existsSync(logDir)) {
        throw new Error('日志目录不存在')
      }

      const files = await fsp.readdir(logDir)
      const logFiles = await Promise.all(
        files
          .filter((file) => file.endsWith('.log'))
          .map(async (file) => {
            const filePath = path.join(logDir, file)
            const stat = await fsp.stat(filePath)
            return { name: file, path: filePath, mtime: stat.mtimeMs }
          })
      )

      logFiles.sort((a, b) => b.mtime - a.mtime)
      if (logFiles.length === 0) {
        throw new Error('没有可导出的日志')
      }

      const writeStream = fs.createWriteStream(result.filePath, { encoding: 'utf8' })
      writeStream.write('\uFEFF')
      for (const file of logFiles) {
        writeStream.write(`===== ${file.name} =====\n`)
        writeStream.write(await fsp.readFile(file.path, 'utf8'))
        writeStream.write('\n\n')
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve())
        writeStream.on('error', reject)
      })

      appLogger.info('日志导出成功', {
        filePath: result.filePath,
        files: logFiles.map((file) => file.name),
      })
      return {
        success: true,
        filePath: result.filePath,
        files: logFiles.map((file) => file.name),
      }
    })
    ipcMain.handle(
      'saveTextFile',
      async (
        _event,
        defaultFileName: string,
        content: string,
        filters: Array<{ name: string; extensions: string[] }> = [
          { name: '文本文件', extensions: ['txt'] },
          { name: '所有文件', extensions: ['*'] },
        ]
      ) => {
        const result = await dialog.showSaveDialog(this.mainWindow!, {
          title: '保存文件',
          defaultPath: defaultFileName,
          filters,
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        await fsp.writeFile(result.filePath, content, 'utf8')
        return {
          success: true,
          canceled: false,
          filePath: result.filePath,
        }
      }
    )
    ipcMain.handle(
      'saveBinaryFile',
      async (
        _event,
        defaultFileName: string,
        bytes: number[],
        filters: Array<{ name: string; extensions: string[] }> = [
          { name: '二进制文件', extensions: ['bin'] },
          { name: '所有文件', extensions: ['*'] },
        ]
      ) => {
        const result = await dialog.showSaveDialog(this.mainWindow!, {
          title: '保存文件',
          defaultPath: defaultFileName,
          filters,
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        await fsp.writeFile(result.filePath, Buffer.from(bytes))
        return {
          success: true,
          canceled: false,
          filePath: result.filePath,
        }
      }
    )
  }

  private setupSecurity() {
    if (this.securityInitialized) {
      return
    }

    this.securityInitialized = true
    const webSession = session.defaultSession
    const filter = { urls: ['*://*/*'] }
    const allowedOrigins = new Set([
      'http://127.0.0.1:2510',
      'ws://127.0.0.1:2510',
      'http://localhost:2510',
      'ws://localhost:2510',
      ...HOLIDAY_REMOTE_CONNECT_SOURCES,
      ...this.getDevOrigins(),
    ])

    webSession.webRequest.onBeforeRequest(filter, (details, callback) => {
      const isAllowedOrigin = Array.from(allowedOrigins).some((origin) => details.url.startsWith(origin))
      if (!details.url.startsWith('file://') && !details.url.startsWith('devtools://') && !isAllowedOrigin) {
        if (this.isDevelopment()) {
          appLogger.warn('阻止外部请求', { url: details.url })
        }
        callback({ cancel: true })
        return
      }
      callback({})
    })

    webSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            this.buildContentSecurityPolicy(),
          ],
        },
      })
    })
  }

  private setupEventHandlers() {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow()
      }
    })

    app.on('render-process-gone', (_event, webContents, details) => {
      this.logDiagnostics('error', '全局渲染进程终止', 'app-render-process-gone', {
        details,
        url: webContents.getURL(),
      })
    })

    app.on('child-process-gone', (_event, details) => {
      this.logDiagnostics('error', '子进程终止', 'child-process-gone', { details })
      if (details.type === 'GPU') {
        this.logDiagnostics('error', 'GPU 进程崩溃', 'gpu-process-gone', { details })
      }
    })
  }

  async initialize() {
    const start = performance.now()
    appLogger.info('应用初始化开始')
    await app.whenReady()
    appLogger.info('应用准备就绪', { ms: Math.round(performance.now() - start) })

    this.setupIPC()
    this.setupSecurity()
    this.setupEventHandlers()
    await this.createWindow()
    Menu.setApplicationMenu(null)
    this.mainWindow?.setMenuBarVisibility(false)
    appLogger.info('应用初始化完成', { ms: Math.round(performance.now() - start) })
  }

  focusMainWindow() {
    if (!this.mainWindow) return
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
    this.mainWindow.focus()
  }
}

let appManager: AppManager | null = null

process.on('uncaughtException', (error) => {
  errorLogger.error('主进程未捕获异常', {
    message: error?.message,
    stack: error?.stack,
    name: error?.name,
  })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  errorLogger.error('主进程未处理的Promise拒绝', {
    reason:
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack, name: reason.name }
        : reason,
  })
})

process.on('message', (message) => {
  if (message !== 'electron-vite&type=hot-reload') {
    return
  }

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.reload()
  }
})

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    appManager?.focusMainWindow()
  })

  appManager = new AppManager()
  void appManager.initialize().catch((error) => {
    errorLogger.error('应用启动失败', {
      message: error?.message,
      stack: error?.stack,
    })
    process.exit(1)
  })
}

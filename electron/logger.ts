import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import electron from 'electron'

const { app } = electron

class Logger {
  private static readonly UTF8_BOM = '\uFEFF'
  private logDir: string
  private currentLogFile: string | null = null
  private writeQueue: string[] = []
  private isWriting = false
  private readonly maxLogSize = 5 * 1024 * 1024

  constructor(private readonly logName = 'app') {
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.initialize()
  }

  private sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) return value
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
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
    if (Buffer.isBuffer(value)) {
      return value.toString('base64')
    }
    if (typeof value === 'function') {
      return `[Function ${value.name || 'anonymous'}]`
    }
    if (typeof value === 'object') {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)

      if (Array.isArray(value)) {
        return value.map((item) => this.sanitize(item, seen))
      }
      if (value instanceof Set) {
        return Array.from(value).map((item) => this.sanitize(item, seen))
      }
      if (value instanceof Map) {
        return Array.from(value.entries()).map(([key, item]) => [key, this.sanitize(item, seen)])
      }
      if ('toJSON' in value && typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
        try {
          return this.sanitize((value as { toJSON: () => unknown }).toJSON(), seen)
        } catch (error) {
          return `[toJSON error: ${(error as Error).message}]`
        }
      }

      const plainObject: Record<string, unknown> = {}
      for (const key of Object.keys(value)) {
        plainObject[key] = this.sanitize((value as Record<string, unknown>)[key], seen)
      }
      return plainObject
    }

    return value
  }

  private initialize() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
      const today = new Date().toISOString().slice(0, 10)
      this.currentLogFile = path.join(this.logDir, `${this.logName}-${today}.log`)
      setTimeout(() => {
        void this.cleanupOldLogs()
      }, 10000)
    } catch (error) {
      console.error('日志初始化失败:', error)
    }
  }

  private async cleanupOldLogs() {
    try {
      const files = await fsp.readdir(this.logDir)
      const threshold = new Date()
      threshold.setDate(threshold.getDate() - 30)

      for (const file of files) {
        if (!file.startsWith(`${this.logName}-`) || !file.endsWith('.log')) continue
        const filePath = path.join(this.logDir, file)
        const stat = await fsp.stat(filePath)
        if (stat.mtime < threshold) {
          await fsp.unlink(filePath)
        }
      }
    } catch (error) {
      console.error('清理旧日志失败:', error)
    }
  }

  private getCurrentLogFile() {
    if (!this.currentLogFile) {
      this.initialize()
    }
    return this.currentLogFile
  }

  private isDevelopment() {
    return !app.isPackaged || Boolean(process.env.VITE_DEV_SERVER_URL)
  }

  private async ensureUtf8Bom(logFile: string) {
    try {
      const stat = await fsp.stat(logFile).catch(() => null)
      if (!stat || stat.size === 0) {
        await fsp.writeFile(logFile, Logger.UTF8_BOM, { encoding: 'utf8', flag: 'a' })
      }
    } catch (error) {
      console.error('写入日志 BOM 失败:', error)
    }
  }

  private formatMessage(level: string, message: string, data?: unknown) {
    const safeEntry = this.sanitize({
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ?? null,
      pid: process.pid,
    })

    let logStr = JSON.stringify(safeEntry)
    if (logStr.length > this.maxLogSize) {
      logStr = `${logStr.slice(0, this.maxLogSize)}... [truncated]`
    }
    return logStr
  }

  private async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return
    this.isWriting = true

    const batch = this.writeQueue.splice(0, 100)
    try {
      const logFile = this.getCurrentLogFile()
      if (logFile) {
        await this.ensureUtf8Bom(logFile)
        await fsp.appendFile(logFile, `${batch.join('\n')}\n`, 'utf8')
      }
    } catch (error) {
      console.error('批量写入日志失败:', error)
      this.writeQueue = [...batch.slice(0, 1000), ...this.writeQueue]
    } finally {
      this.isWriting = false
      if (this.writeQueue.length > 0) {
        setImmediate(() => {
          void this.processWriteQueue()
        })
      }
    }
  }

  private writeLog(level: string, message: string, data?: unknown) {
    try {
      this.writeQueue.push(this.formatMessage(level, message, data))
      if (this.writeQueue.length > 10000) {
        this.writeQueue.shift()
      }
      setImmediate(() => {
        void this.processWriteQueue()
      })

      if (level === 'error' || this.isDevelopment()) {
        const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
        if (level === 'error') {
          console.error(prefix, data || '')
        } else {
          console.log(prefix, data || '')
        }
      }
    } catch (error) {
      console.error('写入日志失败:', error)
    }
  }

  info(message: string, data?: unknown) {
    this.writeLog('info', message, data)
  }

  warn(message: string, data?: unknown) {
    this.writeLog('warn', message, data)
  }

  error(message: string, data?: unknown) {
    this.writeLog('error', message, data)
  }

  debug(message: string, data?: unknown) {
    if (this.isDevelopment()) {
      this.writeLog('debug', message, data)
    }
  }
}

export { Logger }
export const appLogger = new Logger('app')
export const errorLogger = new Logger('error')

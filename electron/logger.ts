import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import electron from 'electron'

const { app } = electron

class Logger {
  private static readonly UTF8_BOM = '\uFEFF'
  private static readonly MAX_QUEUE_LENGTH = 10000
  private static readonly BATCH_SIZE = 100
  private static readonly MAX_SERIALIZE_DEPTH = 6
  private static readonly MAX_OBJECT_KEYS = 80
  private static readonly MAX_ARRAY_ITEMS = 80
  private static readonly MAX_STRING_LENGTH = 4000
  private static readonly MAX_ENTRY_LENGTH = 256 * 1024
  private static readonly MAX_LOG_FILE_SIZE = 5 * 1024 * 1024
  private static readonly SENSITIVE_KEY_PATTERN =
    /password|passwd|pwd|token|secret|authorization|cookie|session|auth/i
  private logDir: string
  private currentLogFile: string | null = null
  private currentLogDate = ''
  private currentLogIndex = 0
  private writeQueue: string[] = []
  private isWriting = false
  private pendingFlush = false
  private droppedCount = 0

  constructor(private readonly logName = 'app') {
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.initialize()
  }

  private truncateString(value: string) {
    return value.length > Logger.MAX_STRING_LENGTH
      ? `${value.slice(0, Logger.MAX_STRING_LENGTH)}...[truncated ${value.length - Logger.MAX_STRING_LENGTH}]`
      : value
  }

  private sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (value === null || value === undefined) return value
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'string') return this.truncateString(value)
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'symbol') return value.toString()
    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.truncateString(value.message),
        stack: value.stack ? this.truncateString(value.stack) : undefined,
      }
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (Buffer.isBuffer(value)) {
      return `[Buffer length=${value.length}]`
    }
    if (typeof value === 'function') {
      return `[Function ${value.name || 'anonymous'}]`
    }
    if (typeof value === 'object') {
      if (depth >= Logger.MAX_SERIALIZE_DEPTH) return '[MaxDepth]'
      if (seen.has(value)) return '[Circular]'
      seen.add(value)

      if (Array.isArray(value)) {
        const slice = value
          .slice(0, Logger.MAX_ARRAY_ITEMS)
          .map((item) => this.sanitize(item, depth + 1, seen))
        if (value.length > Logger.MAX_ARRAY_ITEMS) {
          slice.push(`[...${value.length - Logger.MAX_ARRAY_ITEMS} more]`)
        }
        return slice
      }
      if (value instanceof Set) {
        const items = Array.from(value)
        const slice = items
          .slice(0, Logger.MAX_ARRAY_ITEMS)
          .map((item) => this.sanitize(item, depth + 1, seen))
        if (items.length > Logger.MAX_ARRAY_ITEMS) {
          slice.push(`[...${items.length - Logger.MAX_ARRAY_ITEMS} more]`)
        }
        return slice
      }
      if (value instanceof Map) {
        const entries = Array.from(value.entries())
        const slice = entries.slice(0, Logger.MAX_OBJECT_KEYS).map(([key, item]) => [
          this.sanitize(key, depth + 1, seen),
          typeof key === 'string' && Logger.SENSITIVE_KEY_PATTERN.test(key)
            ? '[Redacted]'
            : this.sanitize(item, depth + 1, seen),
        ])
        if (entries.length > Logger.MAX_OBJECT_KEYS) {
          slice.push(['[Truncated]', entries.length - Logger.MAX_OBJECT_KEYS])
        }
        return slice
      }
      if ('toJSON' in value && typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
        try {
          return this.sanitize((value as { toJSON: () => unknown }).toJSON(), depth + 1, seen)
        } catch (error) {
          return `[toJSON error: ${(error as Error).message}]`
        }
      }

      const plainObject: Record<string, unknown> = {}
      const keys = Object.keys(value).slice(0, Logger.MAX_OBJECT_KEYS)
      for (const key of keys) {
        plainObject[key] = Logger.SENSITIVE_KEY_PATTERN.test(key)
          ? '[Redacted]'
          : this.sanitize((value as Record<string, unknown>)[key], depth + 1, seen)
      }
      const totalKeys = Object.keys(value).length
      if (totalKeys > Logger.MAX_OBJECT_KEYS) {
        plainObject.__truncatedKeys = totalKeys - Logger.MAX_OBJECT_KEYS
      }
      return plainObject
    }

    return String(value)
  }

  private initialize() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
      const today = new Date().toISOString().slice(0, 10)
      this.setCurrentLogFile(today, 0)
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

  private setCurrentLogFile(date: string, index: number) {
    this.currentLogDate = date
    this.currentLogIndex = index
    const suffix = index > 0 ? `-${index}` : ''
    this.currentLogFile = path.join(this.logDir, `${this.logName}-${date}${suffix}.log`)
  }

  private getCurrentLogFile() {
    if (!this.currentLogFile) {
      this.initialize()
    }
    const today = new Date().toISOString().slice(0, 10)
    if (this.currentLogDate !== today) {
      this.setCurrentLogFile(today, 0)
    }
    return this.currentLogFile
  }

  private async getWritableLogFile(incomingBytes: number) {
    const logFile = this.getCurrentLogFile()
    if (!logFile) return null

    const stat = await fsp.stat(logFile).catch(() => null)
    if (!stat || stat.size + incomingBytes <= Logger.MAX_LOG_FILE_SIZE) {
      return logFile
    }

    const today = new Date().toISOString().slice(0, 10)
    let nextIndex = Math.max(1, this.currentLogIndex + 1)
    for (;;) {
      const suffix = `-${nextIndex}`
      const candidate = path.join(this.logDir, `${this.logName}-${today}${suffix}.log`)
      const candidateStat = await fsp.stat(candidate).catch(() => null)
      if (!candidateStat || candidateStat.size + incomingBytes <= Logger.MAX_LOG_FILE_SIZE) {
        this.setCurrentLogFile(today, nextIndex)
        return candidate
      }
      nextIndex++
    }
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

    let logStr: string
    try {
      logStr = JSON.stringify(safeEntry)
    } catch (error) {
      logStr = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        data: {
          serializationError: (error as Error).message,
        },
        pid: process.pid,
      })
    }

    if (logStr.length > Logger.MAX_ENTRY_LENGTH) {
      logStr = `${logStr.slice(0, Logger.MAX_ENTRY_LENGTH)}... [truncated]`
    }
    return logStr
  }

  private scheduleFlush() {
    if (!this.pendingFlush && !this.isWriting) {
      this.pendingFlush = true
      setImmediate(() => {
        void this.processWriteQueue()
      })
    }
  }

  private async processWriteQueue() {
    this.pendingFlush = false
    if (this.isWriting || this.writeQueue.length === 0) return
    this.isWriting = true

    const batch = this.writeQueue.splice(0, Logger.BATCH_SIZE)
    try {
      const content = `${batch.join('\n')}\n`
      const logFile = await this.getWritableLogFile(Buffer.byteLength(content, 'utf8'))
      if (logFile) {
        await this.ensureUtf8Bom(logFile)
        await fsp.appendFile(logFile, content, 'utf8')
      }
    } catch (error) {
      // 写盘失败时不再回填队列，避免持续 GC 抖动放大故障
      // 失败计数累加，待下次成功写入时摘要落盘
      this.droppedCount += batch.length
      console.error('批量写入日志失败:', error)
    } finally {
      this.isWriting = false
      if (this.writeQueue.length > 0) {
        this.scheduleFlush()
      }
      // 若 droppedCount > 0 但队列已空，下一次有新日志写入时会自动附带丢弃摘要
    }
  }

  private writeLog(level: string, message: string, data?: unknown) {
    try {
      // 队列溢出时一次性丢弃前段，避免 Array.shift 的 O(n) 搬移
      if (this.writeQueue.length >= Logger.MAX_QUEUE_LENGTH) {
        const overflow = this.writeQueue.length - Logger.MAX_QUEUE_LENGTH + 1
        this.writeQueue.splice(0, overflow)
        this.droppedCount += overflow
      }

      // 若上次有丢弃记录，本次写入前先附上摘要
      if (this.droppedCount > 0) {
        const dropped = this.droppedCount
        this.droppedCount = 0
        this.writeQueue.push(
          this.formatMessage('warn', '日志丢弃摘要', { droppedEntries: dropped })
        )
      }

      this.writeQueue.push(this.formatMessage(level, message, data))

      // 合并触发：多次 push 只排一次 flush，避免 setImmediate 风暴
      this.scheduleFlush()

      // packaged 模式下只镜像 error，避免 dev console 与文件双写带来的额外开销
      if (level === 'error' || this.isDevelopment()) {
        const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
        if (level === 'error') {
          console.error(prefix, data || '')
        } else if (this.isDevelopment()) {
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

  async flush(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs
    this.scheduleFlush()

    while ((this.writeQueue.length > 0 || this.isWriting) && Date.now() < deadline) {
      if (this.writeQueue.length > 0) {
        this.scheduleFlush()
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    return this.writeQueue.length === 0 && !this.isWriting
  }
}

export { Logger }
export const appLogger = new Logger('app')
export const errorLogger = new Logger('error')

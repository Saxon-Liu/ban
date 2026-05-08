/**
 * 工具函数和常量
 * 提供项目中使用的通用工具函数和常量
 */

import dayjs from 'dayjs'

/**
 * 生成唯一ID
 * 使用时间戳和随机数组合生成
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取当前日期时间
 */
export function getCurrentDateTime(): Date {
  return new Date()
}

/**
 * 格式化日期
 * @param date - 日期对象或字符串
 * @param format - 格式字符串（默认：YYYY-MM-DD）
 */
export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format)
}

/**
 * 获取月份字符串
 * @param date - 日期对象或字符串
 */
export function getMonthString(date: Date | string = new Date()): string {
  return dayjs(date).format('YYYY-MM')
}

/**
 * 获取日期字符串
 * @param date - 日期对象或字符串
 */
export function getDateString(date: Date | string = new Date()): string {
  return dayjs(date).format('YYYY-MM-DD')
}

/**
 * 按排序序号升序排序，序号相同时按创建时间升序
 */
export function sortByOrder<T extends { order?: number; createdAt?: Date | string }>(
  items: T[],
  options: { fallbackOrder?: number } = {}
): T[] {
  const { fallbackOrder = 0 } = options

  const getTimestamp = (value?: Date | string) => {
    if (!value) return 0
    if (value instanceof Date) return value.getTime()

    const parsed = new Date(value).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return [...items].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : fallbackOrder
    const bo = typeof b.order === 'number' ? b.order : fallbackOrder
    if (ao !== bo) return ao - bo
    return getTimestamp(a.createdAt) - getTimestamp(b.createdAt)
  })
}

/**
 * 深拷贝对象
 * @param obj - 要拷贝的对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 防抖函数
 * @param func - 要执行的函数
 * @param wait - 等待时间（毫秒）
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(later, wait)
  } as T
}

/**
 * 节流函数
 * @param func - 要执行的函数
 * @param limit - 时间限制（毫秒）
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle = false
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  } as T
}

/**
 * 根据背景色自动计算可读的文字颜色
 * 使用亮度公式返回深色或浅色文本
 */
export function getAdaptiveTextColor(bgColor: string): string {
  try {
    const hex = bgColor.replace('#', '')
    const normalizedHex =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex

    const bigint = parseInt(normalizedHex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    return brightness > 186 ? '#000' : '#fff'
  } catch (error) {
    console.error('[adaptive-color-error]', error)
    return '#fff'
  }
}

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
 * 获取星期几的中文名称
 * @param dayOfWeek - 星期几（0-6，0为周日）
 */
export function getWeekdayName(dayOfWeek: number): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[dayOfWeek]
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
/**
 * 日期工具函数
 * 提供日期相关的工具函数
 */

import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 设置中文本地化
dayjs.locale('zh-cn')

/**
 * 获取指定月份的所有日期
 * @param yearMonth - 年月字符串（YYYY-MM格式）
 * @returns 日期数组，包含日期和星期信息
 */
export function getMonthDates(yearMonth: string): Array<{
  date: string
  dayOfWeek: number
  weekdayName: string
}> {
  const startDate = dayjs(yearMonth).startOf('month')
  const endDate = dayjs(yearMonth).endOf('month')
  
  const dates: Array<{
    date: string
    dayOfWeek: number
    weekdayName: string
  }> = []
  
  let currentDate = startDate
  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
    dates.push({
      date: currentDate.format('YYYY-MM-DD'),
      dayOfWeek: currentDate.day(),
      weekdayName: getWeekdayName(currentDate.day()),
    })
    currentDate = currentDate.add(1, 'day')
  }
  
  return dates
}

/**
 * 获取星期几的中文名称
 * @param dayOfWeek - 星期几（0-6，0为周日）
 * @returns 星期几的中文名称
 */
export function getWeekdayName(dayOfWeek: number): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return weekdays[dayOfWeek]
}

/**
 * 判断是否为周末
 * @param date - 日期字符串或Date对象
 * @returns 是否为周末
 */
export function isWeekend(date: string | Date): boolean {
  const day = dayjs(date).day()
  return day === 0 || day === 6 // 周日或周六
}

/**
 * 获取当前月份字符串
 * @returns 当前月份字符串（YYYY-MM格式）
 */
export function getCurrentMonth(): string {
  return dayjs().format('YYYY-MM')
}

/**
 * 获取上个月份字符串
 * @param yearMonth - 当前年月字符串（YYYY-MM格式）
 * @returns 上个月份字符串
 */
export function getPreviousMonth(yearMonth: string): string {
  return dayjs(yearMonth).subtract(1, 'month').format('YYYY-MM')
}

/**
 * 获取下个月份字符串
 * @param yearMonth - 当前年月字符串（YYYY-MM格式）
 * @returns 下个月份字符串
 */
export function getNextMonth(yearMonth: string): string {
  return dayjs(yearMonth).add(1, 'month').format('YYYY-MM')
}

/**
 * 获取月份的天数
 * @param yearMonth - 年月字符串（YYYY-MM格式）
 * @returns 月份的天数
 */
export function getDaysInMonth(yearMonth: string): number {
  return dayjs(yearMonth).daysInMonth()
}

/**
 * 格式化月份显示
 * @param yearMonth - 年月字符串（YYYY-MM格式）
 * @returns 格式化后的月份显示（如：2024年1月）
 */
export function formatMonthDisplay(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  return `${year}年${parseInt(month)}月`
}

/**
 * 解析日期字符串
 * @param dateString - 日期字符串（YYYY-MM-DD格式）
 * @returns 解析后的日期信息
 */
export function parseDate(dateString: string): {
  year: number
  month: number
  day: number
  dayOfWeek: number
  weekdayName: string
} {
  const date = dayjs(dateString)
  return {
    year: date.year(),
    month: date.month() + 1, // dayjs月份从0开始
    day: date.date(),
    dayOfWeek: date.day(),
    weekdayName: getWeekdayName(date.day()),
  }
}
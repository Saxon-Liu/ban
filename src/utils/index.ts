/**
 * 工具模块导出
 * 统一导出所有工具函数和常量
 */

// 通用工具函数
export { generateId, getCurrentDateTime, formatDate, deepClone, debounce, throttle } from './common'

// 日期工具函数
export { 
  getMonthDates, 
  getWeekdayName, 
  isWeekend, 
  getCurrentMonth, 
  getPreviousMonth, 
  getNextMonth, 
  getDaysInMonth, 
  formatMonthDisplay, 
  parseDate 
} from './date'

// 常量
export { 
  DEFAULT_COLORS, 
  DEFAULT_SHIFTS, 
  DB_TABLES, 
  ROUTE_PATHS, 
  DATE_FORMATS, 
  DRAG_TYPES, 
  WEEKDAY_NAMES 
} from './constants'
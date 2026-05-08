/**
 * 工具模块导出
 * 统一导出所有工具函数和常量
 */

// 通用工具函数
export {
  generateId,
  getCurrentDateTime,
  formatDate,
  sortByOrder,
  deepClone,
  debounce,
  throttle,
  getAdaptiveTextColor,
} from './common'

export {
  clearAuthSession,
  isAuthSessionValid,
  refreshAuthSessionExpiry,
  startAuthSession,
} from './auth'

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
  WEEKDAY_NAMES,
  DEFAULT_KEY,
  CUSTOM_KEY_STORAGE,
  AUTH_STORAGE_KEY,
  AUTH_EXPIRY_KEY,
  AUTH_EXPIRY_HOURS,
  AUTO_LOGOUT_WARNING_MINUTES,
  AUTO_LOGOUT_TOTAL_MINUTES,
  AUTO_LOGOUT_ENABLED_KEY,
  AUTO_LOGOUT_WARNING_KEY,
  AUTO_LOGOUT_TOTAL_KEY,
  RESET_CODE,
} from './constants'

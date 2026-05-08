/**
 * 项目常量定义
 * 包含颜色池、默认班次等常量数据
 */

/**
 * 默认颜色池（20个不重复的颜色）
 * 用于人员颜色选择，确保视觉区分度
 */
export const DEFAULT_COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#96CEB4', // 绿色
  '#FFEAA7', // 黄色
  '#DDA0DD', // 紫色
  '#98D8C8', // 薄荷绿
  '#F7DC6F', // 金黄色
  '#BB8FCE', // 淡紫色
  '#85C1E9', // 天蓝色
  '#F8C471', // 橙色
  '#82E0AA', // 浅绿色
  '#F1948A', // 粉红色
  '#85C1E9', // 浅蓝色
  '#D7BDE2', // 淡紫色
  '#A9DFBF', // 浅绿色
  '#F9E79F', // 浅黄色
  '#D5A6BD', // 玫瑰色
  '#AED6F1', // 淡蓝色
  '#A3E4D7', // 青绿色
]

/**
 * 默认班次配置
 * 系统初始化时自动创建的班次
 */
export const DEFAULT_SHIFTS = [
  {
    id: 'shift-default-morning',
    name: '早班',
    color: '#FF6B6B',
    isRest: false,
  },
  {
    id: 'shift-default-normal',
    name: '正常班',
    color: '#45B7D1',
    isRest: false,
  },
  {
    id: 'shift-default-afternoon',
    name: '下午班',
    color: '#4ECDC4',
    isRest: false,
  },
  {
    id: 'shift-default-rest',
    name: '休',
    color: '#96CEB4',
    isRest: true,
  },
]

/**
 * 数据库表名常量
 */
export const DB_TABLES = {
  PEOPLE: 'people',
  SHIFTS: 'shifts',
  SCHEDULES: 'schedules',
  EXTRA_REST_CONFIGS: 'extraRestConfigs',
} as const

/**
 * 路由路径常量
 */
export const ROUTE_PATHS = {
  SCHEDULE: '/schedule',
  PEOPLE: '/people',
  SHIFTS: '/shifts',
  EXTRA_REST: '/extra-rest',
} as const

/**
 * 日期格式常量
 */
export const DATE_FORMATS = {
  YEAR_MONTH: 'YYYY-MM',
  DATE: 'YYYY-MM-DD',
  DATE_TIME: 'YYYY-MM-DD HH:mm:ss',
} as const

/**
 * 拖拽类型常量
 */
export const DRAG_TYPES = {
  PERSON: 'person',
  SCHEDULE: 'schedule',
} as const

/**
 * 星期几名称映射
 */
export const WEEKDAY_NAMES = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
] as const

/**
 * 登录认证相关常量
 */
export const AUTH_STORAGE_KEY = 'auth-token'
export const AUTH_EXPIRY_KEY = 'auth-expiry'
export const CUSTOM_KEY_STORAGE = 'custom-secret-key'
export const AUTH_EXPIRY_HOURS = 24

/**
 * 安全配置（在此集中修改默认密码和恢复码）
 */
export const SECURITY_CONFIG = {
  DEFAULT_KEY: '0519',
  RESET_CODE: '519519',
}

/**
 * 兼容导出（供现有代码使用）
 */
export const DEFAULT_KEY = SECURITY_CONFIG.DEFAULT_KEY
export const RESET_CODE = SECURITY_CONFIG.RESET_CODE
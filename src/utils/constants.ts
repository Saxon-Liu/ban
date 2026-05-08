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
  LOGIN: '/login',
  SCHEDULE: '/schedule',
  DASHBOARD: '/dashboard',
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

/** 当前登录态 token 的存储键 */
export const AUTH_STORAGE_KEY = 'auth-token'
/** 登录绝对过期时间戳的存储键 */
export const AUTH_EXPIRY_KEY = 'auth-expiry'
/** 当前认证口令版本号的存储键 */
export const AUTH_CREDENTIAL_VERSION_KEY = 'auth-credential-version'
/** 当前会话绑定的口令版本号 */
export const AUTH_SESSION_VERSION_KEY = 'auth-session-version'
/** 自定义登录密码哈希的存储键 */
export const CUSTOM_KEY_STORAGE = 'custom-secret-key-hash'
/** 旧版明文密码存储键，仅用于迁移 */
export const LEGACY_CUSTOM_KEY_STORAGE = 'custom-secret-key'
/** 登录后的最长有效时长，属于绝对过期兜底 */
export const AUTH_EXPIRY_HOURS = 1
/** 默认无操作提醒时间 */
export const AUTO_LOGOUT_WARNING_MINUTES = 5
/** 默认无操作自动退出时间 */
export const AUTO_LOGOUT_TOTAL_MINUTES = 10
/** 是否启用自动退出配置的存储键 */
export const AUTO_LOGOUT_ENABLED_KEY = 'auto-logout-enabled'
/** 提醒时间配置的存储键 */
export const AUTO_LOGOUT_WARNING_KEY = 'auto-logout-warning'
/** 总超时时间配置的存储键 */
export const AUTO_LOGOUT_TOTAL_KEY = 'auto-logout-total'

/**
 * 安全配置（源码内保留明文，便于本地维护）
 */
export const SECURITY_CONFIG = {
  /** 默认登录密码 */
  DEFAULT_KEY: '0519',
  /** 恢复码 */
  RESET_CODE: '519519',
}

export const DEFAULT_KEY = SECURITY_CONFIG.DEFAULT_KEY
export const RESET_CODE = SECURITY_CONFIG.RESET_CODE

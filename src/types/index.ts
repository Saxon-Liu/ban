/**
 * 基础实体接口
 * 所有数据模型都继承此接口
 */
export interface BaseEntity {
  /** 唯一标识符 */
  id: string
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

/**
 * 人员实体
 */
export interface Person extends BaseEntity {
  /** 姓名 */
  name: string
  /** 颜色（用于显示） */
  color: string
  /** 基础月休天数 */
  baseRestDays: number
  /** 排序序号（越小越靠前） */
  order?: number
}

/**
 * 班次实体
 */
export interface Shift extends BaseEntity {
  /** 班次名称 */
  name: string
  /** 颜色（用于显示） */
  color: string
  /** 是否为休息班次 */
  isRest: boolean
  /** 排序序号（越小越靠前） */
  order?: number
}

/**
 * 排班记录实体
 */
export interface Schedule extends BaseEntity {
  /** 人员ID */
  personId: string
  /** 班次ID */
  shiftId: string
  /** 日期（YYYY-MM-DD格式） */
  date: string
  /** 月份（YYYY-MM格式，用于快速查询） */
  month: string
}

/**
 * 额外休息配置实体
 */
export interface ExtraRestConfig extends BaseEntity {
  /** 年份 */
  year: number
  /** 月份（1-12） */
  month: number
  /** 额外休息天数 */
  extraRestDays: number
}

/**
 * 人员统计信息
 */
export interface PersonStatistics {
  /** 人员ID */
  personId: string
  /** 统计月份（YYYY-MM格式） */
  month: string
  /** 基础月休天数 */
  baseRestDays: number
  /** 额外休息天数 */
  extraRestDays: number
  /** 已排休天数 */
  scheduledRestDays: number
  /** 剩余未排休天数 */
  remainingRestDays: number
  /** 是否已超休 */
  isOverRest: boolean
}

/**
 * 带统计信息的人员
 */
export interface PersonWithStatistics extends Person {
  /** 统计信息 */
  statistics?: PersonStatistics
}

/**
 * 月度排班概览
 */
export interface MonthlySchedule {
  /** 月份（YYYY-MM格式） */
  month: string
  /** 日期排班信息 */
  dates: {
    /** 日期（YYYY-MM-DD格式） */
    date: string
    /** 星期几（0-6，0为周日） */
    dayOfWeek: number
    /** 各班次的人员ID列表 */
    schedules: {
      /** 班次ID */
      shiftId: string
      /** 人员ID列表 */
      personIds: string[]
    }[]
  }[]
}

/**
 * 创建数据类型（排除ID和时间戳字段）
 */
export type CreateData<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

/**
 * 更新数据类型（部分字段，排除ID和时间戳字段）
 */
export type UpdateData<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>

/**
 * 拖拽数据类型
 */
export interface DragData {
  /** 拖拽类型 */
  type: 'person' | 'schedule'
  /** 人员ID */
  personId: string
  /** 源日期（排班拖拽时） */
  sourceDate?: string
  /** 源班次ID（排班拖拽时） */
  sourceShiftId?: string
}

/**
 * 放置数据类型
 */
export interface DropData {
  /** 目标日期 */
  date: string
  /** 目标班次ID */
  shiftId: string
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  isValid: boolean
  /** 错误信息 */
  error?: string
}
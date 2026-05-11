import type { Person, PersonStatistics, Schedule, Shift } from '@/types'
import { getCurrentMonth } from '@/utils'

const LAST_VIEWED_MONTH_KEY = 'schedule_last_viewed_month'

/** 读取用户最近查看的排班月份，读取失败时回退到当前月份 */
export function getViewedScheduleMonth(): string {
  if (typeof window === 'undefined') {
    return getCurrentMonth()
  }

  try {
    return window.localStorage.getItem(LAST_VIEWED_MONTH_KEY) || getCurrentMonth()
  } catch {
    return getCurrentMonth()
  }
}

/** 获取系统休息班次 ID；未初始化或被异常删除时返回 null */
export function getRestShiftId(shifts: Shift[]): string | null {
  return shifts.find((shift) => shift.isRest)?.id || null
}

/** 按人员、月份和排班记录计算月休统计 */
export function buildPersonStatistics(params: {
  person: Person
  month: string
  schedules: Schedule[]
  extraRestDays?: number
  restShiftId?: string | null
}): PersonStatistics {
  const { person, month, schedules, extraRestDays = 0, restShiftId = null } = params
  // 月休统计只把系统休息班次计入“已排休”，普通班次不参与抵扣。
  const scheduledRestDays = restShiftId
    ? schedules.filter(
        (schedule) =>
          schedule.personId === person.id &&
          schedule.month === month &&
          schedule.shiftId === restShiftId
      ).length
    : 0

  const baseRestDays = person.baseRestDays
  const remainingRestDays = baseRestDays + extraRestDays - scheduledRestDays

  return {
    personId: person.id,
    month,
    baseRestDays,
    extraRestDays,
    scheduledRestDays,
    remainingRestDays,
    isOverRest: remainingRestDays < 0,
  }
}

/** 单元格唯一键，用于拖拽状态和复制/移动排班时定位日期+班次 */
export function getScheduleCellKey(date: string, shiftId: string): string {
  return `${date}::${shiftId}`
}

import type { Person, PersonStatistics, Schedule, Shift } from '@/types'
import { getCurrentMonth } from '@/utils'

const LAST_VIEWED_MONTH_KEY = 'schedule_last_viewed_month'

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

export function getRestShiftId(shifts: Shift[]): string | null {
  return shifts.find((shift) => shift.isRest)?.id || null
}

export function buildPersonStatistics(params: {
  person: Person
  month: string
  schedules: Schedule[]
  extraRestDays?: number
  restShiftId?: string | null
}): PersonStatistics {
  const { person, month, schedules, extraRestDays = 0, restShiftId = null } = params
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

export function getScheduleCellKey(date: string, shiftId: string): string {
  return `${date}::${shiftId}`
}

import type { Schedule } from '@/types'
import { repositories } from '@/repositories'
import { getScheduleCellKey } from './scheduleStatistics'

interface AssignShiftParams {
  personId: string
  shiftId: string
  date: string
}

interface AppendScheduleParams extends AssignShiftParams {
  month: string
}

interface InsertScheduleParams extends AppendScheduleParams {
  targetIndex: number
}

interface ReorderCellSchedulesParams {
  personId: string
  date: string
  shiftId: string
  targetIndex: number
  schedules: Schedule[]
}

interface TransferCellSchedulesParams {
  sourceDate: string
  sourceShiftId: string
  targetDate: string
  targetShiftId: string
  month: string
  schedules: Schedule[]
  mode: 'copy' | 'move'
}

export interface TransferCellSchedulesResult {
  createdCount: number
  conflictCount: number
}

function sortSchedulesByOrder(items: Schedule[]): Schedule[] {
  return [...items].sort((a, b) => {
    const ao = a.order ?? 0
    const bo = b.order ?? 0
    if (ao !== bo) return ao - bo
    const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
    const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
    return at - bt
  })
}

function getSchedulesForCell(schedules: Schedule[], date: string, shiftId: string): Schedule[] {
  return sortSchedulesByOrder(
    schedules.filter((schedule) => schedule.date === date && schedule.shiftId === shiftId)
  )
}

async function assertActiveSchedulingEntities(personId: string, shiftId?: string): Promise<void> {
  const person = await repositories.people.getById(personId)
  if (!person || person.archivedAt) {
    throw new Error('该人员已归档，仅保留历史排班，不可继续排班')
  }

  if (!shiftId) return

  const shift = await repositories.shifts.getById(shiftId)
  if (!shift || shift.archivedAt) {
    throw new Error('该班次已归档，仅保留历史排班，不可继续排班')
  }
}

export class ScheduleService {
  async assignShiftToPerson(params: AssignShiftParams): Promise<'created' | 'updated' | 'same-shift'> {
    const { personId, shiftId, date } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    const existing = await repositories.schedules.getByPersonAndDate(personId, date)

    if (existing) {
      await assertActiveSchedulingEntities(personId, existing.shiftId)
      if (existing.shiftId === shiftId) {
        return 'same-shift'
      }
      await repositories.schedules.update(existing.id, { shiftId })
      return 'updated'
    }

    await repositories.schedules.create({
      personId,
      shiftId,
      date,
      month: date.slice(0, 7),
      order: 1,
    })
    return 'created'
  }

  async removeScheduleByIdentity(personId: string, date: string, shiftId: string): Promise<boolean> {
    await assertActiveSchedulingEntities(personId, shiftId)
    const schedules = await repositories.schedules.getByDate(date)
    const target = schedules.find(
      (schedule) =>
        schedule.personId === personId &&
        schedule.date === date &&
        schedule.shiftId === shiftId
    )

    if (!target) {
      return false
    }

    await repositories.schedules.delete(target.id)
    return true
  }

  async clearMonthSchedules(month: string): Promise<number> {
    const schedules = await repositories.schedules.getByMonth(month)
    await Promise.all(schedules.map((schedule) => repositories.schedules.delete(schedule.id)))
    return schedules.length
  }

  async clearPersonMonthSchedules(personId: string, month: string): Promise<number> {
    const schedules = await repositories.schedules.getByPersonAndMonth(personId, month)
    await Promise.all(schedules.map((schedule) => repositories.schedules.delete(schedule.id)))
    return schedules.length
  }

  async appendScheduleToCell(params: AppendScheduleParams): Promise<void> {
    const { personId, shiftId, date, month } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    const existingCell = await repositories.schedules.getByDate(date)
    const maxOrder = existingCell
      .filter((schedule) => schedule.shiftId === shiftId)
      .reduce((max, schedule) => Math.max(max, schedule.order ?? 0), 0)

    await repositories.schedules.create({
      personId,
      shiftId,
      date,
      month,
      order: maxOrder + 1,
    })
  }

  async insertScheduleIntoCell(params: InsertScheduleParams): Promise<void> {
    const { personId, shiftId, date, month, targetIndex } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    const existingCell = getSchedulesForCell(await repositories.schedules.getByDate(date), date, shiftId)
    const nextOrderSchedules = [...existingCell]
    nextOrderSchedules.splice(targetIndex, 0, {
      id: '',
      personId,
      shiftId,
      date,
      month,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await repositories.schedules.create({
      personId,
      shiftId,
      date,
      month,
      order: targetIndex + 1,
    })

    const updates = nextOrderSchedules
      .map((schedule, index) => ({
        id: schedule.id,
        data: { order: index + 1 },
      }))
      .filter((item) => item.id)

    if (updates.length === 0) return

    if (repositories.schedules.batchUpdate) {
      await repositories.schedules.batchUpdate(updates)
      return
    }

    for (const update of updates) {
      await repositories.schedules.update(update.id, update.data)
    }
  }

  async reorderSchedulesInCell(params: ReorderCellSchedulesParams): Promise<boolean> {
    const { personId, date, shiftId, targetIndex, schedules } = params
    const cellList = getSchedulesForCell(schedules, date, shiftId)
    const fromIndex = cellList.findIndex((schedule) => schedule.personId === personId)
    if (fromIndex < 0 || targetIndex < 0) {
      return false
    }

    const reordered = [...cellList]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const updates = reordered.map((schedule, index) => ({
      id: schedule.id,
      data: { order: index + 1 },
    }))

    if (repositories.schedules.batchUpdate) {
      await repositories.schedules.batchUpdate(updates)
      return true
    }

    for (const update of updates) {
      await repositories.schedules.update(update.id, update.data)
    }

    return true
  }

  async transferCellSchedules(params: TransferCellSchedulesParams): Promise<TransferCellSchedulesResult> {
    const {
      sourceDate,
      sourceShiftId,
      targetDate,
      targetShiftId,
      month,
      schedules,
      mode,
    } = params

    const sourceSchedules = getSchedulesForCell(schedules, sourceDate, sourceShiftId)
    if (sourceSchedules.length === 0) {
      return { createdCount: 0, conflictCount: 0 }
    }

    const sourceShift = await repositories.shifts.getById(sourceShiftId)
    if (!sourceShift || sourceShift.archivedAt) {
      throw new Error('该班次已归档，仅保留历史排班，不可继续排班')
    }

    const targetShift = await repositories.shifts.getById(targetShiftId)
    if (!targetShift || targetShift.archivedAt) {
      throw new Error('该班次已归档，仅保留历史排班，不可继续排班')
    }

    const targetKey = getScheduleCellKey(targetDate, targetShiftId)
    const targetSchedules = schedules.filter(
      (schedule) => getScheduleCellKey(schedule.date, schedule.shiftId) === targetKey
    )

    let maxOrder = targetSchedules.reduce(
      (max, schedule) => Math.max(max, schedule.order ?? 0),
      0
    )

    const existingByTargetDate = new Map<string, Schedule>()
    schedules
      .filter((schedule) => schedule.date === targetDate)
      .forEach((schedule) => existingByTargetDate.set(schedule.personId, schedule))

    const targetPersonIds = new Set(targetSchedules.map((schedule) => schedule.personId))
    const toCreate: Array<Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>> = []
    const toDelete: string[] = []
    let conflictCount = 0

    for (const source of sourceSchedules) {
      await assertActiveSchedulingEntities(source.personId, targetShiftId)

      if (source.date !== targetDate && existingByTargetDate.has(source.personId)) {
        conflictCount++
        continue
      }

      if (targetPersonIds.has(source.personId)) {
        continue
      }

      maxOrder++
      toCreate.push({
        personId: source.personId,
        shiftId: targetShiftId,
        date: targetDate,
        month,
        order: maxOrder,
      })

      if (mode === 'move') {
        toDelete.push(source.id)
      }
    }

    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((id) => repositories.schedules.delete(id)))
    }

    if (toCreate.length > 0) {
      await repositories.schedules.batchCreate(toCreate)
    }

    return {
      createdCount: toCreate.length,
      conflictCount,
    }
  }
}

export const scheduleService = new ScheduleService()

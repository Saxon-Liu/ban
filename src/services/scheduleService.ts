import type { Schedule } from '@/types'
import { repositories } from '@/repositories'
import { dbManager } from '@/repositories/IndexedDBManager'
import { getScheduleCellKey } from './scheduleStatistics'
import { generateId, getCurrentDateTime, sortByOrder } from '@/utils'

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
  createdSchedules: Schedule[]
  updatedSchedules: Schedule[]
  deletedIds: string[]
}

function getSchedulesForCell(schedules: Schedule[], date: string, shiftId: string): Schedule[] {
  return sortByOrder(
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

async function assertUniqueSchedulePerDay(
  personId: string,
  date: string,
  excludeScheduleId?: string
): Promise<void> {
  const existing = await repositories.schedules.getByPersonAndDate(personId, date)
  if (existing && existing.id !== excludeScheduleId) {
    throw new Error('该员工当天已有排班，请先删除原有排班')
  }
}

export class ScheduleService {
  async assignShiftToPerson(
    params: AssignShiftParams
  ): Promise<{ outcome: 'created' | 'updated' | 'same-shift'; schedule?: Schedule }> {
    const { personId, shiftId, date } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    const existing = await repositories.schedules.getByPersonAndDate(personId, date)

    if (existing) {
      await assertActiveSchedulingEntities(personId, existing.shiftId)
      if (existing.shiftId === shiftId) {
        return { outcome: 'same-shift', schedule: existing }
      }
      const updated = await repositories.schedules.update(existing.id, { shiftId })
      return { outcome: 'updated', schedule: updated }
    }

    const created = await repositories.schedules.create({
      personId,
      shiftId,
      date,
      month: date.slice(0, 7),
      order: 1,
    })
    return { outcome: 'created', schedule: created }
  }

  async removeScheduleByIdentity(personId: string, date: string, shiftId: string): Promise<Schedule | null> {
    await assertActiveSchedulingEntities(personId, shiftId)
    const schedules = await repositories.schedules.getByDate(date)
    const target = schedules.find(
      (schedule) =>
        schedule.personId === personId &&
        schedule.date === date &&
        schedule.shiftId === shiftId
    )

    if (!target) {
      return null
    }

    await repositories.schedules.delete(target.id)
    return target
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

  async appendScheduleToCell(params: AppendScheduleParams): Promise<Schedule> {
    const { personId, shiftId, date, month } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    await assertUniqueSchedulePerDay(personId, date)
    const existingCell = await repositories.schedules.getByDate(date)
    const maxOrder = existingCell
      .filter((schedule) => schedule.shiftId === shiftId)
      .reduce((max, schedule) => Math.max(max, schedule.order ?? 0), 0)

    return repositories.schedules.create({
      personId,
      shiftId,
      date,
      month,
      order: maxOrder + 1,
    })
  }

  async insertScheduleIntoCell(
    params: InsertScheduleParams
  ): Promise<{ created: Schedule; updated: Schedule[] }> {
    const { personId, shiftId, date, month, targetIndex } = params
    await assertActiveSchedulingEntities(personId, shiftId)
    await assertUniqueSchedulePerDay(personId, date)
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

    const created = await repositories.schedules.create({
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

    if (updates.length === 0) {
      return { created, updated: [] }
    }

    if (repositories.schedules.batchUpdate) {
      const updated = await repositories.schedules.batchUpdate(updates)
      return { created, updated }
    }

    const updated: Schedule[] = []
    for (const update of updates) {
      updated.push(await repositories.schedules.update(update.id, update.data))
    }
    return { created, updated }
  }

  async reorderSchedulesInCell(params: ReorderCellSchedulesParams): Promise<Schedule[] | null> {
    const { personId, date, shiftId, targetIndex, schedules } = params
    const cellList = getSchedulesForCell(schedules, date, shiftId)
    const fromIndex = cellList.findIndex((schedule) => schedule.personId === personId)
    if (fromIndex < 0 || targetIndex < 0) {
      return null
    }

    const reordered = [...cellList]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const updates = reordered.map((schedule, index) => ({
      id: schedule.id,
      data: { order: index + 1 },
    }))

    if (repositories.schedules.batchUpdate) {
      return repositories.schedules.batchUpdate(updates)
    }

    const updated: Schedule[] = []
    for (const update of updates) {
      updated.push(await repositories.schedules.update(update.id, update.data))
    }

    return updated
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
      return { createdCount: 0, conflictCount: 0, createdSchedules: [], updatedSchedules: [], deletedIds: [] }
    }

    const sourceShift = await repositories.shifts.getById(sourceShiftId)
    if (!sourceShift || sourceShift.archivedAt) {
      throw new Error('该班次已归档，仅保留历史排班，不可继续排班')
    }

    const targetShift = await repositories.shifts.getById(targetShiftId)
    if (!targetShift || targetShift.archivedAt) {
      throw new Error('该班次已归档，仅保留历史排班，不可继续排班')
    }

    const db = await dbManager.getDB()
    const tx = db.transaction('schedules', 'readwrite')
    const store = tx.store
    const now = getCurrentDateTime()

    const sourceDateSchedules = (await store.index('by-date').getAll(sourceDate)) as Schedule[]
    const targetDateSchedules = sourceDate === targetDate
      ? sourceDateSchedules
      : ((await store.index('by-date').getAll(targetDate)) as Schedule[])

    const currentSourceSchedules = getSchedulesForCell(sourceDateSchedules, sourceDate, sourceShiftId)
    const targetKey = getScheduleCellKey(targetDate, targetShiftId)
    const currentTargetSchedules = targetDateSchedules.filter(
      (schedule) => getScheduleCellKey(schedule.date, schedule.shiftId) === targetKey
    )

    let maxOrder = currentTargetSchedules.reduce(
      (max, schedule) => Math.max(max, schedule.order ?? 0),
      0
    )

    const existingByTargetDate = new Map<string, Schedule>()
    targetDateSchedules.forEach((schedule) => existingByTargetDate.set(schedule.personId, schedule))
    const targetPersonIds = new Set(currentTargetSchedules.map((schedule) => schedule.personId))

    const createdSchedules: Schedule[] = []
    const updatedSchedules: Schedule[] = []
    const deletedIds: string[] = []
    let conflictCount = 0

    for (const source of currentSourceSchedules) {
      await assertActiveSchedulingEntities(source.personId, targetShiftId)

      const existingTargetSchedule = existingByTargetDate.get(source.personId)
      const canReuseSameDaySchedule =
        mode === 'move' &&
        source.date === targetDate &&
        existingTargetSchedule?.id === source.id

      if (existingTargetSchedule && !canReuseSameDaySchedule) {
        conflictCount++
        continue
      }

      if (targetPersonIds.has(source.personId)) {
        continue
      }

      maxOrder++

      if (mode === 'move' && source.date === targetDate) {
        const updatedSchedule: Schedule = {
          ...source,
          shiftId: targetShiftId,
          month,
          order: maxOrder,
          updatedAt: now,
        }
        await store.put(updatedSchedule)
        updatedSchedules.push(updatedSchedule)
        targetPersonIds.add(source.personId)
        existingByTargetDate.set(source.personId, updatedSchedule)
        continue
      }

      const createdSchedule: Schedule = {
        id: generateId(),
        personId: source.personId,
        shiftId: targetShiftId,
        date: targetDate,
        month,
        order: maxOrder,
        createdAt: now,
        updatedAt: now,
      }
      await store.add(createdSchedule)
      createdSchedules.push(createdSchedule)
      targetPersonIds.add(source.personId)
      existingByTargetDate.set(source.personId, createdSchedule)

      if (mode === 'move') {
        await store.delete(source.id)
        deletedIds.push(source.id)
      }
    }

    await tx.done

    return {
      createdCount: createdSchedules.length,
      conflictCount,
      createdSchedules,
      updatedSchedules,
      deletedIds,
    }
  }
}

export const scheduleService = new ScheduleService()

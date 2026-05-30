import type { Schedule } from '@/types'
import { repositories } from '@/repositories'
import { dbManager } from '@/repositories/IndexedDBManager'
import { getScheduleCellKey } from './scheduleStatistics'
import { generateId, getCurrentDateTime, sortByOrder } from '@/utils'

interface AssignShiftParams {
  /** 被排班人员 ID */
  personId: string
  /** 目标班次 ID */
  shiftId: string
  /** 排班日期，格式 YYYY-MM-DD */
  date: string
}

interface AppendScheduleParams extends AssignShiftParams {
  /** 排班月份，格式 YYYY-MM，用于索引查询 */
  month: string
}

interface InsertScheduleParams extends AppendScheduleParams {
  /** 插入到目标单元格内的顺序位置 */
  targetIndex: number
}

interface ReorderCellSchedulesParams {
  personId: string
  date: string
  shiftId: string
  targetIndex: number
  schedules: Schedule[]
}

interface MoveScheduleToCellParams {
  personId: string
  sourceDate: string
  sourceShiftId: string
  targetDate: string
  targetShiftId: string
  month: string
  targetIndex: number
}

export interface MoveScheduleToCellResult {
  movedSchedule: Schedule
  updatedSchedules: Schedule[]
  deletedIds: string[]
}

interface TransferCellSchedulesParams {
  /** 来源日期 */
  sourceDate: string
  /** 来源班次 */
  sourceShiftId: string
  /** 目标日期 */
  targetDate: string
  /** 目标班次 */
  targetShiftId: string
  /** 目标月份 */
  month: string
  /** 当前视图已加载的排班快照，用于计算来源单元格顺序 */
  schedules: Schedule[]
  /** copy 保留来源，move 会删除或更新来源记录 */
  mode: 'copy' | 'move'
}

/** 单元格复制/移动后的变更摘要，供页面增量刷新与提示使用 */
export interface TransferCellSchedulesResult {
  createdCount: number
  /** 因同一人员目标日期已有排班而跳过的数量 */
  conflictCount: number
  skippedPersonIds: string[]
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
    throw new Error('该人员已删除，仅保留历史排班，不可继续排班')
  }

  if (!shiftId) return

  const shift = await repositories.shifts.getById(shiftId)
  if (!shift || shift.archivedAt) {
    throw new Error('该班次已删除，仅保留历史排班，不可继续排班')
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
  /** 给人员在指定日期分配班次；已有当天排班时改为更新原记录 */
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

  /** 按人员、日期、班次删除一条排班，常用于拖拽撤销或单元格快捷删除 */
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

  /** 清空整个月份排班，返回删除数量 */
  async clearMonthSchedules(month: string): Promise<number> {
    const schedules = await repositories.schedules.getByMonth(month)
    await Promise.all(schedules.map((schedule) => repositories.schedules.delete(schedule.id)))
    return schedules.length
  }

  /** 清空指定人员某个月份的排班，返回删除数量 */
  async clearPersonMonthSchedules(personId: string, month: string): Promise<number> {
    const schedules = await repositories.schedules.getByPersonAndMonth(personId, month)
    await Promise.all(schedules.map((schedule) => repositories.schedules.delete(schedule.id)))
    return schedules.length
  }

  /** 追加人员到某个日期+班次单元格末尾 */
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

  /** 插入人员到单元格指定位置，并重排该单元格内所有排班顺序 */
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

    const now = getCurrentDateTime()
    const created: Schedule = {
      id: generateId(),
      personId,
      shiftId,
      date,
      month,
      order: targetIndex + 1,
      createdAt: now,
      updatedAt: now,
    }

    const updated = nextOrderSchedules
      .map((schedule, index) => ({
        ...schedule,
        order: index + 1,
        updatedAt: now,
      }))
      .filter((schedule) => schedule.id)
    const db = await dbManager.getDB()
    const tx = db.transaction('schedules', 'readwrite')
    const store = tx.store

    store.add(created)
    for (const schedule of updated) {
      store.put(schedule)
    }
    await tx.done

    return { created, updated }
  }

  /** 调整同一日期+班次单元格内的人员顺序 */
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

  /** 复制或移动整个单元格的排班到另一个日期+班次单元格 */
  async moveScheduleToCell(params: MoveScheduleToCellParams): Promise<MoveScheduleToCellResult> {
    const {
      personId,
      sourceDate,
      sourceShiftId,
      targetDate,
      targetShiftId,
      month,
      targetIndex,
    } = params

    await assertActiveSchedulingEntities(personId, sourceShiftId)
    await assertActiveSchedulingEntities(personId, targetShiftId)

    const now = getCurrentDateTime()
    const [sourceDateSchedules, targetDateSchedules] = await Promise.all([
      repositories.schedules.getByDate(sourceDate),
      sourceDate === targetDate ? Promise.resolve([] as Schedule[]) : repositories.schedules.getByDate(targetDate),
    ])
    const effectiveTargetDateSchedules = sourceDate === targetDate ? sourceDateSchedules : targetDateSchedules
    const sourceSchedule = sourceDateSchedules.find(
      (schedule) =>
        schedule.personId === personId &&
        schedule.date === sourceDate &&
        schedule.shiftId === sourceShiftId
    )

    if (!sourceSchedule) {
      throw new Error('排班记录不存在，请刷新后重试')
    }

    const existingTargetSchedule = effectiveTargetDateSchedules.find(
      (schedule) => schedule.personId === personId && schedule.id !== sourceSchedule.id
    )
    if (existingTargetSchedule) {
      throw new Error('该员工当天已有排班，请先删除原有排班')
    }

    const targetCellSchedules = getSchedulesForCell(
      effectiveTargetDateSchedules.filter((schedule) => schedule.id !== sourceSchedule.id),
      targetDate,
      targetShiftId
    )
    const insertIndex =
      targetIndex >= 0
        ? Math.min(targetIndex, targetCellSchedules.length)
        : targetCellSchedules.length
    const movedSchedule: Schedule = {
      ...sourceSchedule,
      shiftId: targetShiftId,
      date: targetDate,
      month,
      order: insertIndex + 1,
      updatedAt: now,
    }
    const reorderedTargetCell = [...targetCellSchedules]
    reorderedTargetCell.splice(insertIndex, 0, movedSchedule)

    const updatedSchedules = reorderedTargetCell.map((schedule, index) => ({
      ...schedule,
      order: index + 1,
      updatedAt: now,
    }))
    const persistedMovedSchedule =
      updatedSchedules.find((schedule) => schedule.id === sourceSchedule.id) || movedSchedule
    const db = await dbManager.getDB()
    const tx = db.transaction('schedules', 'readwrite')
    const store = tx.store

    for (const schedule of updatedSchedules) {
      store.put(schedule)
    }

    await tx.done

    return {
      movedSchedule: persistedMovedSchedule,
      updatedSchedules,
      deletedIds: [],
    }
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
      return {
        createdCount: 0,
        conflictCount: 0,
        skippedPersonIds: [],
        createdSchedules: [],
        updatedSchedules: [],
        deletedIds: [],
      }
    }

    if (mode === 'copy' && sourceDate === targetDate) {
      throw new Error('同一天内不能复制整格排班，请使用移动调整班次')
    }

    const sourceShift = await repositories.shifts.getById(sourceShiftId)
    if (!sourceShift || sourceShift.archivedAt) {
      throw new Error('该班次已删除，仅保留历史排班，不可继续排班')
    }

    const targetShift = await repositories.shifts.getById(targetShiftId)
    if (!targetShift || targetShift.archivedAt) {
      throw new Error('该班次已删除，仅保留历史排班，不可继续排班')
    }

    const personIds = [...new Set(sourceSchedules.map(s => s.personId))]
    for (const personId of personIds) {
      await assertActiveSchedulingEntities(personId, targetShiftId)
    }

    const now = getCurrentDateTime()
    const [sourceDateSchedules, targetDateSchedules] = await Promise.all([
      repositories.schedules.getByDate(sourceDate),
      sourceDate === targetDate ? Promise.resolve([] as Schedule[]) : repositories.schedules.getByDate(targetDate),
    ])
    const effectiveTargetDateSchedules = sourceDate === targetDate ? sourceDateSchedules : targetDateSchedules

    const currentSourceSchedules = getSchedulesForCell(sourceDateSchedules, sourceDate, sourceShiftId)
    const targetKey = getScheduleCellKey(targetDate, targetShiftId)
    const currentTargetSchedules = effectiveTargetDateSchedules.filter(
      (schedule) => getScheduleCellKey(schedule.date, schedule.shiftId) === targetKey
    )

    let maxOrder = currentTargetSchedules.reduce(
      (max, schedule) => Math.max(max, schedule.order ?? 0),
      0
    )

    // 业务约束：同一人员同一天只能有一条排班，跨班次复制/移动也必须按日期检测冲突。
    const existingByTargetDate = new Map<string, Schedule>()
    targetDateSchedules.forEach((schedule) => existingByTargetDate.set(schedule.personId, schedule))
    const targetPersonIds = new Set(currentTargetSchedules.map((schedule) => schedule.personId))

    const createdSchedules: Schedule[] = []
    const updatedSchedules: Schedule[] = []
    const deletedIds: string[] = []
    const skippedPersonIds: string[] = []
    let conflictCount = 0
    const pendingAdds: Schedule[] = []
    const pendingUpdates: Schedule[] = []
    const pendingDeletes: string[] = []

    for (const source of currentSourceSchedules) {
      const existingTargetSchedule = existingByTargetDate.get(source.personId)
      // 同一天移动到另一个班次时可以直接复用原记录，不应被自己的记录判定为冲突。
      const canReuseSameDaySchedule =
        mode === 'move' &&
        source.date === targetDate &&
        existingTargetSchedule?.id === source.id

      if (existingTargetSchedule && !canReuseSameDaySchedule) {
        conflictCount++
        skippedPersonIds.push(source.personId)
        continue
      }

      if (targetPersonIds.has(source.personId)) {
        conflictCount++
        skippedPersonIds.push(source.personId)
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
        pendingUpdates.push(updatedSchedule)
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
      pendingAdds.push(createdSchedule)
      createdSchedules.push(createdSchedule)
      targetPersonIds.add(source.personId)
      existingByTargetDate.set(source.personId, createdSchedule)

      if (mode === 'move') {
        pendingDeletes.push(source.id)
        deletedIds.push(source.id)
      }
    }

    const db = await dbManager.getDB()
    const tx = db.transaction('schedules', 'readwrite')
    const store = tx.store

    for (const schedule of pendingUpdates) {
      store.put(schedule)
    }

    for (const schedule of pendingAdds) {
      store.add(schedule)
    }

    for (const scheduleId of pendingDeletes) {
      store.delete(scheduleId)
    }

    await tx.done

    return {
      createdCount: createdSchedules.length + updatedSchedules.length,
      conflictCount,
      skippedPersonIds,
      createdSchedules,
      updatedSchedules,
      deletedIds,
    }
  }
}

export const scheduleService = new ScheduleService()

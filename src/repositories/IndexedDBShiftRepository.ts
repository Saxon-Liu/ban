/**
 * 班次Repository的IndexedDB实现
 * 实现班次相关的数据访问操作
 */

import type { ShiftRepository } from './ShiftRepository'
import type { Shift, CreateData, UpdateData } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime, sortByOrder } from '@/utils/common'
//

/**
 * 班次Repository的IndexedDB实现类
 */
export class IndexedDBShiftRepository implements ShiftRepository {
  private sortShifts(list: Shift[]): Shift[] {
    return sortByOrder(list, { fallbackOrder: Number.MAX_SAFE_INTEGER })
  }

  /**
   * 获取所有班次
   */
  async getAll(): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('shifts')
    return this.sortShifts(
      list.filter((shift: Shift) => !shift.archivedAt)
    )
  }

  /**
   * 获取所有班次，包含已归档班次
   */
  async getAllIncludingArchived(): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('shifts')
    return this.sortShifts(list as Shift[])
  }

  /**
   * 根据ID获取班次
   */
  async getById(id: string): Promise<Shift | null> {
    const db = await dbManager.getDB()
    const result = await db.get('shifts', id)
    return result || null
  }

  /**
   * 创建新班次
   */
  async create(data: CreateData<Shift>): Promise<Shift> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const existing = await this.getAllIncludingArchived()
    const maxOrder = existing
      .map((shift) => (typeof shift.order === 'number' ? shift.order : 0))
      .reduce((m, v) => (v > m ? v : m), 0)
    const nextOrder = maxOrder + 1
    const shift: Shift = {
      id: generateId(),
      ...data,
      archivedAt: null,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    }
    
    await db.add('shifts', shift)
    return shift
  }

  /**
   * 更新班次信息
   */
  async update(id: string, data: UpdateData<Shift>): Promise<Shift> {
    const db = await dbManager.getDB()
    const shift = await this.getById(id)
    if (!shift) {
      throw new Error(`班次不存在: ${id}`)
    }
    
    // 允许重命名（不再区分默认与自定义），但“休”建议保留名称
    
    const updatedShift: Shift = {
      ...shift,
      ...data,
      updatedAt: getCurrentDateTime(),
    }
    
    await db.put('shifts', updatedShift)
    return updatedShift
  }

  /**
   * 删除班次
   */
  async delete(id: string): Promise<boolean> {
    const shift = await this.getById(id)
    
    if (!shift) {
      throw new Error(`班次不存在: ${id}`)
    }
    if (shift.isRest) {
      throw new Error('“休”不可删除')
    }

    if (shift.archivedAt) {
      return true
    }

    await this.update(id, {
      archivedAt: getCurrentDateTime(),
    })
    return true
  }

  /**
   * 获取所有默认班次
   */
  async getDefaultShifts(): Promise<Shift[]> {
    try {
      const all = await this.getAll()
      return all.filter((shift) => shift.isRest)
    } catch (error: unknown) {
      console.error('[getDefaultShifts-error]', {
        time: new Date().toISOString(),
        params: {},
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return []
    }
  }

  /**
   * 获取所有自定义班次
   */
  async getCustomShifts(): Promise<Shift[]> {
    try {
      const all = await this.getAll()
      return all.filter((shift) => !shift.isRest)
    } catch (error: unknown) {
      console.error('[getCustomShifts-error]', {
        time: new Date().toISOString(),
        params: {},
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return []
    }
  }

  /**
   * 检查班次是否存在排班记录
   */
  async hasScheduleRecords(shiftId: string): Promise<boolean> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-shiftId', shiftId)
    return schedules.length > 0
  }

  /**
   * 检查班次名称是否已存在
   */
  async isNameExists(name: string, excludeId?: string): Promise<boolean> {
    const db = await dbManager.getDB()
    const shifts = await db.getAllFromIndex('shifts', 'by-name', name)
    const activeShifts = shifts.filter((shift: Shift) => !shift.archivedAt)
    
    if (excludeId) {
      return activeShifts.some(shift => shift.id !== excludeId)
    }
    
    return activeShifts.length > 0
  }

  /**
   * 批量创建班次
   */
  async batchCreate(items: CreateData<Shift>[]): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const existing = await this.getAllIncludingArchived()
    let nextOrder =
      existing
        .map((shift) => (typeof shift.order === 'number' ? shift.order : 0))
        .reduce((m, v) => (v > m ? v : m), 0) + 1
    const shifts: Shift[] = items.map(item => ({
      id: generateId(),
      ...item,
      archivedAt: null,
      order: nextOrder++,
      createdAt: now,
      updatedAt: now,
    }))
    
    const tx = db.transaction('shifts', 'readwrite')
    await Promise.all(shifts.map(shift => tx.store.add(shift)))
    await tx.done
    
    return shifts
  }

  /**
   * 批量更新班次
   */
  async batchUpdate(updates: { id: string; data: UpdateData<Shift> }[]): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const updatedShifts: Shift[] = []
    
    for (const { id, data } of updates) {
      const shift = await this.getById(id)
      if (!shift) {
        throw new Error(`班次不存在: ${id}`)
      }
      
      // 允许重命名（不再区分默认与自定义）
      
      const updatedShift: Shift = {
        ...shift,
        ...data,
        updatedAt: getCurrentDateTime(),
      }
      
      await db.put('shifts', updatedShift)
      updatedShifts.push(updatedShift)
    }
    
    return updatedShifts
  }

  /**
   * 批量删除班次
   */
  async batchDelete(ids: string[]): Promise<boolean> {
    const now = getCurrentDateTime()
    const shifts = await Promise.all(ids.map((id) => this.getById(id)))
    const db = await dbManager.getDB()

    for (const shift of shifts) {
      if (!shift) {
        throw new Error('班次不存在')
      }
      if (shift.isRest) {
        throw new Error('“休”不可删除')
      }
    }
    
    const tx = db.transaction('shifts', 'readwrite')
    for (const shift of shifts) {
      if (!shift || shift.archivedAt) continue
      await tx.store.put({
        ...shift,
        archivedAt: now,
        updatedAt: now,
      })
    }
    await tx.done
    
    return true
  }
}

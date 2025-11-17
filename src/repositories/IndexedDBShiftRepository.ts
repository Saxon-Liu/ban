/**
 * 班次Repository的IndexedDB实现
 * 实现班次相关的数据访问操作
 */

import type { ShiftRepository } from './ShiftRepository'
import type { Shift, CreateData, UpdateData } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime } from '@/utils/common'
//

/**
 * 班次Repository的IndexedDB实现类
 */
export class IndexedDBShiftRepository implements ShiftRepository {
  /**
   * 获取所有班次
   */
  async getAll(): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('shifts')
    return [...list].sort((a: any, b: any) => {
      const ao = typeof a.order === 'number' ? a.order : Number(new Date(a.createdAt))
      const bo = typeof b.order === 'number' ? b.order : Number(new Date(b.createdAt))
      return ao - bo
    })
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
    const existing = await db.getAll('shifts')
    const maxOrder = existing
      .map(s => (typeof (s as any).order === 'number' ? (s as any).order : 0))
      .reduce((m, v) => (v > m ? v : m), 0)
    const nextOrder = maxOrder + 1
    const shift: Shift = {
      id: generateId(),
      ...data,
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
    const db = await dbManager.getDB()
    const shift = await this.getById(id)
    
    if (!shift) {
      throw new Error(`班次不存在: ${id}`)
    }
    if (shift.isRest) {
      throw new Error('“休”不可删除')
    }
    
    // 检查是否存在排班记录
    const hasSchedules = await this.hasScheduleRecords(id)
    if (hasSchedules) {
      // 删除相关排班记录
      await db.delete('schedules', IDBKeyRange.bound([id, ''], [id, '\uffff']))
    }
    
    await db.delete('shifts', id)
    return true
  }

  /**
   * 获取所有默认班次
   */
  async getDefaultShifts(): Promise<Shift[]> {
    try {
      const db = await dbManager.getDB()
      const all = await db.getAll('shifts')
      return all.filter(s => (s as any).isRest === true)
    } catch (error: any) {
      console.error('[getDefaultShifts-error]', {
        time: new Date().toISOString(),
        params: {},
        message: error?.message,
        stack: error?.stack,
      })
      return []
    }
  }

  /**
   * 获取所有自定义班次
   */
  async getCustomShifts(): Promise<Shift[]> {
    try {
      const db = await dbManager.getDB()
      const all = await db.getAll('shifts')
      return all.filter(s => (s as any).isRest !== true)
    } catch (error: any) {
      console.error('[getCustomShifts-error]', {
        time: new Date().toISOString(),
        params: {},
        message: error?.message,
        stack: error?.stack,
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
    
    if (excludeId) {
      return shifts.some(shift => shift.id !== excludeId)
    }
    
    return shifts.length > 0
  }

  /**
   * 批量创建班次
   */
  async batchCreate(items: CreateData<Shift>[]): Promise<Shift[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const shifts: Shift[] = items.map(item => ({
      id: generateId(),
      ...item,
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
    const db = await dbManager.getDB()
    
    // 检查并删除相关排班记录
    for (const id of ids) {
      const shift = await this.getById(id)
      if (!shift) {
        throw new Error(`班次不存在: ${id}`)
      }
      if (shift.isRest) {
        throw new Error('“休”不可删除')
      }
      
      const hasSchedules = await this.hasScheduleRecords(id)
      if (hasSchedules) {
        await db.delete('schedules', IDBKeyRange.bound([id, ''], [id, '\uffff']))
      }
    }
    
    const tx = db.transaction('shifts', 'readwrite')
    await Promise.all(ids.map(id => tx.store.delete(id)))
    await tx.done
    
    return true
  }
}
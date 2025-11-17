/**
 * 排班记录Repository的IndexedDB实现
 * 实现排班记录相关的数据访问操作
 */

import type { ScheduleRepository } from './ScheduleRepository'
import type { Schedule, CreateData, UpdateData } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime } from '@/utils/common'

/**
 * 排班记录Repository的IndexedDB实现类
 */
export class IndexedDBScheduleRepository implements ScheduleRepository {
  /**
   * 获取所有排班记录
   */
  async getAll(): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    return db.getAll('schedules')
  }

  /**
   * 根据ID获取排班记录
   */
  async getById(id: string): Promise<Schedule | null> {
    const db = await dbManager.getDB()
    const result = await db.get('schedules', id)
    return result || null
  }

  /**
   * 创建新排班记录
   */
  async create(data: CreateData<Schedule>): Promise<Schedule> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const schedule: Schedule = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    
    await db.add('schedules', schedule)
    return schedule
  }

  /**
   * 更新排班记录
   */
  async update(id: string, data: UpdateData<Schedule>): Promise<Schedule> {
    const db = await dbManager.getDB()
    const schedule = await this.getById(id)
    if (!schedule) {
      throw new Error(`排班记录不存在: ${id}`)
    }
    
    const updatedSchedule: Schedule = {
      ...schedule,
      ...data,
      updatedAt: getCurrentDateTime(),
    }
    
    await db.put('schedules', updatedSchedule)
    return updatedSchedule
  }

  /**
   * 删除排班记录
   */
  async delete(id: string): Promise<boolean> {
    const db = await dbManager.getDB()
    await db.delete('schedules', id)
    return true
  }

  /**
   * 根据日期获取排班记录
   */
  async getByDate(date: string): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('schedules', 'by-date', date)
  }

  /**
   * 根据月份获取排班记录
   */
  async getByMonth(month: string): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('schedules', 'by-month', month)
  }

  /**
   * 根据人员和月份获取排班记录
   */
  async getByPersonAndMonth(personId: string, month: string): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    const personSchedules = await db.getAllFromIndex('schedules', 'by-personId', personId)
    return personSchedules.filter(schedule => schedule.month === month)
  }

  /**
   * 根据人员和日期获取排班记录
   */
  async getByPersonAndDate(personId: string, date: string): Promise<Schedule | null> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-personId-date', [personId, date])
    return schedules.length > 0 ? schedules[0] : null
  }

  /**
   * 根据班次获取排班记录
   */
  async getByShift(shiftId: string): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('schedules', 'by-shiftId', shiftId)
  }

  /**
   * 删除指定人员的所有排班记录
   */
  async deleteByPerson(personId: string): Promise<number> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-personId', personId)
    
    const tx = db.transaction('schedules', 'readwrite')
    await Promise.all(schedules.map(schedule => tx.store.delete(schedule.id)))
    await tx.done
    
    return schedules.length
  }

  /**
   * 删除指定班次的所有排班记录
   */
  async deleteByShift(shiftId: string): Promise<number> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-shiftId', shiftId)
    
    const tx = db.transaction('schedules', 'readwrite')
    await Promise.all(schedules.map(schedule => tx.store.delete(schedule.id)))
    await tx.done
    
    return schedules.length
  }

  /**
   * 删除指定日期的所有排班记录
   */
  async deleteByDate(date: string): Promise<number> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-date', date)
    
    const tx = db.transaction('schedules', 'readwrite')
    await Promise.all(schedules.map(schedule => tx.store.delete(schedule.id)))
    await tx.done
    
    return schedules.length
  }

  /**
   * 批量创建排班记录
   */
  async batchCreate(schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const newSchedules: Schedule[] = schedules.map(schedule => ({
      id: generateId(),
      ...schedule,
      createdAt: now,
      updatedAt: now,
    }))
    
    const tx = db.transaction('schedules', 'readwrite')
    await Promise.all(newSchedules.map(schedule => tx.store.add(schedule)))
    await tx.done
    
    return newSchedules
  }

  /**
   * 批量更新排班记录
   */
  async batchUpdate(updates: { id: string; data: UpdateData<Schedule> }[]): Promise<Schedule[]> {
    const db = await dbManager.getDB()
    const updatedSchedules: Schedule[] = []
    
    for (const { id, data } of updates) {
      const schedule = await this.getById(id)
      if (!schedule) {
        throw new Error(`排班记录不存在: ${id}`)
      }
      
      const updatedSchedule: Schedule = {
        ...schedule,
        ...data,
        updatedAt: getCurrentDateTime(),
      }
      
      await db.put('schedules', updatedSchedule)
      updatedSchedules.push(updatedSchedule)
    }
    
    return updatedSchedules
  }

  /**
   * 批量删除排班记录
   */
  async batchDelete(ids: string[]): Promise<boolean> {
    const db = await dbManager.getDB()
    
    const tx = db.transaction('schedules', 'readwrite')
    await Promise.all(ids.map(id => tx.store.delete(id)))
    await tx.done
    
    return true
  }
}
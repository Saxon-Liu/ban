/**
 * 人员Repository的IndexedDB实现
 * 实现人员相关的数据访问操作
 */

import type { PeopleRepository } from './PeopleRepository'
import type { Person, PersonStatistics, PersonWithStatistics, CreateData, UpdateData } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime } from '@/utils/common'
import { DEFAULT_COLORS } from '@/utils/constants'

/**
 * 人员Repository的IndexedDB实现类
 */
export class IndexedDBPeopleRepository implements PeopleRepository {
  /**
   * 获取所有人员
   */
  async getAll(): Promise<Person[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('people')
    return [...list].sort((a: any, b: any) => {
      const ao = typeof a.order === 'number' ? a.order : Number(new Date(a.createdAt))
      const bo = typeof b.order === 'number' ? b.order : Number(new Date(b.createdAt))
      return ao - bo
    })
  }

  /**
   * 根据ID获取人员
   */
  async getById(id: string): Promise<Person | null> {
    const db = await dbManager.getDB()
    const result = await db.get('people', id)
    return result || null
  }

  /**
   * 创建新人员
   */
  async create(data: CreateData<Person>): Promise<Person> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const existing = await db.getAll('people')
    const maxOrder = existing
      .map((p: any) => (typeof p.order === 'number' ? p.order : 0))
      .reduce((m: number, v: number) => (v > m ? v : m), 0)
    const person: Person = {
      id: generateId(),
      ...data,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    }
    
    await db.add('people', person)
    return person
  }

  /**
   * 更新人员信息
   */
  async update(id: string, data: UpdateData<Person>): Promise<Person> {
    const db = await dbManager.getDB()
    const person = await this.getById(id)
    if (!person) {
      throw new Error(`人员不存在: ${id}`)
    }
    
    const updatedPerson: Person = {
      ...person,
      ...data,
      updatedAt: getCurrentDateTime(),
    }
    
    await db.put('people', updatedPerson)
    return updatedPerson
  }

  /**
   * 删除人员
   */
  async delete(id: string): Promise<boolean> {
    const db = await dbManager.getDB()
    
    // 检查是否存在排班记录
    const hasSchedules = await this.hasScheduleRecords(id)
    if (hasSchedules) {
      // 删除相关排班记录
      await db.delete('schedules', IDBKeyRange.bound([id, ''], [id, '\uffff']))
    }
    
    await db.delete('people', id)
    return true
  }

  /**
   * 获取人员的统计信息
   */
  async getPersonStatistics(personId: string, month: string): Promise<PersonStatistics> {
    const person = await this.getById(personId)
    if (!person) {
      throw new Error(`人员不存在: ${personId}`)
    }

    const db = await dbManager.getDB()
    const [year, monthNum] = month.split('-').map(Number)
    
    // 获取额外休息配置
    const extraRestConfig = await db.getFromIndex('extraRestConfigs', 'by-year-month', [year, monthNum])
    const extraRestDays = extraRestConfig?.extraRestDays || 0
    
    // 获取当月的休息班次排班记录
    const shifts = await db.getAll('shifts')
    const restShift = shifts.find(s => (s as any).isRest === true)
    let scheduledRestDays = 0
    
    if (restShift) {
      const schedules = await db.getAllFromIndex('schedules', 'by-personId', personId)
      const monthSchedules = schedules.filter(s => s.month === month && s.shiftId === restShift.id)
      scheduledRestDays = monthSchedules.length
    }
    
    const baseRestDays = person.baseRestDays
    const totalRestDays = baseRestDays + extraRestDays
    const remainingRestDays = totalRestDays - scheduledRestDays
    
    return {
      personId,
      month,
      baseRestDays,
      extraRestDays,
      scheduledRestDays,
      remainingRestDays,
      isOverRest: remainingRestDays < 0,
    }
  }

  /**
   * 获取所有人员及其统计信息
   */
  async getAllWithStatistics(month: string): Promise<PersonWithStatistics[]> {
    const people = await this.getAll()
    const peopleWithStats: PersonWithStatistics[] = []
    
    for (const person of people) {
      const statistics = await this.getPersonStatistics(person.id, month)
      peopleWithStats.push({
        ...person,
        statistics,
      })
    }
    
    return peopleWithStats
  }

  /**
   * 检查人员是否存在排班记录
   */
  async hasScheduleRecords(personId: string): Promise<boolean> {
    const db = await dbManager.getDB()
    const schedules = await db.getAllFromIndex('schedules', 'by-personId', personId)
    return schedules.length > 0
  }

  /**
   * 获取下一个颜色（从颜色池中循环选择）
   */
  async getNextColor(): Promise<string> {
    const people = await this.getAll()
    const usedColors = new Set(people.map(p => p.color))
    
    // 找到第一个未使用的颜色
    for (const color of DEFAULT_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }
    
    // 如果所有颜色都已使用，则随机选择一个
    return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
  }

  /**
   * 批量创建人员
   */
  async batchCreate(items: CreateData<Person>[]): Promise<Person[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const people: Person[] = items.map(item => ({
      id: generateId(),
      ...item,
      createdAt: now,
      updatedAt: now,
    }))
    
    const tx = db.transaction('people', 'readwrite')
    await Promise.all(people.map(person => tx.store.add(person)))
    await tx.done
    
    return people
  }

  /**
   * 批量更新人员
   */
  async batchUpdate(updates: { id: string; data: UpdateData<Person> }[]): Promise<Person[]> {
    const db = await dbManager.getDB()
    const updatedPeople: Person[] = []
    
    for (const { id, data } of updates) {
      const person = await this.getById(id)
      if (!person) {
        throw new Error(`人员不存在: ${id}`)
      }
      
      const updatedPerson: Person = {
        ...person,
        ...data,
        updatedAt: getCurrentDateTime(),
      }
      
      await db.put('people', updatedPerson)
      updatedPeople.push(updatedPerson)
    }
    
    return updatedPeople
  }

  /**
   * 批量删除人员
   */
  async batchDelete(ids: string[]): Promise<boolean> {
    const db = await dbManager.getDB()
    
    // 检查并删除相关排班记录
    for (const id of ids) {
      const hasSchedules = await this.hasScheduleRecords(id)
      if (hasSchedules) {
        await db.delete('schedules', IDBKeyRange.bound([id, ''], [id, '\uffff']))
      }
    }
    
    const tx = db.transaction('people', 'readwrite')
    await Promise.all(ids.map(id => tx.store.delete(id)))
    await tx.done
    
    return true
  }
}
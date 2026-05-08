/**
 * 人员Repository的IndexedDB实现
 * 实现人员相关的数据访问操作
 */

import type { PeopleRepository } from './PeopleRepository'
import type { Person, PersonStatistics, PersonWithStatistics, CreateData, UpdateData, Shift } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime, getDateString } from '@/utils/common'
import { DEFAULT_COLORS } from '@/utils/constants'
import { buildPersonStatistics, getRestShiftId } from '@/services/scheduleStatistics'

/**
 * 人员Repository的IndexedDB实现类
 */
export class IndexedDBPeopleRepository implements PeopleRepository {
  private sortPeople(list: Person[]): Person[] {
    return [...list].sort((a: any, b: any) => {
      const ao = typeof a.order === 'number' ? a.order : Number(new Date(a.createdAt))
      const bo = typeof b.order === 'number' ? b.order : Number(new Date(b.createdAt))
      return ao - bo
    })
  }

  /**
   * 获取所有人员
   */
  async getAll(): Promise<Person[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('people')
    return this.sortPeople(
      list.filter((person: Person) => !person.archivedAt)
    )
  }

  /**
   * 获取所有人员，包含已归档人员
   */
  async getAllIncludingArchived(): Promise<Person[]> {
    const db = await dbManager.getDB()
    const list = await db.getAll('people')
    return this.sortPeople(list as Person[])
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
    const existing = await this.getAllIncludingArchived()
    const maxOrder = existing
      .map((p: any) => (typeof p.order === 'number' ? p.order : 0))
      .reduce((m: number, v: number) => (v > m ? v : m), 0)
    const person: Person = {
      id: generateId(),
      ...data,
      archivedAt: null,
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
    const person = await this.getById(id)
    if (!person) {
      throw new Error(`人员不存在: ${id}`)
    }

    if (person.archivedAt) {
      return true
    }

    const today = getDateString()
    const schedules = await db.getAllFromIndex('schedules', 'by-personId', id)
    const futureSchedules = schedules.filter((schedule) => schedule.date >= today)
    if (futureSchedules.length > 0) {
      const tx = db.transaction('schedules', 'readwrite')
      await Promise.all(futureSchedules.map((schedule) => tx.store.delete(schedule.id)))
      await tx.done
    }

    await this.update(id, {
      archivedAt: getCurrentDateTime(),
    })
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
    
    const shifts = await db.getAll('shifts')
    const schedules = await db.getAllFromIndex('schedules', 'by-personId', personId)

    return buildPersonStatistics({
      person,
      month,
      schedules,
      extraRestDays,
      restShiftId: getRestShiftId(shifts as Shift[]),
    })
  }

  /**
   * 获取所有人员及其统计信息
   */
  async getAllWithStatistics(month: string): Promise<PersonWithStatistics[]> {
    const people = await this.getAll()
    const db = await dbManager.getDB()
    const [year, monthNum] = month.split('-').map(Number)
    const [shifts, allSchedules, extraRestConfig] = await Promise.all([
      db.getAll('shifts'),
      db.getAllFromIndex('schedules', 'by-month', month),
      db.getFromIndex('extraRestConfigs', 'by-year-month', [year, monthNum]),
    ])
    const restShiftId = getRestShiftId(shifts as Shift[])
    const extraRestDays = extraRestConfig?.extraRestDays || 0

    return people.map((person) => ({
      ...person,
      statistics: buildPersonStatistics({
        person,
        month,
        schedules: allSchedules,
        extraRestDays,
        restShiftId,
      }),
    }))
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
    const existing = await this.getAllIncludingArchived()
    let nextOrder =
      existing
        .map((p: any) => (typeof p.order === 'number' ? p.order : 0))
        .reduce((m: number, v: number) => (v > m ? v : m), 0) + 1

    const people: Person[] = items.map(item => ({
      id: generateId(),
      ...item,
      archivedAt: null,
      order: nextOrder++,
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
    const now = getCurrentDateTime()
    const people = await Promise.all(ids.map((id) => this.getById(id)))
    const db = await dbManager.getDB()
    const today = getDateString()
    const scheduleTx = db.transaction('schedules', 'readwrite')

    for (const person of people) {
      if (!person) continue
      const schedules = await db.getAllFromIndex('schedules', 'by-personId', person.id)
      const futureSchedules = schedules.filter((schedule) => schedule.date >= today)
      await Promise.all(futureSchedules.map((schedule) => scheduleTx.store.delete(schedule.id)))
    }
    await scheduleTx.done

    const tx = db.transaction('people', 'readwrite')

    for (const person of people) {
      if (!person || person.archivedAt) continue
      await tx.store.put({
        ...person,
        archivedAt: now,
        updatedAt: now,
      })
    }

    await tx.done
    return true
  }
}

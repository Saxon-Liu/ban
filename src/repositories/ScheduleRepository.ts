/**
 * 排班记录Repository接口
 * 定义排班记录相关的数据访问操作
 */

import type { BaseRepository } from './BaseRepository'
import type { Schedule } from '@/types'

/**
 * 排班记录Repository接口
 */
export interface ScheduleRepository extends BaseRepository<Schedule> {
  /**
   * 根据日期获取排班记录
   * @param date - 日期（YYYY-MM-DD格式）
   */
  getByDate(date: string): Promise<Schedule[]>

  /**
   * 根据月份获取排班记录
   * @param month - 月份（YYYY-MM格式）
   */
  getByMonth(month: string): Promise<Schedule[]>

  /**
   * 根据人员和月份获取排班记录
   * @param personId - 人员ID
   * @param month - 月份（YYYY-MM格式）
   */
  getByPersonAndMonth(personId: string, month: string): Promise<Schedule[]>

  /**
   * 根据人员和日期获取排班记录
   * 业务上同一人员同一天只允许一条排班，因此返回单条记录
   * @param personId - 人员ID
   * @param date - 日期（YYYY-MM-DD格式）
   */
  getByPersonAndDate(personId: string, date: string): Promise<Schedule | null>

  /**
   * 根据班次获取排班记录
   * @param shiftId - 班次ID
   */
  getByShift(shiftId: string): Promise<Schedule[]>

  /**
   * 删除指定人员的所有排班记录
   * @param personId - 人员ID
   */
  deleteByPerson(personId: string): Promise<number>

  /**
   * 删除指定班次的所有排班记录
   * @param shiftId - 班次ID
   */
  deleteByShift(shiftId: string): Promise<number>

  /**
   * 删除指定日期的排班记录
   * @param date - 日期（YYYY-MM-DD格式）
   */
  deleteByDate(date: string): Promise<number>

  /**
   * 批量创建排班记录
   * @param schedules - 排班记录数据数组
   */
  batchCreate(schedules: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Schedule[]>
}

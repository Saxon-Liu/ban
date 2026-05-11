/**
 * 人员Repository接口
 * 定义人员相关的数据访问操作
 */

import type { BaseRepository } from './BaseRepository'
import type { Person, PersonStatistics, PersonWithStatistics } from '@/types'

/**
 * 人员Repository接口
 * 扩展基础Repository，添加人员特有的查询方法
 */
export interface PeopleRepository extends BaseRepository<Person> {
  /**
   * 获取所有人员，包含已删除人员
   */
  getAllIncludingArchived(): Promise<Person[]>

  /**
   * 获取人员的统计信息
   * @param personId - 人员ID
   * @param month - 月份（YYYY-MM格式）
   */
  getPersonStatistics(personId: string, month: string): Promise<PersonStatistics>

  /**
   * 获取所有人员及其统计信息
   * @param month - 月份（YYYY-MM格式）
   */
  getAllWithStatistics(month: string): Promise<PersonWithStatistics[]>

  /**
   * 检查人员是否存在排班记录
   * @param personId - 人员ID
   */
  hasScheduleRecords(personId: string): Promise<boolean>

  /**
   * 获取下一个颜色（从颜色池中循环选择）
   */
  getNextColor(): Promise<string>

  /**
   * 检查人员姓名是否已存在
   * 只检查未删除人员；已删除同名人员不阻止重新新增
   * @param name - 人员姓名
   * @param excludeId - 排除的人员ID（更新时用于排除自身）
   */
  isNameExists(name: string, excludeId?: string): Promise<boolean>
}

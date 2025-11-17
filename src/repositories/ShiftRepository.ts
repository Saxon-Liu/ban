/**
 * 班次Repository接口
 * 定义班次相关的数据访问操作
 */

import type { BaseRepository } from './BaseRepository'
import type { Shift } from '@/types'

/**
 * 班次Repository接口
 */
export interface ShiftRepository extends BaseRepository<Shift> {
  /**
   * 获取所有默认班次
   */
  getDefaultShifts(): Promise<Shift[]>

  /**
   * 获取所有自定义班次
   */
  getCustomShifts(): Promise<Shift[]>

  /**
   * 检查班次是否存在排班记录
   * @param shiftId - 班次ID
   */
  hasScheduleRecords(shiftId: string): Promise<boolean>

  /**
   * 检查班次名称是否已存在
   * @param name - 班次名称
   * @param excludeId - 排除的班次ID（更新时用于排除自身）
   */
  isNameExists(name: string, excludeId?: string): Promise<boolean>
}
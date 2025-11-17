/**
 * 额外休息配置Repository接口
 * 定义额外休息配置相关的数据访问操作
 */

import type { BaseRepository } from './BaseRepository'
import type { ExtraRestConfig } from '@/types'

/**
 * 额外休息配置Repository接口
 */
export interface ExtraRestConfigRepository extends BaseRepository<ExtraRestConfig> {
  /**
   * 根据年份和月份获取配置
   * @param year - 年份
   * @param month - 月份（1-12）
   */
  getByYearAndMonth(year: number, month: number): Promise<ExtraRestConfig | null>

  /**
   * 根据年份获取所有配置
   * @param year - 年份
   */
  getByYear(year: number): Promise<ExtraRestConfig[]>

  /**
   * 批量创建或更新配置
   * @param configs - 配置数组
   */
  batchUpsert(configs: Omit<ExtraRestConfig, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<ExtraRestConfig[]>
}
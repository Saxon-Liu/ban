/**
 * 基础Repository接口
 * 定义所有Repository的基本CRUD操作
 */

import type { BaseEntity, CreateData, UpdateData } from '@/types'

/**
 * 基础Repository接口
 * @template T - 实体类型，必须继承BaseEntity
 */
export interface BaseRepository<T extends BaseEntity> {
  /**
   * 获取所有实体
   */
  getAll(): Promise<T[]>

  /**
   * 根据ID获取实体
   * @param id - 实体ID
   */
  getById(id: string): Promise<T | null>

  /**
   * 创建新实体
   * @param data - 创建数据（不包含ID和时间戳）
   */
  create(data: CreateData<T>): Promise<T>

  /**
   * 更新实体
   * @param id - 实体ID
   * @param data - 更新数据（部分字段）
   */
  update(id: string, data: UpdateData<T>): Promise<T>

  /**
   * 删除实体
   * @param id - 实体ID
   */
  delete(id: string): Promise<boolean>

  /**
   * 批量创建实体
   * @param items - 创建数据数组
   */
  batchCreate?(items: CreateData<T>[]): Promise<T[]>

  /**
   * 批量更新实体
   * @param updates - 更新数据数组
   */
  batchUpdate?(updates: { id: string; data: UpdateData<T> }[]): Promise<T[]>

  /**
   * 批量删除实体
   * @param ids - 实体ID数组
   */
  batchDelete?(ids: string[]): Promise<boolean>
}
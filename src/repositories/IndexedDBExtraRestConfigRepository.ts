/**
 * 额外休息配置Repository的IndexedDB实现
 * 实现额外休息配置相关的数据访问操作
 */

import type { ExtraRestConfigRepository } from './ExtraRestConfigRepository'
import type { ExtraRestConfig, CreateData, UpdateData } from '@/types'
import { dbManager } from './IndexedDBManager'
import { generateId, getCurrentDateTime } from '@/utils/common'

/**
 * 额外休息配置Repository的IndexedDB实现类
 */
export class IndexedDBExtraRestConfigRepository implements ExtraRestConfigRepository {
  /**
   * 获取所有额外休息配置
   */
  async getAll(): Promise<ExtraRestConfig[]> {
    const db = await dbManager.getDB()
    return db.getAll('extraRestConfigs')
  }

  /**
   * 根据ID获取额外休息配置
   */
  async getById(id: string): Promise<ExtraRestConfig | null> {
    const db = await dbManager.getDB()
    const result = await db.get('extraRestConfigs', id)
    return result || null
  }

  /**
   * 创建新额外休息配置
   */
  async create(data: CreateData<ExtraRestConfig>): Promise<ExtraRestConfig> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const config: ExtraRestConfig = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    
    await db.add('extraRestConfigs', config)
    return config
  }

  /**
   * 更新额外休息配置
   */
  async update(id: string, data: UpdateData<ExtraRestConfig>): Promise<ExtraRestConfig> {
    const db = await dbManager.getDB()
    const config = await this.getById(id)
    if (!config) {
      throw new Error(`额外休息配置不存在: ${id}`)
    }
    
    const updatedConfig: ExtraRestConfig = {
      ...config,
      ...data,
      updatedAt: getCurrentDateTime(),
    }
    
    await db.put('extraRestConfigs', updatedConfig)
    return updatedConfig
  }

  /**
   * 删除额外休息配置
   */
  async delete(id: string): Promise<boolean> {
    const db = await dbManager.getDB()
    await db.delete('extraRestConfigs', id)
    return true
  }

  /**
   * 根据年份和月份获取配置
   */
  async getByYearAndMonth(year: number, month: number): Promise<ExtraRestConfig | null> {
    const db = await dbManager.getDB()
    const configs = await db.getAllFromIndex('extraRestConfigs', 'by-year-month', [year, month])
    return configs.length > 0 ? configs[0] : null
  }

  /**
   * 根据年份获取所有配置
   */
  async getByYear(year: number): Promise<ExtraRestConfig[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('extraRestConfigs', 'by-year', year)
  }

  /**
   * 批量创建或更新配置
   */
  async batchUpsert(configs: Omit<ExtraRestConfig, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<ExtraRestConfig[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const results: ExtraRestConfig[] = []
    
    for (const config of configs) {
      // 检查是否已存在
      const existing = await this.getByYearAndMonth(config.year, config.month)
      
      if (existing) {
        // 更新现有配置
        const updatedConfig: ExtraRestConfig = {
          ...existing,
          extraRestDays: config.extraRestDays,
          updatedAt: now,
        }
        await db.put('extraRestConfigs', updatedConfig)
        results.push(updatedConfig)
      } else {
        // 创建新配置
        const newConfig: ExtraRestConfig = {
          id: generateId(),
          ...config,
          createdAt: now,
          updatedAt: now,
        }
        await db.add('extraRestConfigs', newConfig)
        results.push(newConfig)
      }
    }
    
    return results
  }
}
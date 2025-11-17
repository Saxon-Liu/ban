/**
 * Repository工厂
 * 用于创建和管理Repository实例
 */

import type { PeopleRepository } from './PeopleRepository'
import type { ShiftRepository } from './ShiftRepository'
import type { ScheduleRepository } from './ScheduleRepository'
import type { ExtraRestConfigRepository } from './ExtraRestConfigRepository'
import { IndexedDBPeopleRepository } from './IndexedDBPeopleRepository'
import { IndexedDBShiftRepository } from './IndexedDBShiftRepository'
import { IndexedDBScheduleRepository } from './IndexedDBScheduleRepository'
import { IndexedDBExtraRestConfigRepository } from './IndexedDBExtraRestConfigRepository'

/**
 * Repository工厂类
 * 提供Repository实例的统一管理
 */
export class RepositoryFactory {
  private static peopleRepo: PeopleRepository | null = null
  private static shiftRepo: ShiftRepository | null = null
  private static scheduleRepo: ScheduleRepository | null = null
  private static extraRestConfigRepo: ExtraRestConfigRepository | null = null

  /**
   * 获取人员Repository实例
   */
  static getPeopleRepository(): PeopleRepository {
    if (!this.peopleRepo) {
      this.peopleRepo = new IndexedDBPeopleRepository()
    }
    return this.peopleRepo
  }

  /**
   * 获取班次Repository实例
   */
  static getShiftRepository(): ShiftRepository {
    if (!this.shiftRepo) {
      this.shiftRepo = new IndexedDBShiftRepository()
    }
    return this.shiftRepo
  }

  /**
   * 获取排班记录Repository实例
   */
  static getScheduleRepository(): ScheduleRepository {
    if (!this.scheduleRepo) {
      this.scheduleRepo = new IndexedDBScheduleRepository()
    }
    return this.scheduleRepo
  }

  /**
   * 获取额外休息配置Repository实例
   */
  static getExtraRestConfigRepository(): ExtraRestConfigRepository {
    if (!this.extraRestConfigRepo) {
      this.extraRestConfigRepo = new IndexedDBExtraRestConfigRepository()
    }
    return this.extraRestConfigRepo
  }

  /**
   * 重置所有Repository实例
   * 主要用于测试场景
   */
  static reset(): void {
    this.peopleRepo = null
    this.shiftRepo = null
    this.scheduleRepo = null
    this.extraRestConfigRepo = null
  }
}

/**
 * 全局Repository实例
 * 提供便捷的Repository访问
 */
export const repositories = {
  people: RepositoryFactory.getPeopleRepository(),
  shifts: RepositoryFactory.getShiftRepository(),
  schedules: RepositoryFactory.getScheduleRepository(),
  extraRestConfigs: RepositoryFactory.getExtraRestConfigRepository(),
} as const
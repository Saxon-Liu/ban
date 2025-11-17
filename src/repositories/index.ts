/**
 * Repository模块导出
 * 统一导出所有Repository相关的内容
 */

// 基础接口
export type { BaseRepository } from './BaseRepository'
export type { PeopleRepository } from './PeopleRepository'
export type { ShiftRepository } from './ShiftRepository'
export type { ScheduleRepository } from './ScheduleRepository'
export type { ExtraRestConfigRepository } from './ExtraRestConfigRepository'

// IndexedDB实现
export { IndexedDBManager, dbManager } from './IndexedDBManager'
export { IndexedDBPeopleRepository } from './IndexedDBPeopleRepository'
export { IndexedDBShiftRepository } from './IndexedDBShiftRepository'
export { IndexedDBScheduleRepository } from './IndexedDBScheduleRepository'
export { IndexedDBExtraRestConfigRepository } from './IndexedDBExtraRestConfigRepository'

// 工厂类
export { RepositoryFactory, repositories } from './RepositoryFactory'
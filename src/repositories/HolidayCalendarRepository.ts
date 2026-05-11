import type {
  HolidayCalendarEntry,
  HolidayRegion,
  HolidaySource,
  HolidaySyncState,
} from '@/types'

export interface HolidayCalendarRepository {
  /** 获取所有节假日条目，不按来源或年份过滤 */
  getAllEntries(): Promise<HolidayCalendarEntry[]>
  /** 获取指定地区和年份的全部来源条目 */
  getEntriesByYear(region: HolidayRegion, year: number): Promise<HolidayCalendarEntry[]>
  /** 获取指定地区、年份和来源的条目 */
  getEntriesByYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource
  ): Promise<HolidayCalendarEntry[]>
  /** 原子替换某一年某个来源下的节假日条目 */
  replaceEntriesForYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource,
    entries: Omit<HolidayCalendarEntry, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<HolidayCalendarEntry[]>
  /** 删除某个来源下的全部节假日条目 */
  deleteEntriesBySource(source: HolidaySource): Promise<void>
  /** 删除某一年某个来源下的节假日条目 */
  deleteEntriesByYearAndSource(region: HolidayRegion, year: number, source: HolidaySource): Promise<void>
  /** 获取全部年份的同步状态 */
  getSyncStates(): Promise<HolidaySyncState[]>
  /** 获取指定地区和年份的同步状态 */
  getSyncState(region: HolidayRegion, year: number): Promise<HolidaySyncState | null>
  /** 新增或更新同步状态，同一年同地区只保留一条 */
  upsertSyncState(
    state: Omit<HolidaySyncState, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<HolidaySyncState>
}

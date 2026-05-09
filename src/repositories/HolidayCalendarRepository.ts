import type {
  HolidayCalendarEntry,
  HolidayRegion,
  HolidaySource,
  HolidaySyncState,
} from '@/types'

export interface HolidayCalendarRepository {
  getAllEntries(): Promise<HolidayCalendarEntry[]>
  getEntriesByYear(region: HolidayRegion, year: number): Promise<HolidayCalendarEntry[]>
  getEntriesByYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource
  ): Promise<HolidayCalendarEntry[]>
  replaceEntriesForYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource,
    entries: Omit<HolidayCalendarEntry, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<HolidayCalendarEntry[]>
  deleteEntriesBySource(source: HolidaySource): Promise<void>
  deleteEntriesByYearAndSource(region: HolidayRegion, year: number, source: HolidaySource): Promise<void>
  getSyncStates(): Promise<HolidaySyncState[]>
  getSyncState(region: HolidayRegion, year: number): Promise<HolidaySyncState | null>
  upsertSyncState(
    state: Omit<HolidaySyncState, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<HolidaySyncState>
}

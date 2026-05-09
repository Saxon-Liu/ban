import type {
  HolidayCalendarEntry,
  HolidayRegion,
  HolidaySource,
  HolidaySyncState,
} from '@/types'
import { dbManager } from './IndexedDBManager'
import type { HolidayCalendarRepository } from './HolidayCalendarRepository'
import { getCurrentDateTime } from '@/utils/common'

function getEntryId(region: HolidayRegion, date: string, source: HolidaySource) {
  return `${region}:${date}:${source}`
}

function getSyncStateId(region: HolidayRegion, year: number) {
  return `${region}:${year}`
}

export class IndexedDBHolidayCalendarRepository implements HolidayCalendarRepository {
  async getAllEntries(): Promise<HolidayCalendarEntry[]> {
    const db = await dbManager.getDB()
    return db.getAll('holidayCalendarEntries')
  }

  async getEntriesByYear(region: HolidayRegion, year: number): Promise<HolidayCalendarEntry[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('holidayCalendarEntries', 'by-region-year', [region, year])
  }

  async getEntriesByYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource
  ): Promise<HolidayCalendarEntry[]> {
    const db = await dbManager.getDB()
    return db.getAllFromIndex('holidayCalendarEntries', 'by-region-year-source', [
      region,
      year,
      source,
    ])
  }

  async replaceEntriesForYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource,
    entries: Omit<HolidayCalendarEntry, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<HolidayCalendarEntry[]> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const existing = await this.getEntriesByYearAndSource(region, year, source)
    const tx = db.transaction('holidayCalendarEntries', 'readwrite')

    await Promise.all(existing.map((entry) => tx.store.delete(entry.id)))

    const nextEntries = entries.map((entry) => ({
      id: getEntryId(entry.region, entry.date, entry.source),
      ...entry,
      createdAt: now,
      updatedAt: now,
    }))

    for (const entry of nextEntries) {
      await tx.store.put(entry)
    }
    await tx.done
    return nextEntries
  }

  async deleteEntriesBySource(source: HolidaySource): Promise<void> {
    const db = await dbManager.getDB()
    const entries = await db.getAllFromIndex('holidayCalendarEntries', 'by-source', source)
    const tx = db.transaction('holidayCalendarEntries', 'readwrite')
    await Promise.all(entries.map((entry) => tx.store.delete(entry.id)))
    await tx.done
  }

  async deleteEntriesByYearAndSource(
    region: HolidayRegion,
    year: number,
    source: HolidaySource
  ): Promise<void> {
    const db = await dbManager.getDB()
    const entries = await this.getEntriesByYearAndSource(region, year, source)
    const tx = db.transaction('holidayCalendarEntries', 'readwrite')
    await Promise.all(entries.map((entry) => tx.store.delete(entry.id)))
    await tx.done
  }

  async getSyncStates(): Promise<HolidaySyncState[]> {
    const db = await dbManager.getDB()
    return db.getAll('holidaySyncStates')
  }

  async getSyncState(region: HolidayRegion, year: number): Promise<HolidaySyncState | null> {
    const db = await dbManager.getDB()
    const state = await db.get('holidaySyncStates', getSyncStateId(region, year))
    return state || null
  }

  async upsertSyncState(
    state: Omit<HolidaySyncState, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<HolidaySyncState> {
    const db = await dbManager.getDB()
    const now = getCurrentDateTime()
    const id = getSyncStateId(state.region, state.year)
    const existing = await this.getSyncState(state.region, state.year)
    const nextState: HolidaySyncState = {
      id,
      createdAt: existing?.createdAt || now,
      ...state,
      updatedAt: now,
    }
    await db.put('holidaySyncStates', nextState)
    return nextState
  }
}

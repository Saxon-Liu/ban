import {
  BUILTIN_HOLIDAY_PAYLOAD,
  BUILTIN_HOLIDAY_REGION,
  BUILTIN_HOLIDAY_YEAR,
} from '@/data/builtinHolidays'
import {
  buildHolidayRemoteSourceUrl,
  HOLIDAY_REMOTE_SOURCE_TEMPLATES,
} from '../../shared/holidayRemote'
import { repositories } from '@/repositories'
import type {
  HolidayCalendarEntry,
  HolidayRegion,
  HolidaySource,
  HolidaySyncState,
  HolidayType,
} from '@/types'

type HolidayCalendarRawDate = {
  date: string
  name?: string
  name_cn?: string
  name_en?: string
  type: HolidayType
}

type HolidayCalendarRawPayload = {
  year: number
  region: HolidayRegion
  dates: HolidayCalendarRawDate[]
}

export type EffectiveHolidayEntry = HolidayCalendarEntry & {
  label: string
  marker: '休' | '班'
  typeLabel: string
}

export type HolidaySourceSummary = {
  year: number
  source: HolidaySource
  count: number
}

export type HolidayManagementSummary = {
  builtinYear: number
  activeSources: HolidaySourceSummary[]
  syncStates: HolidaySyncState[]
}

export type HolidayYearStats = {
  total: number
  publicHoliday: number
  transferWorkday: number
}

const REGION: HolidayRegion = BUILTIN_HOLIDAY_REGION
const REQUEST_TIMEOUT_MS = 8000

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getDisplayName(entry: HolidayCalendarRawDate) {
  return entry.name_cn || entry.name || entry.name_en || ''
}

function assertHolidayPayload(payload: unknown): asserts payload is HolidayCalendarRawPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('节假日数据必须是 JSON 对象')
  }

  const data = payload as Partial<HolidayCalendarRawPayload>
  if (typeof data.year !== 'number') {
    throw new Error('节假日数据缺少有效年份')
  }
  if (data.region !== REGION) {
    throw new Error('仅支持 CN 地区节假日数据')
  }
  if (!Array.isArray(data.dates)) {
    throw new Error('节假日数据缺少 dates 数组')
  }

  data.dates.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`第 ${index + 1} 条节假日数据格式无效`)
    }
    if (!isDateString(entry.date)) {
      throw new Error(`第 ${index + 1} 条节假日日期格式无效`)
    }
    if (!['public_holiday', 'transfer_workday'].includes(entry.type)) {
      throw new Error(`第 ${index + 1} 条节假日类型无效`)
    }
    if (!getDisplayName(entry)) {
      throw new Error(`第 ${index + 1} 条节假日缺少名称`)
    }
  })
}

function normalizeEntries(
  payload: HolidayCalendarRawPayload,
  source: HolidaySource
): Omit<HolidayCalendarEntry, 'id' | 'createdAt' | 'updatedAt'>[] {
  return payload.dates.map((entry) => ({
    date: entry.date,
    year: payload.year,
    region: payload.region,
    name: entry.name || getDisplayName(entry),
    nameCn: entry.name_cn || entry.name || entry.name_en || '',
    nameEn: entry.name_en || entry.name || entry.name_cn || '',
    type: entry.type,
    source,
  }))
}

function withDisplay(entry: HolidayCalendarEntry): EffectiveHolidayEntry {
  const label = entry.nameCn || entry.name || entry.nameEn
  const isWorkday = entry.type === 'transfer_workday'
  return {
    ...entry,
    label,
    marker: isWorkday ? '班' : '休',
    typeLabel: isWorkday ? '调休工作日' : '法定节假日',
  }
}

async function fetchJsonWithTimeout(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    window.clearTimeout(timeout)
  }
}

export class HolidayService {
  private builtinEnsured = false

  async ensureBuiltinHolidays(): Promise<void> {
    if (this.builtinEnsured) return
    const payload = BUILTIN_HOLIDAY_PAYLOAD.data
    assertHolidayPayload(payload)

    await repositories.holidayCalendar.deleteEntriesBySource('builtin')
    await repositories.holidayCalendar.replaceEntriesForYearAndSource(
      REGION,
      BUILTIN_HOLIDAY_YEAR,
      'builtin',
      normalizeEntries(payload, 'builtin')
    )
    this.builtinEnsured = true
  }

  async restoreBuiltinHolidays(): Promise<void> {
    const payload = BUILTIN_HOLIDAY_PAYLOAD.data
    assertHolidayPayload(payload)
    await repositories.holidayCalendar.replaceEntriesForYearAndSource(
      REGION,
      BUILTIN_HOLIDAY_YEAR,
      'builtin',
      normalizeEntries(payload, 'builtin')
    )
    this.builtinEnsured = true
  }

  async getEffectiveYearDates(
    region: HolidayRegion,
    year: number
  ): Promise<EffectiveHolidayEntry[]> {
    await this.ensureBuiltinHolidays()
    const entries = await repositories.holidayCalendar.getEntriesByYear(region, year)
    const sourceOrder: HolidaySource[] = ['manual-import', 'remote', 'builtin']

    for (const source of sourceOrder) {
      const bySource = entries.filter((entry) => entry.source === source)
      if (bySource.length > 0) {
        return bySource.map(withDisplay).sort((a, b) => a.date.localeCompare(b.date))
      }
    }

    return []
  }

  async getEffectiveMonthDateMap(
    region: HolidayRegion,
    yearMonth: string
  ): Promise<Map<string, EffectiveHolidayEntry>> {
    const year = Number(yearMonth.slice(0, 4))
    const entries = await this.getEffectiveYearDates(region, year)
    const map = new Map<string, EffectiveHolidayEntry>()
    entries
      .filter((entry) => entry.date.startsWith(`${yearMonth}-`))
      .forEach((entry) => map.set(entry.date, entry))
    return map
  }

  async importHolidayJson(payload: unknown): Promise<{ year: number; count: number }> {
    assertHolidayPayload(payload)
    await repositories.holidayCalendar.replaceEntriesForYearAndSource(
      payload.region,
      payload.year,
      'manual-import',
      normalizeEntries(payload, 'manual-import')
    )
    return { year: payload.year, count: payload.dates.length }
  }

  async syncYearFromRemote(year: number): Promise<{ year: number; count: number; url: string }> {
    const failures: string[] = []

    for (const template of HOLIDAY_REMOTE_SOURCE_TEMPLATES) {
      const url = buildHolidayRemoteSourceUrl(template, year)
      try {
        const payload = await fetchJsonWithTimeout(url)
        assertHolidayPayload(payload)
        if (payload.year !== year) {
          throw new Error(`年份不匹配: ${payload.year}`)
        }

        await repositories.holidayCalendar.replaceEntriesForYearAndSource(
          REGION,
          year,
          'remote',
          normalizeEntries(payload, 'remote')
        )
        await repositories.holidayCalendar.upsertSyncState({
          region: REGION,
          year,
          lastSourceUrl: url,
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncMessage: `同步成功，共 ${payload.dates.length} 条`,
        })

        return { year, count: payload.dates.length, url }
      } catch (error) {
        failures.push(`${url}: ${error instanceof Error ? error.message : '未知错误'}`)
      }
    }

    const message =
      '无法连接节假日数据源。当前可能离线，或远程地址不可访问。请稍后重试，或手动导入 holiday-calendar 格式的 JSON 文件。'
    await repositories.holidayCalendar.upsertSyncState({
      region: REGION,
      year,
      lastSyncAt: new Date(),
      lastSyncStatus: 'failed',
      lastSyncMessage: failures.join('\n') || message,
    })
    throw new Error(message)
  }

  async getManagementSummary(): Promise<HolidayManagementSummary> {
    await this.ensureBuiltinHolidays()
    const [entries, syncStates] = await Promise.all([
      repositories.holidayCalendar.getAllEntries(),
      repositories.holidayCalendar.getSyncStates(),
    ])
    const grouped = new Map<string, HolidaySourceSummary>()

    for (const entry of entries) {
      const key = `${entry.year}:${entry.source}`
      const existing = grouped.get(key)
      if (existing) {
        existing.count += 1
      } else {
        grouped.set(key, { year: entry.year, source: entry.source, count: 1 })
      }
    }

    return {
      builtinYear: BUILTIN_HOLIDAY_YEAR,
      activeSources: Array.from(grouped.values()).sort(
        (a, b) => b.year - a.year || a.source.localeCompare(b.source)
      ),
      syncStates: syncStates.sort((a, b) => b.year - a.year),
    }
  }

  async getYearStats(region: HolidayRegion, year: number): Promise<HolidayYearStats> {
    const entries = await this.getEffectiveYearDates(region, year)
    const publicHoliday = entries.filter((entry) => entry.type === 'public_holiday').length
    const transferWorkday = entries.filter((entry) => entry.type === 'transfer_workday').length
    return {
      total: entries.length,
      publicHoliday,
      transferWorkday,
    }
  }

  async clearRemoteData(): Promise<void> {
    await repositories.holidayCalendar.deleteEntriesBySource('remote')
  }

  async clearManualImportData(): Promise<void> {
    await repositories.holidayCalendar.deleteEntriesBySource('manual-import')
  }
}

export const holidayService = new HolidayService()

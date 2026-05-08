import type { ExtraRestConfig, Person, Schedule, Shift } from '@/types'
import { repositories } from '@/repositories'
import { dbManager } from '@/repositories/IndexedDBManager'
import { DEFAULT_SHIFTS } from '@/utils'
import { getCurrentDateTime } from '@/utils/common'

interface ImportOptions {
  importArchivedPeople: boolean
  replaceAllBeforeImport: boolean
}

export interface SerializedScheduleRecord extends Omit<Schedule, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export interface ExportConfigData {
  people: Person[]
  shifts: Shift[]
  extraRestConfigs: ExtraRestConfig[]
  schedules?: SerializedScheduleRecord[]
}

export interface ExportConfigPayload {
  version: string
  timestamp: string
  data: ExportConfigData
}

interface ImportedPersonRecord extends Partial<Person> {
  id: string
  name: string
}

interface ImportedShiftRecord extends Partial<Shift> {
  id: string
  name: string
}

interface ImportedExtraRestConfigRecord extends Partial<ExtraRestConfig> {
  id: string
  year: number
  month: number
}

interface ImportedScheduleRecord extends Partial<Schedule> {
  id: string
  personId: string
  shiftId: string
  date: string
}

export interface ImportedConfigData {
  people: ImportedPersonRecord[]
  shifts: ImportedShiftRecord[]
  extraRestConfigs?: ImportedExtraRestConfigRecord[]
  schedules?: ImportedScheduleRecord[]
}

function parseTimestamp(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return getCurrentDateTime()
}

function getScheduleSlotKey(personId: string, date: string) {
  return `${personId}::${date}`
}

export function normalizeImportedShifts(shifts: ImportedShiftRecord[] = []) {
  const defaultRestShift = DEFAULT_SHIFTS.find((shift) => shift.isRest)
  const dedupMap = new Map<string, Shift>()
  const shiftIdMap = new Map<string, string>()

  for (const shift of shifts) {
    const normalized: Shift = {
      id: shift.id,
      name: shift.name,
      color: shift.color || '#409EFF',
      isRest: Boolean(shift.isRest),
      order: typeof shift.order === 'number' ? shift.order : undefined,
      archivedAt: shift.archivedAt ? parseTimestamp(shift.archivedAt) : null,
      createdAt: parseTimestamp(shift.createdAt),
      updatedAt: parseTimestamp(shift.updatedAt),
    }

    if (shift.isRest && defaultRestShift) {
      shiftIdMap.set(shift.id, defaultRestShift.id)
      normalized.id = defaultRestShift.id
      normalized.name = shift.name || defaultRestShift.name
      normalized.color = shift.color || defaultRestShift.color
      normalized.isRest = true
    } else {
      shiftIdMap.set(shift.id, shift.id)
    }

    const previous = dedupMap.get(normalized.id)
    dedupMap.set(normalized.id, previous ? { ...previous, ...normalized } : normalized)
  }

  return {
    shifts: Array.from(dedupMap.values()),
    shiftIdMap,
  }
}

export async function exportConfiguration(includeSchedules: boolean): Promise<ExportConfigPayload> {
  const [people, shifts, extraRestConfigs, scheduleData] = await Promise.all([
    repositories.people.getAllIncludingArchived(),
    repositories.shifts.getAllIncludingArchived(),
    repositories.extraRestConfigs.getAll(),
    includeSchedules ? repositories.schedules.getAll() : Promise.resolve([] as Schedule[]),
  ])

  const { shifts: normalizedShifts } = normalizeImportedShifts(shifts)
  const schedules = includeSchedules
    ? scheduleData.map((schedule) => ({
        ...schedule,
        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt.toISOString(),
      }))
    : undefined

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      people,
      shifts: normalizedShifts,
      extraRestConfigs,
      schedules,
    },
  }
}

export function assertImportPayload(payload: unknown): asserts payload is { data: ImportedConfigData } {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !payload.data ||
    typeof payload.data !== 'object'
  ) {
    throw new Error('无效的配置文件格式')
  }

  const data = payload.data as Partial<ImportedConfigData>
  if (!Array.isArray(data.people) || !Array.isArray(data.shifts)) {
    throw new Error('无效的配置文件格式')
  }
}

export async function importConfiguration(data: ImportedConfigData, options: ImportOptions): Promise<void> {
  const now = getCurrentDateTime()
  const db = await dbManager.getDB()

  const transaction = db.transaction(
    ['people', 'shifts', 'extraRestConfigs', 'schedules'],
    'readwrite'
  )

  if (options.replaceAllBeforeImport) {
    await Promise.all([
      transaction.objectStore('schedules').clear(),
      transaction.objectStore('people').clear(),
      transaction.objectStore('extraRestConfigs').clear(),
      transaction.objectStore('shifts').clear(),
    ])
  }

  const importedPersonIds = new Set<string>()
  const importedShiftIds = new Set<string>()
  const scheduleStore = transaction.objectStore('schedules')
  const importedScheduleMap = new Map<string, ImportedScheduleRecord>()

  for (const person of data.people) {
    if (!person.id || !person.name) {
      continue
    }

    const isArchived = Boolean(person.archivedAt)
    if (isArchived && !options.importArchivedPeople) {
      continue
    }

    const nextPerson: Person = {
      id: person.id,
      name: person.name,
      color: person.color || '#409EFF',
      baseRestDays: typeof person.baseRestDays === 'number' ? person.baseRestDays : 0,
      order: typeof person.order === 'number' ? person.order : undefined,
      createdAt: parseTimestamp(person.createdAt),
      updatedAt: now,
      archivedAt: person.archivedAt ? parseTimestamp(person.archivedAt) : null,
    }

    await transaction.objectStore('people').put(nextPerson)
    importedPersonIds.add(nextPerson.id)
  }

  const { shifts, shiftIdMap } = normalizeImportedShifts(data.shifts)
  for (const shift of shifts) {
    if (!shift.id || !shift.name) {
      continue
    }

    await transaction.objectStore('shifts').put({
      ...shift,
      createdAt: parseTimestamp(shift.createdAt),
      archivedAt: shift.archivedAt ? parseTimestamp(shift.archivedAt) : null,
      updatedAt: now,
    })
    importedShiftIds.add(shift.id)
  }

  for (const config of data.extraRestConfigs || []) {
    if (!config.id || typeof config.year !== 'number' || typeof config.month !== 'number') {
      continue
    }

    await transaction.objectStore('extraRestConfigs').put({
      id: config.id,
      year: config.year,
      month: config.month,
      extraRestDays: typeof config.extraRestDays === 'number' ? config.extraRestDays : 0,
      createdAt: parseTimestamp(config.createdAt),
      updatedAt: now,
    })
  }

  for (const schedule of data.schedules || []) {
    if (!schedule.id || !schedule.personId || !schedule.shiftId || !schedule.date) {
      continue
    }

    if (!options.importArchivedPeople && !importedPersonIds.has(schedule.personId)) {
      continue
    }

    const mappedShiftId = shiftIdMap.get(schedule.shiftId) || schedule.shiftId
    if (!importedShiftIds.has(mappedShiftId)) {
      continue
    }

    importedScheduleMap.set(getScheduleSlotKey(schedule.personId, schedule.date), {
      ...schedule,
      shiftId: mappedShiftId,
    })
  }

  for (const schedule of importedScheduleMap.values()) {
    const existing = await scheduleStore.index('by-personId-date').get([
      schedule.personId,
      schedule.date,
    ])

    if (existing && existing.id !== schedule.id) {
      await scheduleStore.delete(existing.id)
    }

    await scheduleStore.put({
      id: schedule.id,
      personId: schedule.personId,
      shiftId: schedule.shiftId,
      date: schedule.date,
      month: schedule.month || schedule.date.slice(0, 7),
      order: typeof schedule.order === 'number' ? schedule.order : 0,
      createdAt: parseTimestamp(schedule.createdAt),
      updatedAt: parseTimestamp(schedule.updatedAt),
    })
  }

  await transaction.done
}

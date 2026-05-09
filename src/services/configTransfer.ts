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

const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MONTH_REGEX = /^\d{4}-\d{2}$/
const MAX_FILE_SIZE = 10 * 1024 * 1024

export interface ValidationError {
  category: string
  index: number
  field: string
  message: string
}

export class ImportValidationError extends Error {
  errors: ValidationError[]

  constructor(errors: ValidationError[]) {
    const message = errors.length <= 5
      ? errors.map(e => `${e.category}[${e.index}] ${e.field}: ${e.message}`).join('\n')
      : errors.slice(0, 5).map(e => `${e.category}[${e.index}] ${e.field}: ${e.message}`).join('\n')
        + `\n... 及其他 ${errors.length - 5} 条错误`
    super(message)
    this.name = 'ImportValidationError'
    this.errors = errors
  }
}

export function validateImportData(data: ImportedConfigData): void {
  const errors: ValidationError[] = []

  const seenPersonIds = new Set<string>()
  const seenShiftIds = new Set<string>()

  for (let i = 0; i < data.people.length; i++) {
    const p = data.people[i]
    if (!p.id || typeof p.id !== 'string') {
      errors.push({ category: '人员', index: i + 1, field: 'id', message: 'id 不能为空' })
    } else {
      if (seenPersonIds.has(p.id)) {
        errors.push({ category: '人员', index: i + 1, field: 'id', message: `id "${p.id}" 重复` })
      }
      seenPersonIds.add(p.id)
    }
    if (!p.name || typeof p.name !== 'string' || p.name.trim().length === 0) {
      errors.push({ category: '人员', index: i + 1, field: 'name', message: '姓名不能为空' })
    } else if (p.name.length > 20) {
      errors.push({ category: '人员', index: i + 1, field: 'name', message: `姓名长度不能超过20个字符（当前${p.name.length}个）` })
    }
    if (p.color && !COLOR_REGEX.test(p.color)) {
      errors.push({ category: '人员', index: i + 1, field: 'color', message: `颜色格式无效:"${p.color}"（应为 #RRGGBB）` })
    }
    if (p.baseRestDays !== undefined && p.baseRestDays !== null) {
      if (typeof p.baseRestDays !== 'number' || !Number.isInteger(p.baseRestDays) || p.baseRestDays < 0 || p.baseRestDays > 31) {
        errors.push({ category: '人员', index: i + 1, field: 'baseRestDays', message: `基础休息天数必须为 0-31 的整数（当前${p.baseRestDays}）` })
      }
    }
    if (p.order !== undefined && p.order !== null && typeof p.order !== 'number') {
      errors.push({ category: '人员', index: i + 1, field: 'order', message: `排序值必须为数字（当前${typeof p.order}）` })
    }
  }

  for (let i = 0; i < data.shifts.length; i++) {
    const s = data.shifts[i]
    if (!s.id || typeof s.id !== 'string') {
      errors.push({ category: '班次', index: i + 1, field: 'id', message: 'id 不能为空' })
    } else {
      if (seenShiftIds.has(s.id)) {
        errors.push({ category: '班次', index: i + 1, field: 'id', message: `id "${s.id}" 重复` })
      }
      seenShiftIds.add(s.id)
    }
    if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
      errors.push({ category: '班次', index: i + 1, field: 'name', message: '名称不能为空' })
    } else if (s.name.length > 20) {
      errors.push({ category: '班次', index: i + 1, field: 'name', message: `名称长度不能超过20个字符（当前${s.name.length}个）` })
    }
    if (s.color && !COLOR_REGEX.test(s.color)) {
      errors.push({ category: '班次', index: i + 1, field: 'color', message: `颜色格式无效:"${s.color}"（应为 #RRGGBB）` })
    }
    if (s.isRest !== undefined && s.isRest !== null && typeof s.isRest !== 'boolean') {
      errors.push({ category: '班次', index: i + 1, field: 'isRest', message: `isRest 必须为布尔类型（当前${typeof s.isRest}）` })
    }
    if (s.order !== undefined && s.order !== null && typeof s.order !== 'number') {
      errors.push({ category: '班次', index: i + 1, field: 'order', message: `排序值必须为数字（当前${typeof s.order}）` })
    }
  }

  for (let i = 0; i < (data.extraRestConfigs || []).length; i++) {
    const c = (data.extraRestConfigs || [])[i]
    if (typeof c.year !== 'number' || !Number.isInteger(c.year) || c.year < 2000) {
      errors.push({ category: '额外休息配置', index: i + 1, field: 'year', message: `年份无效（当前${c.year}，需 ≥ 2000）` })
    }
    if (typeof c.month !== 'number' || !Number.isInteger(c.month) || c.month < 1 || c.month > 12) {
      errors.push({ category: '额外休息配置', index: i + 1, field: 'month', message: `月份无效（当前${c.month}，需 1-12）` })
    }
    if (c.extraRestDays !== undefined && c.extraRestDays !== null) {
      if (typeof c.extraRestDays !== 'number' || !Number.isInteger(c.extraRestDays) || c.extraRestDays < 0 || c.extraRestDays > 31) {
        errors.push({ category: '额外休息配置', index: i + 1, field: 'extraRestDays', message: `额外休息天数必须为 0-31 整数（当前${c.extraRestDays}）` })
      }
    }
  }

  for (let i = 0; i < (data.schedules || []).length; i++) {
    const sc = (data.schedules || [])[i]
    if (!sc.personId || typeof sc.personId !== 'string') {
      errors.push({ category: '排班', index: i + 1, field: 'personId', message: 'personId 不能为空' })
    }
    if (!sc.shiftId || typeof sc.shiftId !== 'string') {
      errors.push({ category: '排班', index: i + 1, field: 'shiftId', message: 'shiftId 不能为空' })
    }
    if (!sc.date || typeof sc.date !== 'string' || !DATE_REGEX.test(sc.date)) {
      errors.push({ category: '排班', index: i + 1, field: 'date', message: `日期格式无效:"${sc.date}"（应为 YYYY-MM-DD）` })
    }
    if (sc.month && !MONTH_REGEX.test(sc.month)) {
      errors.push({ category: '排班', index: i + 1, field: 'month', message: `月份格式无效:"${sc.month}"（应为 YYYY-MM）` })
    }
    if (sc.order !== undefined && sc.order !== null && typeof sc.order !== 'number') {
      errors.push({ category: '排班', index: i + 1, field: 'order', message: `排序值必须为数字（当前${typeof sc.order}）` })
    }
    if (sc.personId && typeof sc.personId === 'string' && !seenPersonIds.has(sc.personId)) {
      errors.push({ category: '排班', index: i + 1, field: 'personId', message: `引用了不存在的人员 id "${sc.personId}"` })
    }
    if (sc.shiftId && typeof sc.shiftId === 'string' && !seenShiftIds.has(sc.shiftId)) {
      errors.push({ category: '排班', index: i + 1, field: 'shiftId', message: `引用了不存在的班次 id "${sc.shiftId}"` })
    }
  }

  if (errors.length > 0) {
    throw new ImportValidationError(errors)
  }
}

export function checkImportFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`文件过大（${sizeMB}MB），导入文件不能超过 10MB`)
  }
}

export async function importConfiguration(data: ImportedConfigData, options: ImportOptions): Promise<void> {
  validateImportData(data)

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

import { computed, ref } from 'vue'
import type { Person, Schedule, Shift } from '@/types'

export function useScheduleViewData() {
  const people = ref<Person[]>([])
  const shifts = ref<Shift[]>([])
  const schedules = ref<Schedule[]>([])
  const loading = ref(false)

  const activePeople = computed(() =>
    people.value.filter((person) => !person.archivedAt)
  )

  const personMap = computed(() => {
    const map = new Map<string, Person>()
    people.value.forEach((person) => map.set(person.id, person))
    return map
  })

  const shiftMap = computed(() => {
    const map = new Map<string, Shift>()
    shifts.value.forEach((shift) => map.set(shift.id, shift))
    return map
  })

  const activeShifts = computed(() =>
    shifts.value.filter((shift) => !shift.archivedAt)
  )

  const visibleShifts = computed(() => {
    const usedShiftIds = new Set(schedules.value.map((schedule) => schedule.shiftId))
    return shifts.value.filter(
      (shift) => !shift.archivedAt || usedShiftIds.has(shift.id)
    )
  })

  const isPersonArchived = (personId: string) =>
    Boolean(personMap.value.get(personId)?.archivedAt)

  const isShiftArchived = (shiftId: string) =>
    Boolean(shiftMap.value.get(shiftId)?.archivedAt)

  const isScheduleEditable = (personId: string, shiftId: string) =>
    !isPersonArchived(personId) && !isShiftArchived(shiftId)

  const mergeSchedules = (...items: Schedule[]) => {
    const map = new Map(schedules.value.map((schedule) => [schedule.id, schedule]))
    for (const item of items) {
      map.set(item.id, item)
    }
    schedules.value = Array.from(map.values())
  }

  const replaceSchedules = (updatedSchedules: Schedule[]) => {
    if (updatedSchedules.length === 0) return
    const map = new Map(updatedSchedules.map((schedule) => [schedule.id, schedule]))
    schedules.value = schedules.value.map((schedule) => map.get(schedule.id) || schedule)
  }

  const removeSchedulesByIds = (ids: string[]) => {
    if (ids.length === 0) return
    const deletedIds = new Set(ids)
    schedules.value = schedules.value.filter((schedule) => !deletedIds.has(schedule.id))
  }

  return {
    activePeople,
    activeShifts,
    isPersonArchived,
    isScheduleEditable,
    isShiftArchived,
    loading,
    mergeSchedules,
    people,
    personMap,
    removeSchedulesByIds,
    replaceSchedules,
    schedules,
    shiftMap,
    shifts,
    visibleShifts,
  }
}

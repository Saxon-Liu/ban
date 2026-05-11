<template>
  <div class="person-calendar-view">
    <el-scrollbar class="content-scrollbar" v-loading="loading">
      <div class="content" ref="calendarWrapperRef">
        <draggable
          :model-value="selectedPeople"
          @update:model-value="handleDragUpdate"
          tag="div"
          :class="['calendar-flex', layoutClass]"
          item-key="id"
          handle=".drag-handle"
          :animation="300"
          ghost-class="ghost-card"
          chosen-class="chosen-card"
          drag-class="drag-card"
        >
          <template #item="{ element: person }">
            <div class="calendar-card" :key="person.id">
              <el-calendar
                :model-value="calendarAnchor"
                :range="calendarRange"
                :first-day-of-week="1"
              >
                <template #header>
                  <div class="calendar-card__header">
                    <div class="person-meta drag-handle">
                      <span
                        class="color-dot"
                        :style="{ backgroundColor: person.color }"
                      />
                      <div>
                        <div class="person-name">{{ getPersonDisplayName(person) }}</div>
                        <div class="person-meta__sub">{{ monthLabel }}</div>
                      </div>
                      <div class="rest-days-tags">
                        <el-tag
                          v-if="person.baseRestDays"
                          size="small"
                          type="info"
                        >
                          月休 {{ person.baseRestDays }} 天
                        </el-tag>
                        <el-tag
                          v-if="getRemainingRestDays(person.id) !== null"
                          size="small"
                          :type="getRemainingRestDays(person.id)! > 0 ? 'success' : getRemainingRestDays(person.id)! === 0 ? 'primary' : 'danger'"
                        >
                          {{
                            getRemainingRestDays(person.id)! < 0
                              ? `超休${Math.abs(getRemainingRestDays(person.id)!)}天`
                              : getRemainingRestDays(person.id)! === 0
                                ? "已休满"
                                : `剩余 ${getRemainingRestDays(person.id)} 天`
                          }}
                        </el-tag>
                      </div>
                    </div>
                    <div class="header-actions">
                      <div class="card-actions">
                        <el-select
                          v-model="switchPersonSelections[person.id]"
                          class="person-switch-select"
                          size="small"
                          filterable
                          clearable
                          placeholder="搜索切换"
                          :disabled="getReplaceCandidates(person.id).length === 0"
                          @change="(value: string) => handleReplacePersonSelect(person.id, value)"
                        >
                          <el-option
                            v-for="candidate in getReplaceCandidates(person.id)"
                            :key="candidate.id"
                            :label="getPersonDisplayName(candidate)"
                            :value="candidate.id"
                          >
                            <span class="dropdown-person-option">
                              <span
                                class="color-dot"
                                :style="{ backgroundColor: candidate.color }"
                              />
                              <span>{{ getPersonDisplayName(candidate) }}</span>
                            </span>
                          </el-option>
                        </el-select>
                        <el-button
                          text
                          size="small"
                          type="danger"
                          @click.stop="removePersonCard(person.id)"
                          >移除</el-button
                        >
                        <el-tooltip content="清空该人员当月排班" placement="top">
                          <el-button
                            text
                            size="small"
                            type="danger"
                            :disabled="isPersonClearing(person.id)"
                            @click.stop="handleClearPersonSchedules(person)"
                          >
                            清空当月
                          </el-button>
                        </el-tooltip>
                      </div>
                    </div>
                  </div>
                </template>
                <template #date-cell="{ data }">
                  <div
                    class="calendar-date-cell"
                    :class="[
                      { 'is-outside-month': !isCurrentMonthDate(data.day) },
                      getHolidayCellClass(data.day),
                    ]"
                    @click="handleCellClick(person.id, data.day, $event)"
                  >
                    <div class="date-top">
                      <span
                        class="day"
                        :class="{ 'is-weekend': isWeekend(data.day) && !getHolidayEntry(data.day) }"
                        >{{ formatMonthDay(data.day) }}</span
                      >
                      <el-tooltip
                        v-if="getHolidayEntry(data.day)"
                        :content="`${getHolidayEntry(data.day)?.label}（${getHolidayEntry(data.day)?.typeLabel}）`"
                        placement="top"
                        effect="light"
                      >
                        <span
                          class="holiday-badge"
                          :class="getHolidayEntry(data.day)?.type"
                        >
                          {{ getHolidayEntry(data.day)?.marker }}
                          {{ getHolidayEntry(data.day)?.label }}
                        </span>
                      </el-tooltip>
                      <!-- <span
                        class="weekday"
                        :class="{ 'is-weekend': isWeekend(data.day) }"
                      >{{ getWeekdayLabel(data.day) }}</span> -->
                    </div>
                    <div class="date-content">
                      <template v-if="getSchedule(person.id, data.day)">
                        <el-tag
                          size="default"
                          class="shift-tag"
                          disable-transitions
                          :closable="
                            isScheduleEditable(
                              person.id,
                              getSchedule(person.id, data.day)!.shiftId
                            )
                          "
                          :style="getShiftTagStyle(getSchedule(person.id, data.day)!.shiftId)"
                          @close.stop="removeSchedule(person.id, data.day)"
                        >
                          {{
                            getShiftName(
                              getSchedule(person.id, data.day)!.shiftId
                            )
                          }}
                        </el-tag>
                      </template>
                      <template v-else>
                        <span class="placeholder">未排班</span>
                      </template>
                    </div>
                    <!-- <div class="cell-actions">
                      <el-button
                        text
                        type="primary"
                        size="small"
                        @click.stop="
                          handleCellClick(person.id, data.day, $event)
                        "
                        >点击进行排班</el-button
                      >
                    </div> -->
                  </div>
                </template>
              </el-calendar>
            </div>
          </template>
        </draggable>
        <div
          v-if="selectedPersonIds.length !== 4"
          :class="[
            'empty-state',
            selectedPersonIds.length > 0 ? 'is-compact' : 'is-empty',
          ]"
        >
          <template v-if="selectedPersonIds.length === 0">
            <el-empty :image-size="120">
              <template #description>
                <el-select
                  v-model="addPersonSelection"
                  class="person-add-select empty"
                  size="small"
                  filterable
                  clearable
                  placeholder="搜索姓名后添加"
                  :disabled="availablePeople.length === 0"
                  @change="handleAddPersonSelect"
                >
                  <el-option
                    v-for="person in availablePeople"
                    :key="person.id"
                    :label="getPersonDisplayName(person)"
                    :value="person.id"
                  >
                    <span class="dropdown-person-option">
                      <span
                        class="color-dot"
                        :style="{ backgroundColor: person.color }"
                      />
                      <span>{{ getPersonDisplayName(person) }}</span>
                    </span>
                  </el-option>
                </el-select>
              </template>
            </el-empty>
          </template>
          <template v-else>
            <div class="empty-state__compact-copy">
              <div class="empty-state__title">继续添加人员</div>
              <div class="empty-state__subtitle">
                当前最多可同时展示 4 人日历
              </div>
            </div>
            <el-select
              v-model="addPersonSelection"
              class="person-add-select"
              size="small"
              filterable
              clearable
              placeholder="搜索后添加"
              :disabled="availablePeople.length === 0"
              @change="handleAddPersonSelect"
            >
              <el-option
                v-for="person in availablePeople"
                :key="person.id"
                :label="getPersonDisplayName(person)"
                :value="person.id"
              >
                <span class="dropdown-person-option">
                  <span
                    class="color-dot"
                    :style="{ backgroundColor: person.color }"
                  />
                  <span>{{ getPersonDisplayName(person) }}</span>
                </span>
              </el-option>
            </el-select>
          </template>
        </div>
      </div>
    </el-scrollbar>

    <el-popover
      v-model:visible="quickSelect.visible"
      trigger="manual"
      placement="bottom"
      width="220"
      :virtual-triggering="true"
      :virtual-ref="quickSelect.triggerEl"
      @hide="closeQuickSelect"
    >
      <template #default>
        <div class="quick-select">
          <div class="quick-select__title">选择班次</div>
          <el-scrollbar max-height="200px">
            <el-button
              v-for="shift in activeShifts"
              :key="shift.id"
              text
              :style="{ justifyContent: 'flex-start', width: '100%' }"
              @click="handleQuickSelectShift(shift.id)"
            >
              <span
                class="color-dot"
                :style="{ backgroundColor: getShiftColor(shift.id) }"
              />
              <span class="quick-select__name">{{ shift.name }}</span>
              <el-tag
                v-if="shift.isRest"
                size="small"
                type="warning"
                effect="plain"
                >休</el-tag
              >
            </el-button>
          </el-scrollbar>
        </div>
      </template>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRef,
  watch,
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import draggable from "vuedraggable";
import dayjs from "dayjs";
import type { ExtraRestConfig, Person, Schedule } from "@/types";
import { repositories } from "@/repositories";
import { useScheduleViewData } from "@/composables/useScheduleViewData";
import {
  buildPersonStatistics,
  getRestShiftId,
  holidayService,
  scheduleService,
} from "@/services";
import type { EffectiveHolidayEntry } from "@/services";
import {
  getIdDisplaySuffix,
  getAdaptiveTextColor,
  getNextMonth,
  getPreviousMonth,
  sortByOrder,
} from "@/utils";

const props = withDefaults(
  defineProps<{
    currentMonth?: string | null;
  }>(),
  {
    currentMonth: null,
  }
);

const emit = defineEmits<{
  (e: "update:current-month", value: string): void;
}>();

const SELECTED_PERSON_IDS_KEY = "person_calendar_selected_ids";

const getInitialSelectedPersonIds = () => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SELECTED_PERSON_IDS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch (error) {
    console.warn("[person-calendar] Failed to parse saved selection", error);
    return [];
  }
};

const persistSelectedPersonIds = (ids: string[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_PERSON_IDS_KEY, JSON.stringify(ids));
};

const currentMonth = toRef(props, "currentMonth");
const {
  activePeople,
  activeShifts,
  isScheduleEditable,
  loading,
  mergeSchedules,
  people,
  removeSchedulesByIds,
  schedules,
  shiftMap,
  shifts,
} = useScheduleViewData();
const extraRestConfigs = ref<Map<string, ExtraRestConfig>>(new Map());
const holidayDateMap = ref<Map<string, EffectiveHolidayEntry>>(new Map());
const selectedPersonIds = ref<string[]>(getInitialSelectedPersonIds());
const addPersonSelection = ref("");
const switchPersonSelections = reactive<Record<string, string>>({});
const calendarWrapperRef = ref<HTMLElement | null>(null);
const wrapperWidth = ref(0);
const personClearingMap = reactive<Record<string, boolean>>({});

const TWO_COL_THRESHOLD = 1800;
let resizeObserver: ResizeObserver | null = null;

const quickSelect = reactive<{
  visible: boolean;
  personId: string;
  date: string;
  triggerEl: HTMLElement | null;
}>({
  visible: false,
  personId: "",
  date: "",
  triggerEl: null,
});

const calendarAnchor = computed(() =>
  dayjs(`${currentMonth.value}-01`).toDate()
);
const calendarRange = computed(() => {
  const anchor = dayjs(`${currentMonth.value}-01`);
  const start = anchor.subtract(1, "month").startOf("month");
  const end = anchor.add(1, "month").endOf("month");
  return [start.toDate(), end.toDate()] as [Date, Date];
});

const monthLabel = computed(() =>
  dayjs(`${currentMonth.value}-01`).format("YYYY年MM月")
);

const scheduleMap = computed(() => {
  const map = new Map<string, Schedule>();
  schedules.value.forEach((schedule) => {
    map.set(`${schedule.personId}-${schedule.date}`, schedule);
  });
  return map;
});

const selectedPeople = computed(() =>
  selectedPersonIds.value
    .map((id) => people.value.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p))
);

const personNameDuplicateMap = computed(() => {
  const counts = new Map<string, number>();
  people.value.forEach((person) => {
    const key = person.name.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
});

const getPersonDisplayName = (person: Pick<Person, "id" | "name">) => {
  const duplicateCount = personNameDuplicateMap.value.get(person.name.trim()) || 0;
  if (duplicateCount <= 1) return person.name;
  return `${person.name} (${getIdDisplaySuffix(person.id)})`;
};

const availablePeople = computed(() =>
  activePeople.value.filter((person) => !selectedPersonIds.value.includes(person.id))
);

const getReplaceCandidates = (_targetId: string) => availablePeople.value;

const layoutClass = computed<"flex-single-col" | "flex-two-cols">(() => {
  const count = selectedPeople.value.length;
  if (count <= 1) {
    return "flex-single-col";
  }

  if (!wrapperWidth.value) {
    return "flex-single-col";
  }

  return wrapperWidth.value >= TWO_COL_THRESHOLD
    ? "flex-two-cols"
    : "flex-single-col";
});

const extraRestDaysForCurrentMonth = computed(() => {
  if (!currentMonth.value) return 0;
  const [year, month] = currentMonth.value.split("-").map(Number);
  const config = extraRestConfigs.value.get(`${year}-${month}`);
  return config?.extraRestDays || 0;
});

const currentMonthSchedules = computed(() =>
  schedules.value.filter((schedule) => schedule.month === currentMonth.value)
);

const remainingRestDayMap = computed(() => {
  if (!currentMonth.value) return new Map<string, number>();
  const restShiftId = getRestShiftId(shifts.value);
  const map = new Map<string, number>();
  for (const person of people.value) {
    const stats = buildPersonStatistics({
      person,
      month: currentMonth.value,
      schedules: currentMonthSchedules.value,
      extraRestDays: extraRestDaysForCurrentMonth.value,
      restShiftId,
    });
    map.set(person.id, stats.remainingRestDays);
  }
  return map;
});

const getRemainingRestDays = (personId: string): number | null => {
  const person = people.value.find((p) => p.id === personId);
  if (!person) return null;
  return remainingRestDayMap.value.get(personId) ?? null;
};

const handleDragUpdate = (newPeople: Person[]) => {
  selectedPersonIds.value = newPeople.map((p) => p.id);
};

const loadBaseData = async () => {
  const [peopleData, shiftData, extraRestConfigData] = await Promise.all([
    repositories.people.getAll(),
    repositories.shifts.getAllIncludingArchived(),
    repositories.extraRestConfigs.getAll(),
  ]);

  people.value = sortByOrder(peopleData, { fallbackOrder: 999 });
  shifts.value = sortByOrder(shiftData, { fallbackOrder: 999 });
  extraRestConfigs.value = new Map(
    extraRestConfigData.map((config) => [`${config.year}-${config.month}`, config])
  );

  selectedPersonIds.value = selectedPersonIds.value
    .filter((id) => peopleData.some((p) => p.id === id))
    .slice(0, 4);
};

const loadSchedules = async () => {
  if (!currentMonth.value) return;
  
  const targetMonths = [
    getPreviousMonth(currentMonth.value),
    currentMonth.value,
    getNextMonth(currentMonth.value),
  ];

  const results = await Promise.all(
    targetMonths.map((month) => repositories.schedules.getByMonth(month))
  );

  schedules.value = results.flat();
};

const loadHolidayData = async () => {
  if (!currentMonth.value) return;
  await holidayService.ensureBuiltinHolidays();

  const targetMonths = [
    getPreviousMonth(currentMonth.value),
    currentMonth.value,
    getNextMonth(currentMonth.value),
  ];
  const results = await Promise.all(
    targetMonths.map((month) =>
      holidayService.getEffectiveMonthDateMap("CN", month)
    )
  );
  holidayDateMap.value = new Map(
    results.flatMap((monthMap) => Array.from(monthMap.entries()))
  );
};

const loadData = async () => {
  loading.value = true;
  try {
    await loadBaseData();
    await loadSchedules();
    await loadHolidayData();
  } catch (error) {
    console.error("加载人员或班次失败", error);
    ElMessage.error("加载失败，请稍后再试");
  } finally {
    loading.value = false;
  }
};

const setMonth = async (month: string) => {
  if (!month || month === currentMonth.value) return;
  emit("update:current-month", month);
};

const getSchedule = (personId: string, date: string) => {
  return scheduleMap.value.get(`${personId}-${date}`) || null;
};

const getShiftName = (shiftId: string) =>
  shiftMap.value.get(shiftId)?.name || "未知班次";

const getShiftColor = (shiftId: string) =>
  shiftMap.value.get(shiftId)?.color || "#409EFF";

const getShiftTagStyle = (shiftId: string) => {
  const backgroundColor = getShiftColor(shiftId);
  const textColor = getAdaptiveTextColor(backgroundColor);
  return {
    backgroundColor,
    color: textColor,
    borderColor: "transparent",
    "--shift-tag-text-color": textColor,
  };
};

const formatMonthDay = (date: string) => dayjs(date).format("MM-DD");

const isCurrentMonthDate = (date: string) =>
  currentMonth.value && dayjs(date).format("YYYY-MM") === currentMonth.value;

const isWeekend = (date: string) => {
  const day = dayjs(date).day();
  return day === 0 || day === 6;
};

const getHolidayEntry = (date: string) => holidayDateMap.value.get(date) || null;

const getHolidayCellClass = (date: string) => {
  const holiday = getHolidayEntry(date);
  if (holiday?.type === "public_holiday") return "is-holiday";
  if (holiday?.type === "transfer_workday") return "is-transfer-workday";
  return "";
};

const assignShiftToPerson = async (
  personId: string,
  shiftId: string,
  date: string
) => {
  try {
    const result = await scheduleService.assignShiftToPerson({
      personId,
      shiftId,
      date,
    });
    if (result.outcome === "same-shift") {
      ElMessage.info("该日期已是此班次");
      return;
    }
    if (result.schedule) {
      mergeSchedules(result.schedule);
    }
    ElMessage.success(result.outcome === "updated" ? "已更新班次" : "排班成功");
  } catch (error: any) {
    if (error === "cancel") return;
    console.error("排班失败", error);
    ElMessage.error("排班失败，请稍后再试");
  }
};

const removeSchedule = async (personId: string, date: string) => {
  const schedule = getSchedule(personId, date);
  if (!schedule) return;

  try {
    const removed = await scheduleService.removeScheduleByIdentity(
      personId,
      date,
      schedule.shiftId
    );
    if (removed) {
      removeSchedulesByIds([removed.id]);
    }
    ElMessage.success("已删除排班");
  } catch (error) {
    console.error("删除排班失败", error);
    ElMessage.error("删除排班失败，请稍后再试");
  }
};

const handleCellClick = (personId: string, date: string, event: Event) => {
  const existingSchedule = getSchedule(personId, date);
  if (
    existingSchedule &&
    !isScheduleEditable(personId, existingSchedule.shiftId)
  ) {
    ElMessage.warning("该历史排班关联人员或班次已删除，只允许查看，不可修改");
    return;
  }
  quickSelect.personId = personId;
  quickSelect.date = date;
  quickSelect.triggerEl = event.currentTarget as HTMLElement;
  quickSelect.visible = true;
};

const closeQuickSelect = () => {
  quickSelect.visible = false;
  quickSelect.personId = "";
  quickSelect.date = "";
  quickSelect.triggerEl = null;
};

const handleQuickSelectShift = async (shiftId: string) => {
  if (!quickSelect.personId || !quickSelect.date) return;
  await assignShiftToPerson(quickSelect.personId, shiftId, quickSelect.date);
  closeQuickSelect();
};

const addPersonById = (personId: string) => {
  if (!personId) return;
  if (selectedPersonIds.value.includes(personId)) {
    ElMessage.warning("该人员已在列表中");
    return;
  }
  if (selectedPersonIds.value.length >= 4) {
    ElMessage.warning("最多选择 4 人");
    return;
  }
  selectedPersonIds.value = [...selectedPersonIds.value, personId];
};

const handleAddPersonSelect = (personId: string) => {
  if (!personId) return;
  addPersonById(personId);
  addPersonSelection.value = "";
};

const removePersonCard = (personId: string) => {
  selectedPersonIds.value = selectedPersonIds.value.filter(
    (id) => id !== personId
  );
};

const replacePersonCard = (targetId: string, newId: string) => {
  if (targetId === newId) return;
  if (selectedPersonIds.value.includes(newId)) {
    ElMessage.warning("该人员已在列表中");
    return;
  }
  selectedPersonIds.value = selectedPersonIds.value.map((id) =>
    id === targetId ? newId : id
  );
};

const handleReplacePersonSelect = (targetId: string, newId: string) => {
  if (!newId) return;
  replacePersonCard(targetId, newId);
  switchPersonSelections[targetId] = "";
};

const isPersonClearing = (personId: string) => personClearingMap[personId] === true;

const handleClearPersonSchedules = async (person: Person) => {
  if (personClearingMap[person.id]) return;
  if (!currentMonth.value) {
    ElMessage.warning("请选择要清空的月份");
    return;
  }

  personClearingMap[person.id] = true;
  let clearError: unknown = null;
  let clearResult: "empty" | "cleared" | null = null;
  try {
    await ElMessageBox.confirm(
      `确认 <strong style="color: var(--el-color-danger);">清空 ${person.name} 在 ${currentMonth.value} 的所有排班</strong>？<br/>此操作 <strong style="color: var(--el-color-danger);">不可恢复</strong>！`,
      "清空个人排班",
      {
        confirmButtonText: "确认清空",
        cancelButtonText: "取消",
        type: "warning",
        confirmButtonClass: "el-button--danger",
        cancelButtonClass: "el-button--primary",
        dangerouslyUseHTMLString: true,
        beforeClose: async (action, instance, done) => {
          if (action !== "confirm") {
            done();
            return;
          }

          const previousText = instance.confirmButtonText;
          instance.confirmButtonLoading = true;
          instance.confirmButtonText = "清空中...";
          try {
            const personSchedules =
              await repositories.schedules.getByPersonAndMonth(
                person.id,
                currentMonth.value!
              );

            if (personSchedules.length === 0) {
              clearResult = "empty";
            } else {
              await scheduleService.clearPersonMonthSchedules(
                person.id,
                currentMonth.value!
              );
              clearResult = "cleared";
            }
          } catch (error) {
            clearError = error;
          } finally {
            instance.confirmButtonLoading = false;
            instance.confirmButtonText = previousText;
            done();
          }
        },
      }
    );
  } catch {
    personClearingMap[person.id] = false;
    return;
  }

  try {
    if (clearError) {
      throw clearError;
    }

    if (clearResult === "empty") {
      ElMessage.info(`${person.name} 在当前月份暂无排班`);
      return;
    }

    schedules.value = schedules.value.filter(
      (schedule) =>
        !(
          schedule.personId === person.id &&
          schedule.month === currentMonth.value
        )
    );

    ElMessage.success(`已清空 ${person.name} 在当前月的排班`);
  } catch (error) {
    console.error("清空个人排班失败", error);
    ElMessage.error("清空个人排班失败，请稍后重试");
  } finally {
    personClearingMap[person.id] = false;
  }
};

const updateWrapperWidth = () => {
  if (calendarWrapperRef.value) {
    wrapperWidth.value = calendarWrapperRef.value.clientWidth;
  }
};

const setupResizeObserver = () => {
  resizeObserver?.disconnect?.();

  if (!calendarWrapperRef.value) {
    return;
  }

  updateWrapperWidth();

  if (typeof ResizeObserver === "undefined") return;

  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) {
      wrapperWidth.value = entry.contentRect.width;
    }
  });

  resizeObserver.observe(calendarWrapperRef.value);
};

onMounted(() => {
  loadData();
  nextTick(() => {
    setupResizeObserver();
  });
});

watch(
  currentMonth,
  async (newMonth) => {
    if (newMonth) {
      await loadSchedules();
      await loadHolidayData();
    }
  }
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.();
  resizeObserver = null;
});

watch(
  () => calendarWrapperRef.value,
  () => {
    nextTick(() => {
      setupResizeObserver();
    });
  }
);

watch(
  selectedPersonIds,
  (val) => {
    persistSelectedPersonIds(val);
  },
  { deep: false }
);

defineExpose({
  currentMonth,
  setMonth,
  loadData,
});
</script>

<style lang="scss" scoped>
.person-calendar-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 130px);
}

.content-scrollbar {
  flex: 1;
  min-height: 0;
}

.content {
  min-width: 0;
  padding: 8px;
}

.person-switch-select {
  width: 120px;
}

.person-add-select {
  width: 160px;
}

.person-add-select.empty {
  width: 220px;
}

/* 布局相关 */
.calendar-flex {
  display: flex;
  gap: 16px;
  min-height: 100%;

  &.flex-single-col {
    flex-direction: column;
  }

  &.flex-two-cols {
    flex-wrap: wrap;

    .calendar-card {
      width: calc(50% - 8px);
      min-width: 900px;
      flex: 1 1 calc(50% - 8px);
    }
  }
}

/* 日历卡片 */
.calendar-card {
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
  min-width: 900px;
  width: 100%;

  &:hover {
    box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.15);
  }
}

.calendar-card__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  // background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
  transition: all 0.3s ease;

  &.drag-handle {
    cursor: move;
    cursor: grab;
    user-select: none;

    &:active {
      cursor: grabbing;
    }

    &:hover {
      background: var(--el-fill-color);
    }
  }

  .person-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    .person-name {
      font-weight: 600;
      color: var(--el-text-color-primary);
      font-size: 16px;
      line-height: 1.4;
    }

    .person-meta__sub {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      margin-top: 2px;
      font-weight: 500;
    }

    .rest-days-tags {
      display: flex;
      gap: 6px;
      flex-direction: column;
      flex-wrap: wrap;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

/* 颜色点 */
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 8px;
}

.dropdown-person-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 日历单元格 */
.calendar-date-cell {
  height: 100%;
  min-height: 50px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 6px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s;
  background-color: var(--el-fill-color-light);
  border: 1px dashed var(--el-border-color);

  &:hover {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);

    .cell-actions {
      opacity: 1;
    }
  }

  &.is-outside-month {
    opacity: 0.35;

    .day {
      color: var(--el-text-color-disabled);
    }
  }

  &.is-holiday {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);

    .day {
      color: var(--el-color-primary);
    }
  }

  &.is-transfer-workday {
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-7);

    .day {
      color: var(--el-color-danger);
    }
  }
}

.date-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;

  .day {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1;
    &.is-weekend {
      color: var(--el-color-warning);
      font-weight: 600;
    }
  }

  .holiday-badge {
    max-width: 92px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
    line-height: 16px;

    &.public_holiday {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-8);
      border: 1px solid var(--el-color-primary-light-6);
    }

    &.transfer_workday {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-8);
      border: 1px solid var(--el-color-danger-light-6);
    }
  }

  // .weekday {
  //   font-size: 12px;
  //   // color: var(--el-text-color-secondary);
  //   font-weight: 500;

  //   &.is-weekend {
  //     color: var(--el-color-warning);
  //     font-weight: 600;
  //   }
  // }
}

.date-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  min-height: 32px;

  .shift-tag {
    font-weight: 500;
    font-size: 13px;
    padding: 4px 10px;
    border-radius: 4px;
    border-color: transparent;
    min-width: 88px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    color: var(--shift-tag-text-color, var(--el-color-white));

    :deep(.el-tag__close) {
      color: inherit;
    }
  }

  .placeholder {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    opacity: 0.6;
  }
}

.cell-actions {
  opacity: 0;
  transition: opacity 0.2s ease;
  display: flex;
  justify-content: center;
  padding-top: 4px;

  .el-button {
    font-size: 12px;
    padding: 4px 8px;
    height: auto;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 32px;
  background: var(--el-fill-color-light);
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  margin: 16px 0;

  &.is-compact {
    min-height: auto;
    padding: 16px 18px;
    justify-content: space-between;
    gap: 16px;
    background: var(--el-fill-color);
    flex-wrap: wrap;
  }

  &__compact-copy {
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  &__subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }
}

/* 快速选择弹窗 */
.quick-select {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;

  &__title {
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
    padding-left: 4px;
    font-size: 14px;
  }

  .el-button {
    gap: 8px;
    margin-left: 0 !important;
    justify-content: flex-start;
    padding: 8px 12px;
    border-radius: 6px;
    transition: all 0.3s;

    &:hover {
      background-color: var(--el-fill-color-light);
      color: var(--el-color-primary);
    }
  }

  .quick-select__name {
    flex: 1;
    text-align: left;
    font-size: 14px;
  }
}

/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0, 0.1, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 拖拽状态样式 */
.ghost-card {
  opacity: 0.4;
  background: var(--el-fill-color-light);
  border: 2px dashed var(--el-color-primary);

  .calendar-card__header {
    background: transparent;
  }

  * {
    visibility: hidden;
  }
}

.chosen-card {
  box-shadow: 0 8px 24px 0 rgba(0, 0, 0, 0.2);
  transform: scale(1.02);

  .calendar-card__header {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }
}

.drag-card {
  opacity: 0.9;
  transform: rotate(3deg);
  box-shadow: 0 12px 32px 0 rgba(0, 0, 0, 0.25);
  cursor: grabbing !important;

  .calendar-card__header {
    cursor: grabbing !important;
  }
}

/* Element Plus 日历组件样式覆盖 */
:deep(.el-calendar) {
  --el-calendar-border: 1px solid var(--el-border-color);
  background-color: transparent;
}

:deep(.el-calendar__header) {
  padding: 16px 10px;
  border-bottom: none;
}

:deep(.el-calendar__body) {
  padding: 12px;
}

:deep(.el-calendar-table) {
  thead th {
    font-weight: 600;
    color: var(--el-text-color-regular);
    padding: 12px 8px;
    font-size: 13px;
    background-color: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
  }

  td {
    border: 1px solid var(--el-border-color);
    padding: 4px;
    transition: all 0.3s;
    height: 110px;
    vertical-align: top;

    &.is-selected {
      background-color: var(--el-color-primary-light-9);
    }
  }

  .el-calendar-day {
    padding: 0;
    height: 100%;
    display: block;
  }
}
</style>

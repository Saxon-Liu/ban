<template>
  <div ref="scheduleTableViewRef" class="schedule-table-view">
    <div class="schedule-container" v-loading="loading">
      <!-- 左侧人员列表 -->
      <div class="people-sidebar">
        <div class="people-sidebar-header">
          <h3>人员列表</h3>
          <el-input
            v-model="peopleSearch"
            size="small"
            clearable
            placeholder="搜索"
            class="people-search-input"
          />
        </div>
        <div class="people-list">
          <el-scrollbar>
            <div v-if="filteredPeopleWithStats.length === 0" class="people-empty">
              {{ peopleSearch.trim() ? "未找到匹配人员" : "暂无人员数据" }}
            </div>
            <div
              v-for="person in filteredPeopleWithStats"
              :key="person.id"
              class="person-tag"
              :draggable="true"
              @dragstart="handlePersonDragStart($event, person)"
              @dragend="handleDragEnd"
            >
              <div
                class="person-color"
                :style="{ backgroundColor: person.color }"
              ></div>
              <div class="person-info">
                <span class="person-name">{{ person.name }}</span>
                <span class="person-base-rest">
                  月休
                  {{
                    person.statistics
                      ? person.statistics.baseRestDays + person.statistics.extraRestDays
                      : person.baseRestDays
                  }}
                  天
                </span>
                <span
                  class="person-rest-days"
                  :class="{
                    'over-rest': person.statistics?.isOverRest,
                    'full-rest':
                      person.statistics && person.statistics.remainingRestDays === 0,
                  }"
                >
                  {{
                    person.statistics
                      ? person.statistics.isOverRest
                        ? `超休${Math.abs(
                            person.statistics.remainingRestDays
                          )}天`
                        : person.statistics.remainingRestDays === 0
                          ? "已休满"
                          : `剩余休息${person.statistics.remainingRestDays}天`
                      : "加载中..."
                  }}
                </span>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <!-- 右侧排班表格 -->
      <div class="schedule-table-container">
        <el-table
          :data="monthDates"
          style="width: 100%"
          border
          size="small"
          height="calc(100vh - 190px)"
          :row-class-name="getScheduleRowClassName"
        >
          <el-table-column prop="date" label="日期" width="100" fixed>
            <template #default="{ row }">
              <div class="date-cell">
                <div :class="['date', getDateCellClass(row.date, row.weekdayName)]">
                  {{ formatDate(row.date, "MM-DD") }}
                </div>
                <div :class="['weekday', getDateCellClass(row.date, row.weekdayName)]">
                  {{ row.weekdayName }}
                </div>
                <el-tooltip
                  v-if="getHolidayEntry(row.date)"
                  :content="`${getHolidayEntry(row.date)?.label}（${getHolidayEntry(row.date)?.typeLabel}）`"
                  placement="top"
                  effect="light"
                >
                  <div
                    class="holiday-chip"
                    :class="getHolidayEntry(row.date)?.type"
                  >
                    {{ getHolidayEntry(row.date)?.marker }}
                    {{ getHolidayEntry(row.date)?.label }}
                  </div>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-for="shift in visibleShifts"
            :key="shift.id"
            :label="getShiftDisplayName(shift.id)"
            min-width="150"
          >
            <template #default="{ row }">
              <template
                v-for="cell in getScheduleCellViewList(
                  row.date,
                  row.weekdayName,
                  shift.id
                )"
                :key="cell.key"
              >
                <!-- 占位撑开 cell 高度，使用轻量 DOM 避免重复渲染 el-tag -->
                <div
                  class="schedule-cell-spacer"
                  :class="{
                    'has-cell-side-rail':
                      cell.canDrag || showCellTransferActions(cell.date, cell.shiftId),
                  }"
                >
                  <span
                    v-for="person in cell.people"
                    :key="person.id"
                    class="schedule-cell-spacer-tag"
                  >
                    {{ person.name }}
                    <span v-if="person.archived" class="archived-badge">
                      已删除
                    </span>
                  </span>
                </div>
                <!-- 占满整个cell -->
                <div
                  :class="[
                    'schedule-cell',
                    cell.dateClass,
                    {
                      'drag-over':
                        dragState.active &&
                        dragState.targetDate === cell.date &&
                        dragState.targetShiftId === cell.shiftId,
                      'is-cell-transfer-target': showCellTransferActions(
                        cell.date,
                        cell.shiftId
                      ),
                      'has-cell-side-rail':
                        cell.canDrag ||
                        showCellTransferActions(cell.date, cell.shiftId),
                    },
                  ]"
                  :data-date="cell.date"
                  :data-shift-id="cell.shiftId"
                  @drop="handleCellDrop($event, cell.date, cell.shiftId)"
                  @dragover="handleCellDragOver($event, cell.date, cell.shiftId)"
                  @dragleave="handleCellDragLeave()"
                  @click="handleCellClick(cell.date, cell.shiftId)"
                >
                  <!-- 整格拖拽手柄 -->
                  <el-tooltip
                    v-if="cell.canDrag"
                    content="拖动本格排班"
                    placement="top"
                    :show-after="200"
                    effect="light"
                    popper-class="schedule-handle-tooltip"
                  >
                    <div
                      class="cell-handle"
                      draggable="true"
                      @dragstart.stop="
                        handleCellHandleDragStart($event, cell.date, cell.shiftId)
                      "
                      @click.stop
                    >
                      <el-icon>
                        <Rank />
                      </el-icon>
                    </div>
                  </el-tooltip>

                  <div
                    v-if="showCellTransferActions(cell.date, cell.shiftId)"
                    class="cell-transfer-actions"
                    @click.stop
                  >
                    <div
                      class="cell-transfer-zone is-move"
                      :class="{
                        'is-active': isCellTransferActionActive(
                          cell.date,
                          cell.shiftId,
                          'move'
                        ),
                      }"
                      data-cell-transfer-action="move"
                      @drop.stop="
                        handleCellActionDrop($event, cell.date, cell.shiftId, 'move')
                      "
                      @dragover.prevent
                      @dragenter.prevent
                    >
                      移动
                    </div>
                    <div
                      class="cell-transfer-zone is-copy"
                      :class="{
                        'is-active': isCellTransferActionActive(
                          cell.date,
                          cell.shiftId,
                          'copy'
                        ),
                        'is-disabled': !canCopyCellTo(cell.date),
                      }"
                      data-cell-transfer-action="copy"
                      @drop.stop="
                        handleCellActionDrop($event, cell.date, cell.shiftId, 'copy')
                      "
                      @dragover.prevent
                      @dragenter.prevent
                    >
                      复制
                    </div>
                  </div>

                  <div class="schedule-tags">
                    <template
                      v-for="(person, index) in cell.people"
                      :key="person.id"
                    >
                      <!-- 插入点在当前元素之前 -->
                      <div
                        v-if="showPlaceholderAt(cell.date, cell.shiftId, index)"
                        class="schedule-placeholder"
                      ></div>

                      <el-tag
                        class="schedule-tag"
                        :data-person-id="person.id"
                        :class="{
                          'is-dragging':
                            dragState.active &&
                            dragState.personId === person.id &&
                            dragState.type === 'schedule',
                        }"
                        :closable="
                          person.editable &&
                          !isScheduleRemoving(person.id, cell.date, cell.shiftId)
                        "
                        disable-transitions
                        @close="removeSchedule(person.id, cell.date, cell.shiftId)"
                        :draggable="
                          person.editable &&
                          !isScheduleRemoving(person.id, cell.date, cell.shiftId)
                        "
                        @dragstart="
                          person.editable &&
                          handleScheduleDragStart(
                            $event,
                            person.id,
                            cell.date,
                            cell.shiftId
                          )
                        "
                        @dragend="handleDragEnd"
                        :style="person.style"
                      >
                        <span>
                          {{ person.name }}
                        </span>
                        <span v-if="person.archived" class="archived-badge">
                          已删除
                        </span>
                      </el-tag>
                    </template>

                    <!-- 插入点在列表末尾 -->
                    <div
                      v-if="
                        showPlaceholderAt(
                          cell.date,
                          cell.shiftId,
                          cell.people.length
                        )
                      "
                      class="schedule-placeholder"
                    ></div>
                  </div>
                </div>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 排班详情对话框 -->
    <el-dialog
      v-model="showScheduleDetail"
      title="排班详情"
      width="400px"
      :close-on-click-modal="!hasRemovingSchedule"
      :close-on-press-escape="!hasRemovingSchedule"
      :show-close="!hasRemovingSchedule"
    >
      <div class="schedule-detail">
        <div style="font-size: 16px; font-weight: bold">
          {{ formatDate(selectedDate, "YYYY年MM月DD日") }} -
          {{ getShiftName(selectedShiftId) }}
        </div>
        <div class="scheduled-people">
          <el-row :gutter="10">
            <el-col
              :span="12"
              v-for="personId in getSchedulePersonIds(
                selectedDate,
                selectedShiftId
              )"
              :key="personId"
            >
              <div class="scheduled-person-item">
                <div
                  class="person-color"
                  :style="{ backgroundColor: getPersonColor(personId) }"
                ></div>
                <span class="person-name">{{ getPersonName(personId) }}</span>
                <el-button
                  v-if="isScheduleEditable(personId, selectedShiftId)"
                  type="danger"
                  size="small"
                  :loading="
                    isScheduleRemoving(personId, selectedDate, selectedShiftId)
                  "
                  @click="
                    removeSchedule(personId, selectedDate, selectedShiftId)
                  "
                  style="margin-left: auto"
                >
                  删除
                </el-button>
              </div>
            </el-col>
          </el-row>
        </div>
        <div
          v-if="
            getSchedulePersonIds(selectedDate, selectedShiftId).length === 0
          "
          class="no-schedule"
        >
          暂无排班
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  computed,
  toRef,
  watch,
  nextTick,
  shallowRef,
} from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Rank } from "@element-plus/icons-vue";
import type {
  PersonWithStatistics,
  Schedule,
  DragData,
} from "@/types";
import { repositories } from "@/repositories";
import { useScheduleViewData } from "@/composables/useScheduleViewData";
import {
  buildPersonStatistics,
  holidayService,
  getRestShiftId,
  getScheduleCellKey,
  scheduleService,
} from "@/services";
import type { EffectiveHolidayEntry } from "@/services";
import {
  getAdaptiveTextColor,
  getMonthDates,
  formatDate,
  getIdDisplaySuffix,
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

// 响应式数据
const currentMonth = toRef(props, "currentMonth");
const {
  activePeople,
  isScheduleEditable,
  isShiftArchived,
  loading,
  mergeSchedules,
  people,
  personMap,
  removeSchedulesByIds,
  replaceSchedules,
  schedules,
  schedulesByPersonId,
  shiftMap,
  shifts,
  visibleShifts,
} = useScheduleViewData();
const showScheduleDetail = ref(false);
const selectedDate = ref("");
const selectedShiftId = ref("");
const extraRestDaysForCurrentMonth = ref(0);
const holidayDateMap = ref<Map<string, EffectiveHolidayEntry>>(new Map());
const peopleSearch = ref("");
const removingScheduleKeys = ref<Set<string>>(new Set());
const schedulingBusy = ref(false);
const scheduleTableViewRef = ref<HTMLElement | null>(null);

type DragOverPayload = {
  cell: HTMLElement;
  clientX: number;
  clientY: number;
  date: string;
  shiftId: string;
  cellTransferAction?: CellTransferMode;
};

type CellTransferMode = "move" | "copy";
type ScheduleDateRow = ReturnType<typeof getMonthDates>[number];
type ScheduleDateTone = "holiday" | "transfer-workday" | "weekend";
type PersonTagStyle = {
  backgroundColor: string;
  color: string;
};
type PersonRenderInfo = {
  id: string;
  name: string;
  color: string;
  style: PersonTagStyle;
  archived: boolean;
};
type ScheduleCellPerson = PersonRenderInfo & {
  editable: boolean;
};
type ScheduleCellView = {
  key: string;
  date: string;
  shiftId: string;
  dateClass: string;
  people: ScheduleCellPerson[];
  canDrag: boolean;
  asList: ScheduleCellView[];
};
type RendererLogAPI = {
  logRenderer: (payload: {
    level?: "info" | "warn" | "error";
    source?: string;
    message?: string;
    data?: unknown;
  }) => Promise<{ success: boolean }>;
};

let dragOverFrame = 0;
let pendingDragOver: DragOverPayload | null = null;
let loadDataRequestId = 0;
let lastWheelDiagnosticAt = 0;
let wheelDiagnosticTimer: number | null = null;
let lastLongTaskDiagnosticAt = 0;
let longTaskObserver: PerformanceObserver | null = null;
let staleDragTimer: number | null = null;

const dragState = ref<{
  active: boolean;
  type: "person" | "schedule" | "cell";
  personId: string;
  sourceDate?: string;
  sourceShiftId?: string;
  targetDate?: string;
  targetShiftId?: string;
  targetIndex?: number;
  targetCellAction?: CellTransferMode;
}>({
  active: false,
  type: "person",
  personId: "",
});

const UNKNOWN_PERSON_COLOR = "#ccc";
const UNKNOWN_PERSON_TAG_STYLE: PersonTagStyle = {
  backgroundColor: UNKNOWN_PERSON_COLOR,
  color: getAdaptiveTextColor(UNKNOWN_PERSON_COLOR),
};
const EMPTY_PERSON_IDS: string[] = [];
const SCROLL_DIAGNOSTIC_COOLDOWN_MS = 3000;
const LONG_TASK_DIAGNOSTIC_COOLDOWN_MS = 5000;
const STALE_DRAG_DIAGNOSTIC_MS = 6000;
const SLOW_OPERATION_MS = 2000;

const getRendererLogAPI = () =>
  (window as Window & { electronAPI?: RendererLogAPI }).electronAPI;

const logScheduleDiagnostic = (
  level: "info" | "warn" | "error",
  message: string,
  data: Record<string, unknown> = {}
) => {
  const electronAPI = getRendererLogAPI();
  void electronAPI
    ?.logRenderer({
      level,
      source: "schedule-table",
      message,
      data: {
        ...data,
        currentMonth: currentMonth.value,
        loading: loading.value,
        schedulingBusy: schedulingBusy.value,
        dragState: { ...dragState.value },
        time: new Date().toISOString(),
      },
    })
    .catch(() => {
      // Diagnostic logging must never affect user operations.
    });
};

const getScheduleTableContainer = () =>
  scheduleTableViewRef.value?.querySelector<HTMLElement>(
    ".schedule-table-container"
  ) || null;

const getScheduleTableScrollWrap = () =>
  scheduleTableViewRef.value?.querySelector<HTMLElement>(
    ".schedule-table-container .el-scrollbar__wrap"
  ) ||
  scheduleTableViewRef.value?.querySelector<HTMLElement>(
    ".schedule-table-container .el-table__body-wrapper"
  ) ||
  null;

const handleScheduleWheelDiagnostic = (event: WheelEvent) => {
  if (Math.abs(event.deltaY) < 1) return;
  if (wheelDiagnosticTimer !== null) return;

  const now = Date.now();
  if (now - lastWheelDiagnosticAt < SCROLL_DIAGNOSTIC_COOLDOWN_MS) return;

  const target = event.target instanceof Node ? event.target : null;
  const container = getScheduleTableContainer();
  const scrollWrap = getScheduleTableScrollWrap();
  if (!target || !container || !scrollWrap || !container.contains(target)) return;

  const before = scrollWrap.scrollTop;
  const maxScrollTop = scrollWrap.scrollHeight - scrollWrap.clientHeight;
  const canScroll =
    event.deltaY > 0 ? before < maxScrollTop - 1 : before > 1;
  if (!canScroll) return;

  wheelDiagnosticTimer = window.setTimeout(() => {
    wheelDiagnosticTimer = null;
    const after = scrollWrap.scrollTop;
    if (Math.abs(after - before) >= 1) return;

    lastWheelDiagnosticAt = Date.now();

    logScheduleDiagnostic("warn", "schedule wheel did not move table scroll", {
      deltaY: event.deltaY,
      before,
      after,
      maxScrollTop,
      activeElement:
        document.activeElement instanceof HTMLElement
          ? {
              tagName: document.activeElement.tagName,
              className: document.activeElement.className,
            }
          : null,
      tableRows: monthDates.value.length,
      peopleCount: people.value.length,
      schedulesCount: schedules.value.length,
    });
  }, 120);
};

const setupLongTaskDiagnostics = () => {
  if (!getRendererLogAPI()) return;
  if (typeof PerformanceObserver === "undefined") return;
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      const now = Date.now();
      if (now - lastLongTaskDiagnosticAt < LONG_TASK_DIAGNOSTIC_COOLDOWN_MS) {
        return;
      }
      let longestDuration = 0;
      let longestStartTime = 0;
      for (const entry of list.getEntries()) {
        if (entry.duration < 200) continue;
        if (entry.duration > longestDuration) {
          longestDuration = entry.duration;
          longestStartTime = entry.startTime;
        }
      }
      if (longestDuration > 0) {
        lastLongTaskDiagnosticAt = now;
        logScheduleDiagnostic("warn", "renderer long task on schedule page", {
          duration: Math.round(longestDuration),
          startTime: Math.round(longestStartTime),
        });
      }
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  } catch {
    longTaskObserver = null;
  }
};

const clearStaleDragTimer = () => {
  if (!staleDragTimer) return;
  window.clearTimeout(staleDragTimer);
  staleDragTimer = null;
};

const scheduleStaleDragDiagnostic = () => {
  clearStaleDragTimer();
  if (!dragState.value.active) return;
  const startedState = { ...dragState.value };
  staleDragTimer = window.setTimeout(() => {
    if (!dragState.value.active) return;
    logScheduleDiagnostic("warn", "schedule drag state stayed active", {
      startedState,
      activeForMs: STALE_DRAG_DIAGNOSTIC_MS,
    });
  }, STALE_DRAG_DIAGNOSTIC_MS);
};

watch(
  () => dragState.value.active,
  (active) => {
    if (active) {
      scheduleStaleDragDiagnostic();
    } else {
      clearStaleDragTimer();
    }
  }
);

// 计算属性
const peopleWithStats = computed(() => {
  const month = currentMonth.value;
  if (!month) return [];
  // TypeScript 推断问题：month 在此处已确保非 null，但类型系统未能识别
  return activePeople.value.map((person) => {
    const stats = calculatePersonStatistics(person.id, month as string);
    return {
      ...person,
      statistics: stats,
    };
  });
});

const filteredPeopleWithStats = computed(() => {
  const keyword = peopleSearch.value.trim().toLowerCase();
  if (!keyword) return peopleWithStats.value;

  return peopleWithStats.value.filter((person) => {
    const displayName = getPersonName(person.id).toLowerCase();
    const rawName = person.name.toLowerCase();
    return displayName.includes(keyword) || rawName.includes(keyword);
  });
});

const personNameDuplicateMap = computed(() => {
  const counts = new Map<string, number>();
  people.value
    .filter((person) => !person.archivedAt)
    .forEach((person) => {
    const key = person.name.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
    });
  return counts;
});

const personRenderInfoMap = computed(() => {
  const duplicateMap = personNameDuplicateMap.value;
  const map = new Map<string, PersonRenderInfo>();

  for (const person of people.value) {
    const color = person.color || UNKNOWN_PERSON_COLOR;
    const duplicateCount = duplicateMap.get(person.name.trim()) || 0;
    const name =
      duplicateCount <= 1
        ? person.name
        : `${person.name} (${getIdDisplaySuffix(person.id)})`;

    map.set(person.id, {
      id: person.id,
      name,
      color,
      style: {
        backgroundColor: color,
        color: getAdaptiveTextColor(color),
      },
      archived: Boolean(person.archivedAt),
    });
  }

  return map;
});

const monthDates = computed(() => {
  if (!currentMonth.value) return [];
  return getMonthDates(currentMonth.value);
});

const restShiftId = computed(() => getRestShiftId(shifts.value));
const hasRemovingSchedule = computed(() => removingScheduleKeys.value.size > 0);

const buildScheduleCellMap = (sourceSchedules: Schedule[]) => {
  const map = new Map<string, Schedule[]>();
  for (const schedule of sourceSchedules) {
    const key = getScheduleCellKey(schedule.date, schedule.shiftId);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(schedule);
    } else {
      map.set(key, [schedule]);
    }
  }

  for (const [key, bucket] of map) {
    map.set(key, sortByOrder(bucket));
  }

  return map;
};

const scheduleCellMap = shallowRef<Map<string, Schedule[]>>(new Map());

watch(
  schedules,
  (nextSchedules, previousSchedules) => {
    const oldSchedules = previousSchedules || [];
    if (oldSchedules.length === 0 || nextSchedules.length === 0) {
      scheduleCellMap.value = buildScheduleCellMap(nextSchedules);
      return;
    }

    const oldById = new Map(
      oldSchedules.map((schedule) => [schedule.id, schedule])
    );
    const nextById = new Map(
      nextSchedules.map((schedule) => [schedule.id, schedule])
    );
    const affectedKeys = new Set<string>();

    for (const oldSchedule of oldSchedules) {
      const nextSchedule = nextById.get(oldSchedule.id);
      const oldKey = getScheduleCellKey(
        oldSchedule.date,
        oldSchedule.shiftId
      );
      if (!nextSchedule) {
        affectedKeys.add(oldKey);
        continue;
      }

      const nextKey = getScheduleCellKey(
        nextSchedule.date,
        nextSchedule.shiftId
      );
      if (
        oldKey !== nextKey ||
        oldSchedule.order !== nextSchedule.order ||
        oldSchedule.personId !== nextSchedule.personId
      ) {
        affectedKeys.add(oldKey);
        affectedKeys.add(nextKey);
      }
    }

    for (const nextSchedule of nextSchedules) {
      if (!oldById.has(nextSchedule.id)) {
        affectedKeys.add(
          getScheduleCellKey(nextSchedule.date, nextSchedule.shiftId)
        );
      }
    }

    if (affectedKeys.size === 0) return;
    if (
      affectedKeys.size > 50 ||
      affectedKeys.size > Math.max(1, nextSchedules.length / 2)
    ) {
      scheduleCellMap.value = buildScheduleCellMap(nextSchedules);
      return;
    }

    const nextMap = new Map(scheduleCellMap.value);
    for (const key of affectedKeys) {
      nextMap.delete(key);
    }

    for (const schedule of nextSchedules) {
      const key = getScheduleCellKey(schedule.date, schedule.shiftId);
      if (!affectedKeys.has(key)) continue;
      const bucket = nextMap.get(key);
      if (bucket) {
        bucket.push(schedule);
      } else {
        nextMap.set(key, [schedule]);
      }
    }

    for (const key of affectedKeys) {
      const bucket = nextMap.get(key);
      if (bucket) {
        nextMap.set(key, sortByOrder(bucket));
      }
    }

    scheduleCellMap.value = nextMap;
  },
  { immediate: true }
);

const schedulePersonIdsByCell = computed(() => {
  const map = new Map<string, string[]>();
  for (const [key, bucket] of scheduleCellMap.value) {
    map.set(
      key,
      bucket.map((schedule) => schedule.personId)
    );
  }
  return map;
});

const shiftNameDuplicateMap = computed(() => {
  const counts = new Map<string, number>();
  shifts.value
    .filter((shift) => !shift.archivedAt)
    .forEach((shift) => {
    const key = shift.name.trim();
    counts.set(key, (counts.get(key) || 0) + 1);
    });
  return counts;
});

const getShiftDisplayName = (shiftId: string) => {
  const shift = shiftMap.value.get(shiftId);
  if (!shift) return "未知班次";
  const duplicateCount = shiftNameDuplicateMap.value.get(shift.name.trim()) || 0;
  if (duplicateCount <= 1) return shift.name;
  return `${shift.name} (${getIdDisplaySuffix(shift.id)})`;
};

const getScheduleRemovingKey = (
  personId: string,
  date: string,
  shiftId: string
) => `${personId}::${date}::${shiftId}`;

const isScheduleRemoving = (
  personId: string,
  date: string,
  shiftId: string
) =>
  removingScheduleKeys.value.has(
    getScheduleRemovingKey(personId, date, shiftId)
  );

// 方法
/**
 * 加载数据
 */
const loadData = async () => {
  const monthValue = currentMonth.value;
  if (!monthValue) {
    loadDataRequestId += 1;
    loading.value = false;
    return;
  }

  const requestId = ++loadDataRequestId;
  const startedAt = performance.now();
  loading.value = true;
  try {
    const [
      peopleData,
      shiftsData,
      schedulesData,
      holidayData,
      extraRestDays,
    ] = await Promise.all([
      repositories.people.getAllIncludingArchived(),
      repositories.shifts.getAllIncludingArchived(),
      repositories.schedules.getByMonth(monthValue),
      loadHolidayData(monthValue),
      loadExtraRestDays(monthValue),
    ]);

    if (requestId !== loadDataRequestId || currentMonth.value !== monthValue) {
      return;
    }

    people.value = peopleData;
    shifts.value = shiftsData;
    schedules.value = schedulesData;
    holidayDateMap.value = holidayData;
    extraRestDaysForCurrentMonth.value = extraRestDays;
  } catch (error) {
    if (requestId === loadDataRequestId && currentMonth.value === monthValue) {
      console.error("加载数据失败:", error);
      ElMessage.error("加载数据失败");
    }
  } finally {
    if (requestId === loadDataRequestId) {
      loading.value = false;
      const duration = performance.now() - startedAt;
      if (duration > SLOW_OPERATION_MS) {
        logScheduleDiagnostic("warn", "schedule loadData was slow", {
          duration: Math.round(duration),
          month: monthValue,
          peopleCount: people.value.length,
          shiftsCount: shifts.value.length,
          schedulesCount: schedules.value.length,
        });
      }
    }
  }
};

const loadHolidayData = async (monthValue: string) => {
  await holidayService.ensureBuiltinHolidays();
  return holidayService.getEffectiveMonthDateMap(
    "CN",
    monthValue
  );
};

const loadExtraRestDays = async (monthValue: string) => {
  try {
    const [year, monthNum] = monthValue.split("-").map(Number);
    const config = await repositories.extraRestConfigs.getByYearAndMonth(
      year,
      monthNum
    );
    return config?.extraRestDays || 0;
  } catch (error: any) {
    console.error("[extraRest-load-error]", {
      time: new Date().toISOString(),
      params: { month: monthValue },
      message: error?.message,
      stack: error?.stack,
    });
    return 0;
  }
};

/**
 * 计算人员统计信息
 */
const calculatePersonStatistics = (personId: string, month: string) => {
  const person = personMap.value.get(personId);
  if (!person) return undefined;
  return buildPersonStatistics({
    person,
    month,
    schedules: schedulesByPersonId.value.get(personId) || [],
    extraRestDays: extraRestDaysForCurrentMonth.value,
    restShiftId: restShiftId.value,
  });
};

const setMonth = async (month: string) => {
  if (!month || month === currentMonth.value) return;
  emit("update:current-month", month);
};

const getHolidayEntry = (date: string) => holidayDateMap.value.get(date) || null;

const isWeekend = (weekdayName: string) =>
  weekdayName === "周六" || weekdayName === "周日";

const getScheduleDateTone = (
  date: string,
  weekdayName: string
): ScheduleDateTone | "" => {
  const holiday = getHolidayEntry(date);
  if (holiday?.type === "transfer_workday") return "transfer-workday";
  if (holiday?.type === "public_holiday") return "holiday";
  if (isWeekend(weekdayName)) return "weekend";
  return "";
};

const getDateCellClass = (date: string, weekdayName: string) => {
  const tone = getScheduleDateTone(date, weekdayName);
  if (tone) return `is-${tone}`;
  return "";
};

const getScheduleRowClassName = ({ row }: { row: ScheduleDateRow }) => {
  const tone = getScheduleDateTone(row.date, row.weekdayName);
  return tone ? `schedule-row-${tone}` : "";
};

const getScheduleCellDateClass = (date: string, weekdayName: string) => {
  const tone = getScheduleDateTone(date, weekdayName);
  return tone ? `is-${tone}-date` : "";
};

const createScheduleCellView = (
  view: Omit<ScheduleCellView, "asList">
): ScheduleCellView => {
  const scheduleCellView: ScheduleCellView = {
    ...view,
    asList: [],
  };
  scheduleCellView.asList = [scheduleCellView];
  return scheduleCellView;
};

const scheduleCellViewMap = computed(() => {
  const map = new Map<string, ScheduleCellView>();
  const personInfoMap = personRenderInfoMap.value;
  const personIdsByCell = schedulePersonIdsByCell.value;
  const shiftsById = shiftMap.value;

  for (const row of monthDates.value) {
    const dateClass = getScheduleCellDateClass(row.date, row.weekdayName);

    for (const shift of visibleShifts.value) {
      const key = getScheduleCellKey(row.date, shift.id);
      const personIds = personIdsByCell.get(key) || EMPTY_PERSON_IDS;
      const shiftArchived = Boolean(shiftsById.get(shift.id)?.archivedAt);
      const cellPeople = personIds.map((personId) => {
        const info = personInfoMap.get(personId);
        const archived = Boolean(info?.archived);

        return {
          id: personId,
          name: info?.name || "未知",
          color: info?.color || UNKNOWN_PERSON_COLOR,
          style: info?.style || UNKNOWN_PERSON_TAG_STYLE,
          archived,
          editable: !archived && !shiftArchived,
        };
      });

      map.set(
        key,
        createScheduleCellView({
          key,
          date: row.date,
          shiftId: shift.id,
          dateClass,
          people: cellPeople,
          canDrag:
            cellPeople.length > 0 &&
            cellPeople.every((person) => person.editable),
        })
      );
    }
  }

  return map;
});

const getScheduleCellViewList = (
  date: string,
  weekdayName: string,
  shiftId: string
) => {
  const key = getScheduleCellKey(date, shiftId);
  const cell = scheduleCellViewMap.value.get(key);
  if (cell) return cell.asList;

  return createScheduleCellView({
    key,
    date,
    shiftId,
    dateClass: getScheduleCellDateClass(date, weekdayName),
    people: [],
    canDrag: false,
  }).asList;
};

/**
 * 处理人员拖拽开始
 */
const handlePersonDragStart = (
  event: DragEvent,
  person: PersonWithStatistics
) => {
  if (schedulingBusy.value) {
    event.preventDefault();
    return;
  }
  if (!event.dataTransfer) {
    event.preventDefault();
    resetDragState();
    return;
  }

  const dragData: DragData = {
    type: "person",
    personId: person.id,
  };

  dragState.value = {
    active: true,
    type: "person",
    personId: person.id,
    targetIndex: -1,
  };

  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = "move";
};

/**
 * 处理拖拽结束
 */
const resetDragState = () => {
  if (dragOverFrame) {
    window.cancelAnimationFrame(dragOverFrame);
    dragOverFrame = 0;
  }
  pendingDragOver = null;
  dragState.value = {
    active: false,
    type: "person",
    personId: "",
    targetDate: undefined,
    targetShiftId: undefined,
    targetIndex: undefined,
    targetCellAction: undefined,
  };
};

const handleDragEnd = () => {
  resetDragState();
};

const cancelDanglingDrag = () => {
  if (!dragState.value.active) return;
  resetDragState();
};

const handleGlobalKeyDown = (event: KeyboardEvent) => {
  if (!dragState.value.active) return;
  if (
    event.key === "Escape" ||
    event.metaKey ||
    event.altKey
  ) {
    resetDragState();
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") {
    cancelDanglingDrag();
  }
};

/**
 * 判断是否显示占位符
 */
const showPlaceholderAt = (date: string, shiftId: string, index: number) => {
  return (
    dragState.value.active &&
    dragState.value.targetDate === date &&
    dragState.value.targetShiftId === shiftId &&
    dragState.value.targetIndex === index
  );
};

const isSameSourceCell = (date: string, shiftId: string) =>
  dragState.value.sourceDate === date && dragState.value.sourceShiftId === shiftId;

const canCopyCellTo = (date: string) =>
  dragState.value.type === "cell" && dragState.value.sourceDate !== date;

const showCellTransferActions = (date: string, shiftId: string) =>
  dragState.value.active &&
  dragState.value.type === "cell" &&
  dragState.value.targetDate === date &&
  dragState.value.targetShiftId === shiftId &&
  !isSameSourceCell(date, shiftId);

const isCellTransferActionActive = (
  date: string,
  shiftId: string,
  action: CellTransferMode
) =>
  showCellTransferActions(date, shiftId) &&
  dragState.value.targetCellAction === action;

const getCellTransferActionFromEvent = (
  event: DragEvent
): CellTransferMode | undefined => {
  const target = event.target instanceof HTMLElement ? event.target : null;
  const action = target
    ?.closest<HTMLElement>("[data-cell-transfer-action]")
    ?.dataset.cellTransferAction;
  return action === "copy" || action === "move" ? action : undefined;
};

/**
 * 处理单元格拖拽进入/悬停
 */
const applyDragOver = ({
  cell,
  clientX,
  clientY,
  date,
  shiftId,
  cellTransferAction,
}: DragOverPayload) => {
  const ds = dragState.value;
  if (!ds.active) return;

  const tags = Array.from(
    cell.querySelectorAll(".schedule-tag:not(.is-dragging)")
  );

  // 如果是整格拖拽，不计算插入位置，直接放在最后
  if (ds.type === "cell") {
    if (ds.targetDate !== date) ds.targetDate = date;
    if (ds.targetShiftId !== shiftId) ds.targetShiftId = shiftId;
    if (ds.targetIndex !== -1) ds.targetIndex = -1;
    if (ds.targetCellAction !== cellTransferAction) {
      ds.targetCellAction = cellTransferAction;
    }
    return;
  }

  let insertIndex = tags.length;
  if (tags.length > 0) {
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const rect = tag.getBoundingClientRect();

      // 如果鼠标在当前元素所在行的下方，说明当前元素肯定在插入点之前
      if (clientY > rect.bottom) {
        continue;
      }

      // 如果鼠标在当前元素所在行的上方，说明当前元素在插入点之后
      if (clientY < rect.top) {
        insertIndex = i;
        break;
      }

      // 如果在同一行，比较 X
      const centerX = rect.left + rect.width / 2;
      if (clientX < centerX) {
        insertIndex = i;
        break;
      }
    }
  }

  // 如果是同单元格内的拖拽，需要将 visual index 转换为真实列表的 index
  if (
    ds.type === "schedule" &&
    ds.sourceDate === date &&
    ds.sourceShiftId === shiftId
  ) {
    if (insertIndex < tags.length) {
      const targetEl = tags[insertIndex] as HTMLElement;
      const targetPersonId = targetEl.dataset.personId;
      if (targetPersonId) {
        const fullList = getSchedulePersonIds(date, shiftId);
        const realIndex = fullList.indexOf(targetPersonId);
        if (realIndex !== -1) {
          insertIndex = realIndex;
        }
      }
    } else {
      // 拖拽到末尾
      const fullList = getSchedulePersonIds(date, shiftId);
      insertIndex = fullList.length;
    }
  }

  if (ds.targetDate !== date) ds.targetDate = date;
  if (ds.targetShiftId !== shiftId) ds.targetShiftId = shiftId;
  if (ds.targetIndex !== insertIndex) ds.targetIndex = insertIndex;
  if (ds.targetCellAction !== undefined) ds.targetCellAction = undefined;
};

const flushPendingDragOver = () => {
  if (dragOverFrame) {
    window.cancelAnimationFrame(dragOverFrame);
    dragOverFrame = 0;
  }

  const payload = pendingDragOver;
  pendingDragOver = null;
  if (payload) {
    applyDragOver(payload);
  }
};

const handleCellDragOver = (
  event: DragEvent,
  date: string,
  shiftId: string
) => {
  event.preventDefault();
  const action = getCellTransferActionFromEvent(event);
  if (event.dataTransfer && dragState.value.type === "cell") {
    event.dataTransfer.dropEffect =
      action === "copy" || (!action && (event.ctrlKey || event.metaKey))
        ? "copy"
        : "move";
  }
  const cell = event.currentTarget as HTMLElement | null;
  if (!cell) return;

  pendingDragOver = {
    cell,
    clientX: event.clientX,
    clientY: event.clientY,
    date,
    shiftId,
    cellTransferAction:
      action ?? (event.ctrlKey || event.metaKey ? "copy" : "move"),
  };

  if (dragOverFrame) return;
  dragOverFrame = window.requestAnimationFrame(() => {
    const payload = pendingDragOver;
    pendingDragOver = null;
    dragOverFrame = 0;
    if (payload) {
      applyDragOver(payload);
    }
  });
};

const handleCellDragLeave = () => {
  // no-op
};

const handleCellActionDrop = (
  event: DragEvent,
  date: string,
  shiftId: string,
  mode: CellTransferMode
) => {
  if (mode === "copy" && !canCopyCellTo(date)) {
    event.preventDefault();
    flushPendingDragOver();
    ElMessage.warning("同一天内不能复制整格排班，请使用移动调整班次");
    handleDragEnd();
    return;
  }

  void handleCellDrop(event, date, shiftId, mode);
};

/**
 * 处理单元格放置
 */
const handleCellDrop = async (
  event: DragEvent,
  date: string,
  shiftId: string,
  cellTransferMode?: CellTransferMode
) => {
  event.preventDefault();
  flushPendingDragOver();
  if (!event.dataTransfer) {
    handleDragEnd();
    return;
  }
  if (schedulingBusy.value) {
    // 处理中再次落点：清理拖拽视觉状态，避免占位符残留
    handleDragEnd();
    return;
  }
  schedulingBusy.value = true;
  const operationStartedAt = performance.now();

  // 失败兜底标记：仅在确认数据可能不一致时才异步 reload，
  // 避免 catch 内同步 loadData 拆掉正在拖拽的 DOM。
  let needsReloadAfterError = false;
  let lastErrorMessage = "排班失败";

  try {
    const dragDataStr = event.dataTransfer.getData("text/plain");
    const dragData: DragData = JSON.parse(dragDataStr);
    const targetIndex = dragState.value.targetIndex ?? -1;
    if (isShiftArchived(shiftId)) {
      ElMessage.warning("该班次已删除，仅保留历史排班，不可继续排班");
      handleDragEnd();
      return;
    }

    if (
      dragData.type === "schedule" &&
      dragData.sourceDate &&
      dragData.sourceShiftId
    ) {
      const isSameCell =
        dragData.sourceDate === date && dragData.sourceShiftId === shiftId;

      if (isSameCell) {
        await handleTagReorder(dragData.personId, date, shiftId, targetIndex);
        handleDragEnd();
        return;
      }

      const movingSameDay = dragData.sourceDate === date;
      if (!movingSameDay) {
        const existingScheduleForTargetDay = schedules.value.find(
          (s) => s.personId === dragData.personId && s.date === date
        );
        if (existingScheduleForTargetDay) {
          ElMessage.warning("该员工当天已有排班，请先删除原有排班");
          handleDragEnd();
          return;
        }
      }

      const shift = shifts.value.find((s) => s.id === shiftId);
      if (shift?.isRest) {
        const person = people.value.find((p) => p.id === dragData.personId);
        const monthValue = currentMonth.value;
        if (!monthValue) {
          ElMessage.warning("尚未选择月份，无法计算剩余休息天数");
          handleDragEnd();
          return;
        }
        if (person) {
          const stats = calculatePersonStatistics(person.id, monthValue);
          if (stats && stats.remainingRestDays <= 0) {
            try {
              await ElMessageBox.confirm(
                `${person.name} 已超额排休 ${Math.abs(stats.remainingRestDays)} 天，确定要继续排休吗？`,
                "超额排休提醒",
                {
                  confirmButtonText: "确定",
                  cancelButtonText: "取消",
                  type: "warning",
                }
              );
            } catch {
              handleDragEnd();
              return;
            }
          }
        }
      }

      const result = await scheduleService.moveScheduleToCell({
        personId: dragData.personId,
        sourceDate: dragData.sourceDate,
        sourceShiftId: dragData.sourceShiftId,
        targetDate: date,
        targetShiftId: shiftId,
        month: currentMonth.value!,
        targetIndex,
      });
      replaceSchedules(result.updatedSchedules);
      mergeSchedules(result.movedSchedule);
      ElMessage.success("已移动排班");
      handleDragEnd();
      return;
    }

    if (
      dragData.type === "cell" &&
      dragData.sourceDate &&
      dragData.sourceShiftId
    ) {
      const sourceDate = dragData.sourceDate;
      const sourceShiftId = dragData.sourceShiftId;

      // 如果目标和源相同，无操作
      if (sourceDate === date && sourceShiftId === shiftId) {
        handleDragEnd();
        return;
      }

      const sourceSchedules = schedules.value.filter(
        (s) => s.date === sourceDate && s.shiftId === sourceShiftId
      );
      if (sourceSchedules.length === 0) {
        handleDragEnd();
        return;
      }

      const transferMode =
        cellTransferMode ??
        getCellTransferActionFromEvent(event) ??
        (event.ctrlKey || event.metaKey ? "copy" : "move");

      if (transferMode === "copy" && sourceDate === date) {
        ElMessage.warning("同一天内不能复制整格排班，请使用移动调整班次");
        handleDragEnd();
        return;
      }

      const result = await scheduleService.transferCellSchedules({
        sourceDate,
        sourceShiftId,
        targetDate: date,
        targetShiftId: shiftId,
        month: currentMonth.value!,
        schedules: schedules.value,
        mode: transferMode,
      });

      if (result.createdCount === 0) {
        if (result.conflictCount > 0) {
          ElMessage.warning(
            transferMode === "copy"
              ? "目标日期已有这些人员的排班，未复制"
              : "目标日期已有这些人员的排班，未移动"
          );
        }
        handleDragEnd();
        return;
      }

      const actionName = transferMode === "copy" ? "复制" : "移动";
      let msg = `${actionName}成功 ${result.createdCount} 人`;
      if (result.conflictCount > 0) {
        msg += `，跳过 ${result.conflictCount} 人`;
      }
      ElMessage.success(msg);

      removeSchedulesByIds(result.deletedIds);
      replaceSchedules(result.updatedSchedules);
      mergeSchedules(...result.createdSchedules);
      handleDragEnd();
      return;
    }

    if (dragData.type === "person") {
      const existingSchedule = schedules.value.find(
        (s) => s.personId === dragData.personId && s.date === date
      );
      if (existingSchedule) {
        ElMessage.warning("该员工当天已有排班，请先删除原有排班");
        handleDragEnd();
        return;
      }
    }

    const shift = shifts.value.find((s) => s.id === shiftId);
    if (shift?.isRest) {
      const person = people.value.find((p) => p.id === dragData.personId);
      if (person) {
        const monthValue = currentMonth.value;
        if (!monthValue) {
          ElMessage.warning("尚未选择月份，无法计算剩余休息天数");
          handleDragEnd();
          return;
        }
        const stats = calculatePersonStatistics(person.id, monthValue);
        if (stats && stats.remainingRestDays <= 0) {
          try {
            await ElMessageBox.confirm(
              `${person.name} 已超额排休 ${Math.abs(stats.remainingRestDays)} 天，确定要继续排休吗？`,
              "超额排休提醒",
              {
                confirmButtonText: "确定",
                cancelButtonText: "取消",
                type: "warning",
              }
            );
          } catch {
            handleDragEnd();
            return;
          }
        }
      }
    }

    if (targetIndex >= 0) {
      const result = await scheduleService.insertScheduleIntoCell({
        personId: dragData.personId,
        shiftId,
        date,
        month: currentMonth.value!,
        targetIndex,
      });
      replaceSchedules(result.updated);
      mergeSchedules(result.created);
    } else {
      const created = await scheduleService.appendScheduleToCell({
        personId: dragData.personId,
        shiftId,
        date,
        month: currentMonth.value!,
      });
      mergeSchedules(created);
    }

    ElMessage.success("排班成功");
  } catch (error) {
    console.error("排班失败:", {
      error,
      time: new Date().toISOString(),
      target: { date, shiftId },
    });
    // 注意：不要在 catch 内同步 await loadData()。
    // loadData 会整体替换 schedules.value，触发 v-for 重渲染，
    // 销毁正在拖拽的 .schedule-tag 节点导致 Chromium 不再派发 dragend，
    // dragState 残留、占位符高亮、下次拖拽视觉错乱。
    // 改为：finally 中先清理拖拽态，再用 nextTick 异步触发 reload，
    // 保证当前拖拽生命周期已经走完。
    needsReloadAfterError = true;
    lastErrorMessage = error instanceof Error ? error.message : "排班失败";
  } finally {
    const duration = performance.now() - operationStartedAt;
    schedulingBusy.value = false;
    handleDragEnd();
    if (duration > SLOW_OPERATION_MS) {
      logScheduleDiagnostic("warn", "schedule drop operation was slow", {
        duration: Math.round(duration),
        target: { date, shiftId },
      });
    }
    if (needsReloadAfterError) {
      ElMessage.error(lastErrorMessage);
      // 拖拽生命周期结束后再 reload，避免拆掉正在拖拽的 DOM
      nextTick(() => {
        void loadData();
      });
    }
  }
};

/**
 * 处理同单元格内的排序
 */
const handleTagReorder = async (
  personId: string,
  date: string,
  shiftId: string,
  targetIndex: number
) => {
  const updatedSchedules = await scheduleService.reorderSchedulesInCell({
    personId,
    date,
    shiftId,
    targetIndex,
    schedules: schedules.value,
  });

  if (!updatedSchedules) return;

  replaceSchedules(updatedSchedules);
  ElMessage.success("已更新排序");
};

const handleCellHandleDragStart = (
  event: DragEvent,
  sourceDate: string,
  sourceShiftId: string
) => {
  if (schedulingBusy.value) {
    event.preventDefault();
    return;
  }
  if (!event.dataTransfer) {
    event.preventDefault();
    resetDragState();
    return;
  }

  const dragData: DragData = {
    type: "cell",
    personId: "", // 占位
    sourceDate,
    sourceShiftId,
  };

  dragState.value = {
    active: true,
    type: "cell",
    personId: "",
    sourceDate,
    sourceShiftId,
  };

  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = "copyMove"; // 允许复制或移动
};

const handleScheduleDragStart = (
  event: DragEvent,
  personId: string,
  sourceDate: string,
  sourceShiftId: string
) => {
  try {
    if (schedulingBusy.value) {
      event.preventDefault();
      return;
    }
    if (!event.dataTransfer) {
      event.preventDefault();
      resetDragState();
      return;
    }
    const dragData: DragData = {
      type: "schedule",
      personId,
      sourceDate,
      sourceShiftId,
    } as DragData;

    dragState.value = {
      active: true,
      type: "schedule",
      personId,
      sourceDate,
      sourceShiftId,
    };

    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = "move";
  } catch (error: any) {
    console.error("[schedule-dragstart-error]", {
      time: new Date().toISOString(),
      params: { personId, sourceDate, sourceShiftId },
      message: error?.message,
      stack: error?.stack,
    });
  }
};

/**
 * 处理单元格点击
 */
const handleCellClick = (date: string, shiftId: string) => {
  selectedDate.value = date;
  selectedShiftId.value = shiftId;
  showScheduleDetail.value = true;
};

/**
 * 获取指定日期和班次的排班人员ID列表
 */
const getSchedulePersonIds = (date: string, shiftId: string) => {
  return (
    schedulePersonIdsByCell.value.get(getScheduleCellKey(date, shiftId)) ||
    EMPTY_PERSON_IDS
  );
};

/**
 * 获取人员颜色
 */
const getPersonColor = (personId: string) => {
  return personRenderInfoMap.value.get(personId)?.color || UNKNOWN_PERSON_COLOR;
};

/**
 * 获取人员姓名
 */
const getPersonName = (personId: string) => {
  return personRenderInfoMap.value.get(personId)?.name || "未知";
};


/**
 * 获取班次名称
 */
const getShiftName = (shiftId: string) => {
  return getShiftDisplayName(shiftId);
};

/**
 * 删除排班记录
 */
const removeSchedule = async (
  personId: string,
  date: string,
  shiftId: string
) => {
  const removingKey = getScheduleRemovingKey(personId, date, shiftId);
  if (removingScheduleKeys.value.has(removingKey)) return;
  removingScheduleKeys.value = new Set(removingScheduleKeys.value).add(
    removingKey
  );
  try {
    const removed = await scheduleService.removeScheduleByIdentity(
      personId,
      date,
      shiftId
    );
    if (removed) {
      removeSchedulesByIds([removed.id]);
      ElMessage.success("删除排班成功");
    }
  } catch (error) {
    console.error("删除排班失败:", error);
    ElMessage.error("删除排班失败");
  } finally {
    const nextRemovingKeys = new Set(removingScheduleKeys.value);
    nextRemovingKeys.delete(removingKey);
    removingScheduleKeys.value = nextRemovingKeys;
  }
};

// 页面加载时初始化数据
onMounted(() => {
  loadData();
  if (getRendererLogAPI()) {
    scheduleTableViewRef.value?.addEventListener(
      "wheel",
      handleScheduleWheelDiagnostic,
      { passive: true, capture: true }
    );
    setupLongTaskDiagnostics();
  }
  window.addEventListener("blur", cancelDanglingDrag);
  window.addEventListener("dragend", cancelDanglingDrag);
  window.addEventListener("dragcancel", cancelDanglingDrag);
  window.addEventListener("drop", cancelDanglingDrag);
  window.addEventListener("keydown", handleGlobalKeyDown, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onBeforeUnmount(() => {
  scheduleTableViewRef.value?.removeEventListener(
    "wheel",
    handleScheduleWheelDiagnostic,
    true
  );
  longTaskObserver?.disconnect();
  longTaskObserver = null;
  if (wheelDiagnosticTimer !== null) {
    window.clearTimeout(wheelDiagnosticTimer);
    wheelDiagnosticTimer = null;
  }
  clearStaleDragTimer();
  window.removeEventListener("blur", cancelDanglingDrag);
  window.removeEventListener("dragend", cancelDanglingDrag);
  window.removeEventListener("dragcancel", cancelDanglingDrag);
  window.removeEventListener("drop", cancelDanglingDrag);
  window.removeEventListener("keydown", handleGlobalKeyDown, true);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  resetDragState();
});

watch(
  currentMonth,
  async (newMonth) => {
    if (newMonth) {
      await loadData();
    }
  }
);

defineExpose({
  currentMonth,
  setMonth,
  loadData,
});
</script>

<style lang="scss" scoped>
.schedule-table-view {
  --schedule-holiday-color: var(--el-color-primary);
  --schedule-transfer-workday-color: var(--el-color-danger);
  --schedule-weekend-color: #14b8a6;

  height: 100%;

  .schedule-container {
    display: flex;
    gap: 20px;
    height: calc(100vh - 150px);
  }

  .people-sidebar {
    width: 150px;
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);

    .people-sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 15px;
      white-space: nowrap;

      h3 {
        margin: 0;
        color: var(--el-text-color-primary);
        flex: 0 0 auto;
      }
    }

    .people-search-input {
      flex: 1;
      min-width: 0;
    }

    .people-list {
      width: calc(100% + 10px);
      height: calc(100% - 47px);

      .people-empty {
        margin-right: 10px;
        padding: 24px 12px;
        text-align: center;
        color: var(--el-text-color-secondary);
        font-size: 13px;
      }

      .person-tag {
        display: flex;
        align-items: center;
        padding: 10px;
        margin-right: 10px;
        margin-bottom: 10px;
        background: var(--el-fill-color-light);
        border: 1px solid var(--el-border-color);
        border-radius: 6px;
        cursor: move;
        transition:
          background-color 0.18s,
          border-color 0.18s;

        &:hover {
          background: var(--el-color-primary-light-9);
          border-color: var(--el-color-primary);
        }
      }
    }
  }

  .person-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 8px;
  }

  .person-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .person-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .person-base-rest {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .person-rest-days {
    font-size: 12px;
    color: var(--el-color-success);

    &.over-rest {
      color: var(--el-color-error);
      font-weight: bold;
    }

    &.full-rest {
      color: var(--el-color-primary);
      font-weight: bold;
    }
  }

  .schedule-table-container {
    flex: 1;
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    overflow: hidden;

    :deep(.schedule-tag) {
      flex: 0 0 auto;
      border-color: transparent;
      cursor: grab;
      transition: transform 0.2s, opacity 0.2s;

      &.is-dragging {
        opacity: 0.4;
        cursor: grabbing;
      }

      .el-tag__close {
        color: inherit;
      }
    }

    :deep(.schedule-tag[draggable="false"]) {
      cursor: default;
    }
  }

  .date-cell {
    display: flex;
    font-size: 14px;
    text-align: center;
    align-items: center;
    min-height: 28px;
    gap: 8px;
    flex-wrap: wrap;

    .weekday {
      margin-left: 0;
    }

    .is-weekend {
      color: var(--schedule-weekend-color);
      font-weight: 600;
    }

    .is-holiday {
      color: var(--schedule-holiday-color);
      font-weight: 700;
    }

    .is-transfer-workday {
      color: var(--schedule-transfer-workday-color);
      font-weight: 700;
    }

    .holiday-chip {
      flex: 0 0 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 18px;
      padding: 0 5px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 18px;
      white-space: nowrap;

      &.public_holiday {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        border: 1px solid var(--el-color-primary-light-7);
      }

      &.transfer_workday {
        color: var(--el-color-danger);
        background: var(--el-color-danger-light-9);
        border: 1px solid var(--el-color-danger-light-7);
      }
    }
  }

  .date {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .weekday {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 2px;
  }

  .schedule-cell-spacer,
  .schedule-tags {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .schedule-cell-spacer {
    min-height: 34px;
    padding: 5px;
    opacity: 0;
    pointer-events: none;

    &.has-cell-side-rail {
      padding-right: 30px;
    }
  }

  .schedule-tags {
    min-height: 24px;
  }

  .schedule-cell-spacer-tag {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 24px;
    padding: 0 9px;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 4px;
    font-size: 12px;
    line-height: 22px;
    white-space: nowrap;

    &::after {
      content: "";
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      margin-left: 6px;
    }
  }

  .schedule-cell {
    position: absolute;
    inset: 0;
    min-height: 34px;
    padding: 5px;
    box-sizing: border-box;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
    background: color-mix(
      in srgb,
      var(--el-fill-color-light) 45%,
      transparent
    );
    cursor: pointer;
    overflow: hidden;
    contain: paint;
    transition:
      background-color 0.18s,
      border-color 0.18s;

    &.has-cell-side-rail {
      padding-right: 30px;
    }

    &:hover {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }

    &.is-holiday-date {
      border-color: rgba(64, 158, 255, 0.24);
      background: color-mix(
        in srgb,
        var(--schedule-holiday-color) 14%,
        var(--el-bg-color) 86%
      );
    }

    &.is-transfer-workday-date {
      border-color: rgba(245, 108, 108, 0.24);
      background: color-mix(
        in srgb,
        var(--schedule-transfer-workday-color) 6%,
        var(--el-bg-color) 94%
      );
    }

    &.is-weekend-date {
      border-color: rgba(20, 184, 166, 0.26);
      background: color-mix(
        in srgb,
        var(--schedule-weekend-color) 8%,
        var(--el-bg-color) 92%
      );
    }

    &.is-holiday-date:hover {
      border-color: rgba(64, 158, 255, 0.46);
      background: color-mix(
        in srgb,
        var(--schedule-holiday-color) 20%,
        var(--el-bg-color) 80%
      );
    }

    &.is-transfer-workday-date:hover {
      border-color: rgba(245, 108, 108, 0.46);
      background: color-mix(
        in srgb,
        var(--schedule-transfer-workday-color) 11%,
        var(--el-bg-color) 89%
      );
    }

    &.is-weekend-date:hover {
      border-color: rgba(20, 184, 166, 0.46);
      background: color-mix(
        in srgb,
        var(--schedule-weekend-color) 13%,
        var(--el-bg-color) 87%
      );
    }

    &.drag-over {
      border-color: var(--el-color-success);
      background: var(--el-color-success-light-9);
    }

    &.is-cell-transfer-target {
      border-style: solid;
      background: color-mix(
        in srgb,
        var(--el-color-success-light-9) 80%,
        var(--el-bg-color) 20%
      );
    }

    .cell-handle {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #e4e7ed;
      border-radius: 4px;
      cursor: grab;
      opacity: 0;
      transition:
        opacity 0.16s,
        background-color 0.16s,
        border-color 0.16s,
        color 0.16s;
      z-index: 10;
      color: var(--el-text-color-secondary);

      &:hover {
        background: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
        border-color: var(--el-color-primary-light-5);
      }

      &:active {
        cursor: grabbing;
      }
    }

    &:hover .cell-handle {
      opacity: 1;
    }

    &.is-cell-transfer-target .cell-handle {
      opacity: 0;
      pointer-events: none;
    }

    .cell-transfer-actions {
      position: absolute;
      inset: 3px;
      z-index: 20;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 3px;
    }

    .cell-transfer-zone {
      min-width: 0;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      border: 1px solid var(--el-border-color);
      color: var(--el-text-color-primary);
      font-size: 13px;
      font-weight: 700;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
      transition:
        background-color 0.16s,
        border-color 0.16s,
        color 0.16s,
        transform 0.16s;

      &:hover {
        transform: translateY(-1px);
      }

      &.is-move {
        cursor: move;
        border-color: rgba(64, 158, 255, 0.42);
        background: rgba(236, 245, 255, 0.68);
        color: var(--el-color-primary);
      }

      &.is-move:hover,
      &.is-move.is-active {
        border-color: var(--el-color-primary);
        background: rgba(236, 245, 255, 0.9);
        box-shadow:
          inset 0 0 0 1px rgba(64, 158, 255, 0.28),
          0 6px 18px rgba(64, 158, 255, 0.18);
      }

      &.is-copy {
        cursor: copy;
        border-color: rgba(103, 194, 58, 0.42);
        background: rgba(240, 249, 235, 0.68);
        color: var(--el-color-success);
      }

      &.is-copy:hover,
      &.is-copy.is-active {
        border-color: var(--el-color-success);
        background: rgba(240, 249, 235, 0.9);
        box-shadow:
          inset 0 0 0 1px rgba(103, 194, 58, 0.28),
          0 6px 18px rgba(103, 194, 58, 0.18);
      }

      &.is-disabled {
        cursor: not-allowed;
        color: var(--el-text-color-placeholder);
        background: var(--el-fill-color-lighter);
        border-color: var(--el-border-color-lighter);
        box-shadow: none;
      }

      &.is-disabled:hover {
        transform: none;
        color: var(--el-text-color-placeholder);
        background: var(--el-fill-color-lighter);
        border-color: var(--el-border-color-lighter);
      }
    }
  }

  .schedule-placeholder {
    width: 10px;
    height: 26px;
    background-color: var(--el-color-primary);
    border-radius: 4px;
    margin: 0 4px;
    opacity: 0.5;
    display: inline-block;
    vertical-align: middle;
    pointer-events: none;
  }

  .schedule-detail {
    padding: 20px;
    padding-top: 0;
  }

  .scheduled-people {
    margin-top: 15px;

    .scheduled-person-item {
      display: flex;
      align-items: center;
      padding: 10px;
      margin-bottom: 10px;
      background: var(--el-fill-color-light);
      border-radius: 6px;
    }
  }

  .no-schedule {
    text-align: center;
    color: var(--el-text-color-secondary);
    padding: 20px;
  }

  .archived-badge {
    margin-left: 6px;
    font-size: 10px;
    opacity: 0.85;
  }

  :deep(.el-table) {
    .el-table__row.schedule-row-holiday {
      --schedule-row-bg: color-mix(
        in srgb,
        var(--schedule-holiday-color) 14%,
        var(--el-bg-color) 86%
      );
      --schedule-row-hover-bg: color-mix(
        in srgb,
        var(--schedule-holiday-color) 20%,
        var(--el-bg-color) 80%
      );
    }

    .el-table__row.schedule-row-transfer-workday {
      --schedule-row-bg: color-mix(
        in srgb,
        var(--schedule-transfer-workday-color) 6%,
        var(--el-bg-color) 94%
      );
      --schedule-row-hover-bg: color-mix(
        in srgb,
        var(--schedule-transfer-workday-color) 11%,
        var(--el-bg-color) 89%
      );
    }

    .el-table__row.schedule-row-weekend {
      --schedule-row-bg: color-mix(
        in srgb,
        var(--schedule-weekend-color) 8%,
        var(--el-bg-color) 92%
      );
      --schedule-row-hover-bg: color-mix(
        in srgb,
        var(--schedule-weekend-color) 13%,
        var(--el-bg-color) 87%
      );
    }

    .el-table__row.schedule-row-holiday > .el-table__cell,
    .el-table__row.schedule-row-transfer-workday > .el-table__cell,
    .el-table__row.schedule-row-weekend > .el-table__cell {
      background: var(--schedule-row-bg);
    }

    .el-table__row.schedule-row-holiday:hover > .el-table__cell,
    .el-table__row.schedule-row-transfer-workday:hover > .el-table__cell,
    .el-table__row.schedule-row-weekend:hover > .el-table__cell,
    .el-table__row.schedule-row-holiday.hover-row > .el-table__cell,
    .el-table__row.schedule-row-transfer-workday.hover-row > .el-table__cell,
    .el-table__row.schedule-row-weekend.hover-row > .el-table__cell {
      background: var(--schedule-row-hover-bg);
    }

    .el-table__row .el-table__cell {
      position: relative;
    }

    .el-table__body .el-table__cell > .cell {
      min-height: 34px;
      overflow: visible;
    }
  }

  :global(html.dark) & {
    .schedule-cell {
      &.is-transfer-workday-date {
        border-color: rgba(245, 108, 108, 0.5);
        background: color-mix(
          in srgb,
          var(--schedule-transfer-workday-color) 18%,
          var(--el-bg-color) 82%
        );
      }

      &.is-weekend-date {
        border-color: rgba(20, 184, 166, 0.56);
        background: color-mix(
          in srgb,
          var(--schedule-weekend-color) 20%,
          var(--el-bg-color) 80%
        );
      }

      &.is-transfer-workday-date:hover {
        border-color: rgba(245, 108, 108, 0.68);
        background: color-mix(
          in srgb,
          var(--schedule-transfer-workday-color) 26%,
          var(--el-bg-color) 74%
        );
      }

      &.is-weekend-date:hover {
        border-color: rgba(20, 184, 166, 0.74);
        background: color-mix(
          in srgb,
          var(--schedule-weekend-color) 30%,
          var(--el-bg-color) 70%
        );
      }
    }

    :deep(.el-table) {
      .el-table__row.schedule-row-transfer-workday {
        --schedule-row-bg: color-mix(
          in srgb,
          var(--schedule-transfer-workday-color) 18%,
          var(--el-bg-color) 82%
        );
        --schedule-row-hover-bg: color-mix(
          in srgb,
          var(--schedule-transfer-workday-color) 26%,
          var(--el-bg-color) 74%
        );
      }

      .el-table__row.schedule-row-weekend {
        --schedule-row-bg: color-mix(
          in srgb,
          var(--schedule-weekend-color) 20%,
          var(--el-bg-color) 80%
        );
        --schedule-row-hover-bg: color-mix(
          in srgb,
          var(--schedule-weekend-color) 30%,
          var(--el-bg-color) 70%
        );
      }
    }
  }
}

:deep(.schedule-handle-tooltip.el-popper) {
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color-light);
  box-shadow: var(--el-box-shadow-light);
}

:deep(.schedule-handle-tooltip.el-popper .el-popper__arrow::before) {
  background: var(--el-bg-color-overlay);
  border-color: var(--el-border-color-light);
}
</style>

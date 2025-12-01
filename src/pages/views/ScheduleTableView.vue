<template>
  <div class="schedule-table-view">
    <!-- <el-card>
      <template #header>
        <div class="page-header">
          <span>排班管理</span>
          <div class="header-actions">
            <el-date-picker v-model="currentMonth" type="month" placeholder="选择月份" format="YYYY年MM月"
                            value-format="YYYY-MM" @change="handleMonthChange" :editable="false" :clearable="false" />
            <el-button type="primary" @click="exportToExcel">
              <el-icon>
                <Download />
              </el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template> -->

    <div class="schedule-container">
      <!-- 左侧人员列表 -->
      <div class="people-sidebar">
        <h3>人员列表</h3>
        <div class="people-list">
          <el-scrollbar>
            <div
              v-for="person in peopleWithStats"
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
                  :class="{ 'over-rest': person.statistics?.isOverRest }"
                >
                  {{
                    person.statistics
                      ? person.statistics.isOverRest
                        ? `超休${Math.abs(
                            person.statistics.remainingRestDays
                          )}天`
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
        >
          <el-table-column prop="date" label="日期" width="100" fixed>
            <template #default="{ row }">
              <div class="date-cell">
                <div
                  :class="{
                    date: true,
                    'is-weekend':
                      row.weekdayName === '周六' || row.weekdayName === '周日',
                  }"
                >
                  {{ formatDate(row.date, "MM-DD") }}
                </div>
                <div
                  class="weekday"
                  :class="{
                    'is-weekend':
                      row.weekdayName === '周六' || row.weekdayName === '周日',
                  }"
                >
                  {{ row.weekdayName }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-for="shift in shifts"
            :key="shift.id"
            :label="shift.name"
            min-width="150"
          >
            <template #default="{ row }">
              <!-- 占位 撑开call高度 -->
              <el-space
                wrap
                style="opacity: 0; pointer-events: none; padding: 2px 0"
              >
                <template
                  v-for="personId in getSchedulePersonIds(row.date, shift.id)"
                  :key="personId"
                >
                  <el-tag class="schedule-tag" closable disable-transitions>
                    <span>
                      {{ getPersonName(personId) }}
                    </span>
                  </el-tag>
                </template>
              </el-space>
              <!-- 占满整个cell -->
              <div
                class="schedule-cell"
                :class="{
                  'drag-over':
                    dragState.active &&
                    dragState.targetDate === row.date &&
                    dragState.targetShiftId === shift.id,
                }"
                :data-date="row.date"
                :data-shift-id="shift.id"
                @drop="handleCellDrop($event, row.date, shift.id)"
                @dragover="handleCellDragOver($event, row.date, shift.id)"
                @dragleave="handleCellDragLeave()"
                @click="handleCellClick(row.date, shift.id)"
              >
                <!-- 整格拖拽手柄 -->
                <div
                  v-if="getSchedulePersonIds(row.date, shift.id).length > 0"
                  class="cell-handle"
                  draggable="true"
                  @dragstart.stop="
                    handleCellHandleDragStart($event, row.date, shift.id)
                  "
                  @click.stop
                  title="拖拽移动，按住Ctrl拖拽复制"
                >
                  <el-icon>
                    <Rank />
                  </el-icon>
                </div>
                <el-space wrap>
                  <template
                    v-for="(personId, index) in getSchedulePersonIds(
                      row.date,
                      shift.id
                    )"
                    :key="personId"
                  >
                    <!-- 插入点在当前元素之前 -->
                    <div
                      v-if="showPlaceholderAt(row.date, shift.id, index)"
                      class="schedule-placeholder"
                    ></div>

                    <el-tag
                      class="schedule-tag"
                      :data-person-id="personId"
                      :class="{
                        'is-dragging':
                          dragState.active &&
                          dragState.personId === personId &&
                          dragState.type === 'schedule',
                      }"
                      closable
                      disable-transitions
                      @close="removeSchedule(personId, row.date, shift.id)"
                      :draggable="true"
                      @dragstart="
                        handleScheduleDragStart(
                          $event,
                          personId,
                          row.date,
                          shift.id
                        )
                      "
                      @dragend="handleDragEnd"
                      :style="{
                        backgroundColor: getPersonColor(personId),
                        color: getAdaptiveTextColor(getPersonColor(personId)),
                        opacity:
                          dragState.active &&
                          dragState.personId === personId &&
                          dragState.type === 'schedule'
                            ? 0.4
                            : 1,
                      }"
                    >
                      <span>
                        {{ getPersonName(personId) }}
                      </span>
                    </el-tag>
                  </template>

                  <!-- 插入点在列表末尾 -->
                  <div
                    v-if="
                      showPlaceholderAt(
                        row.date,
                        shift.id,
                        getSchedulePersonIds(row.date, shift.id).length
                      )
                    "
                    class="schedule-placeholder"
                  ></div>
                </el-space>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 排班详情对话框 -->
    <el-dialog v-model="showScheduleDetail" title="排班详情" width="400px">
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
                  type="danger"
                  size="small"
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
    <!-- </el-card> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, toRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Rank } from "@element-plus/icons-vue";
import type {
  Person,
  PersonWithStatistics,
  Shift,
  Schedule,
  DragData,
} from "@/types";
import { repositories } from "@/repositories";
import {
  getAdaptiveTextColor,
  getMonthDates,
  formatDate,
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
const people = ref<Person[]>([]);
const shifts = ref<Shift[]>([]);
const schedules = ref<Schedule[]>([]);
const loading = ref(false);
const showScheduleDetail = ref(false);
const selectedDate = ref("");
const selectedShiftId = ref("");
const extraRestDaysForCurrentMonth = ref(0);

const dragState = ref<{
  active: boolean;
  type: "person" | "schedule" | "cell";
  personId: string;
  sourceDate?: string;
  sourceShiftId?: string;
  targetDate?: string;
  targetShiftId?: string;
  targetIndex?: number;
}>({
  active: false,
  type: "person",
  personId: "",
});

// 计算属性
const peopleWithStats = computed(() => {
  const month = currentMonth.value;
  if (!month) return [];
  // TypeScript 推断问题：month 在此处已确保非 null，但类型系统未能识别
  return people.value.map((person) => {
    const stats = calculatePersonStatistics(person.id, month as string);
    return {
      ...person,
      statistics: stats,
    };
  });
});

const monthDates = computed(() => {
  if (!currentMonth.value) return [];
  return getMonthDates(currentMonth.value);
});

// 方法
/**
 * 加载数据
 */
const loadData = async () => {
  if (!currentMonth.value) return;
  
  loading.value = true;
  try {
    const [peopleData, shiftsData, schedulesData] = await Promise.all([
      repositories.people.getAll(),
      repositories.shifts.getAll(),
      repositories.schedules.getByMonth(currentMonth.value),
    ]);

    people.value = peopleData;
    shifts.value = shiftsData;
    schedules.value = schedulesData;

    try {
      const [year, monthNum] = currentMonth.value.split("-").map(Number);
      const config = await repositories.extraRestConfigs.getByYearAndMonth(
        year,
        monthNum
      );
      extraRestDaysForCurrentMonth.value = config?.extraRestDays || 0;
    } catch (error: any) {
      console.error("[extraRest-load-error]", {
        time: new Date().toISOString(),
        params: { month: currentMonth.value },
        message: error?.message,
        stack: error?.stack,
      });
      extraRestDaysForCurrentMonth.value = 0;
    }
  } catch (error) {
    console.error("加载数据失败:", error);
    ElMessage.error("加载数据失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 计算人员统计信息
 */
const calculatePersonStatistics = (personId: string, month: string) => {
  const person = people.value.find((p) => p.id === personId);
  if (!person) return undefined;

  // 这里简化计算，实际应该从Repository获取
  const restShift = shifts.value.find((s) => (s as any).isRest === true);
  if (!restShift) return undefined;

  const monthSchedules = schedules.value.filter(
    (s) =>
      s.personId === personId && s.month === month && s.shiftId === restShift.id
  );

  const scheduledRestDays = monthSchedules.length;
  const totalRestDays =
    person.baseRestDays + extraRestDaysForCurrentMonth.value;
  const remainingRestDays = totalRestDays - scheduledRestDays;

  return {
    personId,
    month,
    baseRestDays: person.baseRestDays,
    extraRestDays: extraRestDaysForCurrentMonth.value,
    scheduledRestDays,
    remainingRestDays,
    isOverRest: remainingRestDays < 0,
  };
};

const setMonth = async (month: string) => {
  if (!month || month === currentMonth.value) return;
  emit("update:current-month", month);
};

/**
 * 处理人员拖拽开始
 */
const handlePersonDragStart = (
  event: DragEvent,
  person: PersonWithStatistics
) => {
  if (!event.dataTransfer) return;

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
const handleDragEnd = () => {
  dragState.value = {
    active: false,
    type: "person",
    personId: "",
    targetDate: undefined,
    targetShiftId: undefined,
    targetIndex: undefined,
  };
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

/**
 * 处理单元格拖拽进入/悬停
 */
const handleCellDragOver = (
  event: DragEvent,
  date: string,
  shiftId: string
) => {
  event.preventDefault();

  dragState.value.targetDate = date;
  dragState.value.targetShiftId = shiftId;

  const cell = event.currentTarget as HTMLElement;
  const tags = Array.from(
    cell.querySelectorAll(".schedule-tag:not(.is-dragging)")
  );

  // 如果是整格拖拽，不计算插入位置，直接放在最后
  if (dragState.value.type === "cell") {
    dragState.value.targetIndex = -1;
    return;
  }

  let insertIndex = tags.length;
  if (tags.length > 0) {
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const rect = tag.getBoundingClientRect();

      // 如果鼠标在当前元素所在行的下方，说明当前元素肯定在插入点之前
      if (event.clientY > rect.bottom) {
        continue;
      }

      // 如果鼠标在当前元素所在行的上方，说明当前元素在插入点之后
      if (event.clientY < rect.top) {
        insertIndex = i;
        break;
      }

      // 如果在同一行，比较 X
      const centerX = rect.left + rect.width / 2;
      if (event.clientX < centerX) {
        insertIndex = i;
        break;
      }
    }
  }

  // 如果是同单元格内的拖拽，需要将 visual index 转换为真实列表的 index
  if (
    dragState.value.active &&
    dragState.value.type === "schedule" &&
    dragState.value.sourceDate === date &&
    dragState.value.sourceShiftId === shiftId
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

  dragState.value.targetIndex = insertIndex;
};

const handleCellDragLeave = () => {
  // no-op
};

/**
 * 处理单元格放置
 */
const handleCellDrop = async (
  event: DragEvent,
  date: string,
  shiftId: string
) => {
  event.preventDefault();
  if (!event.dataTransfer) return;

  try {
    const dragDataStr = event.dataTransfer.getData("text/plain");
    const dragData: DragData = JSON.parse(dragDataStr);
    const targetIndex = dragState.value.targetIndex ?? -1;

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

      const sourceSchedule = schedules.value.find(
        (s) =>
          s.personId === dragData.personId &&
          s.date === dragData.sourceDate &&
          s.shiftId === dragData.sourceShiftId
      );
      if (sourceSchedule) {
        await repositories.schedules.delete(sourceSchedule.id);
        schedules.value = schedules.value.filter(
          (s) => s.id !== sourceSchedule.id
        );
      }
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

      // 判断是复制还是移动 (Ctrl键)
      const isCopy = event.ctrlKey || event.metaKey;

      let conflictCount = 0;
      const newSchedulesToCreate: any[] = [];

      // 获取目标单元格现有的最大order
      const existingTargetSchedules = schedules.value.filter(
        (s) => s.date === date && s.shiftId === shiftId
      );
      let maxOrder = existingTargetSchedules.reduce(
        (max, s) => Math.max(max, s.order || 0),
        0
      );

      for (const sourceItem of sourceSchedules) {
        // 检查目标日期冲突
        if (sourceItem.date !== date) {
          const conflictSchedule = schedules.value.find(
            (s) => s.personId === sourceItem.personId && s.date === date
          );
          if (conflictSchedule) {
            conflictCount++;
            continue;
          }
        }

        // 检查目标单元格是否已存在该人
        const alreadyInCell = schedules.value.find(
          (s) =>
            s.personId === sourceItem.personId &&
            s.date === date &&
            s.shiftId === shiftId
        );
        if (alreadyInCell) {
          continue;
        }

        maxOrder++;
        newSchedulesToCreate.push({
          personId: sourceItem.personId,
          shiftId: shiftId,
          date: date,
          month: currentMonth.value!,
          order: maxOrder,
          sourceId: sourceItem.id, // 暂存源ID用于移动时的删除
        });
      }

      if (newSchedulesToCreate.length === 0) {
        if (conflictCount > 0) {
          ElMessage.warning(`操作失败：所有人员在目标日期已有排班`);
        }
        handleDragEnd();
        return;
      }

      // 如果是移动，删除源记录
      if (!isCopy) {
        const movedPersonIds = newSchedulesToCreate.map((n) => n.personId);
        const schedulesToDelete = sourceSchedules.filter((s) =>
          movedPersonIds.includes(s.personId)
        );

        // 乐观更新
        schedules.value = schedules.value.filter(
          (s) => !schedulesToDelete.find((del) => del.id === s.id)
        );

        // 后台删除
        for (const s of schedulesToDelete) {
          await repositories.schedules.delete(s.id);
        }
      }

      // 创建新记录
      for (const newItem of newSchedulesToCreate) {
        // 删除临时字段 sourceId
        const { sourceId, ...dataToCreate } = newItem;
        await repositories.schedules.create(dataToCreate);
      }

      const actionName = isCopy ? "复制" : "移动";
      let msg = `${actionName}成功 ${newSchedulesToCreate.length} 人`;
      if (conflictCount > 0) {
        msg += `，${conflictCount} 人因冲突跳过`;
      }
      ElMessage.success(msg);

      await loadData();
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
    if ((shift as any)?.isRest === true) {
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
              `${person.name} 的剩余休息天数为 ${stats.remainingRestDays}，确定要继续排休吗？`,
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

    const existingCell = schedules.value
      .filter((s) => s.date === date && s.shiftId === shiftId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (targetIndex >= 0) {
      const newSchedules = [...existingCell];
      const newScheduleData = {
        personId: dragData.personId,
        shiftId,
        date,
        month: currentMonth.value!,
        order: 0,
      };

      newSchedules.splice(targetIndex, 0, newScheduleData as any);
      const updates = newSchedules.map((s, idx) => ({
        id: s.id,
        data: { order: idx + 1 },
      }));

      await repositories.schedules.create({
        ...newScheduleData,
        order: targetIndex + 1,
      });

      const updatesToRun = updates.filter((u) => u.id);
      if (updatesToRun.length > 0) {
        if ((repositories as any)?.schedules?.batchUpdate) {
          await (repositories.schedules as any).batchUpdate(updatesToRun);
        } else {
          for (const u of updatesToRun) {
            await repositories.schedules.update(u.id, u.data);
          }
        }
      }
    } else {
      const maxOrder = existingCell.reduce(
        (m, s) => Math.max(m, s.order ?? 0),
        0
      );
      await repositories.schedules.create({
        personId: dragData.personId,
        shiftId,
        date,
        month: currentMonth.value!,
        order: maxOrder + 1,
      });
    }

    ElMessage.success("排班成功");
    await loadData();
  } catch (error) {
    console.error("排班失败:", error);
    ElMessage.error("排班失败");
  } finally {
    handleDragEnd();
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
  const cellList = schedules.value
    .filter((s) => s.date === date && s.shiftId === shiftId)
    .sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      const at = a.createdAt?.getTime?.() ? a.createdAt.getTime() : 0;
      const bt = b.createdAt?.getTime?.() ? b.createdAt.getTime() : 0;
      return at - bt;
    });

  const fromIndex = cellList.findIndex((s) => s.personId === personId);
  if (fromIndex < 0 || targetIndex < 0) return;

  const list = [...cellList];
  const [moved] = list.splice(fromIndex, 1);

  // 修正插入位置
  let finalIndex = targetIndex;

  list.splice(finalIndex, 0, moved);

  const updates = list.map((s, idx) => ({
    id: s.id,
    data: { order: idx + 1 },
  }));

  if ((repositories as any)?.schedules?.batchUpdate) {
    await (repositories.schedules as any).batchUpdate(updates);
  } else {
    for (const u of updates) {
      await repositories.schedules.update(u.id, u.data);
    }
  }

  ElMessage.success("已更新排序");
  await loadData();
};

const handleCellHandleDragStart = (
  event: DragEvent,
  sourceDate: string,
  sourceShiftId: string
) => {
  if (!event.dataTransfer) return;

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
    if (!event.dataTransfer) return;
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
  return schedules.value
    .filter((s) => s.date === date && s.shiftId === shiftId)
    .sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      const at = a.createdAt?.getTime?.() ? a.createdAt.getTime() : 0;
      const bt = b.createdAt?.getTime?.() ? b.createdAt.getTime() : 0;
      return at - bt;
    })
    .map((s) => s.personId);
};

/**
 * 获取人员颜色
 */
const getPersonColor = (personId: string) => {
  const person = people.value.find((p) => p.id === personId);
  return person?.color || "#ccc";
};

/**
 * 获取人员姓名
 */
const getPersonName = (personId: string) => {
  const person = people.value.find((p) => p.id === personId);
  return person?.name || "未知";
};


/**
 * 获取班次名称
 */
const getShiftName = (shiftId: string) => {
  const shift = shifts.value.find((s) => s.id === shiftId);
  return shift?.name || "未知班次";
};

/**
 * 删除排班记录
 */
const removeSchedule = async (
  personId: string,
  date: string,
  shiftId: string
) => {
  try {
    const schedule = schedules.value.find(
      (s) => s.personId === personId && s.date === date && s.shiftId === shiftId
    );

    if (schedule) {
      await repositories.schedules.delete(schedule.id);
      ElMessage.success("删除排班成功");
      await loadData();
    }
  } catch (error) {
    console.error("删除排班失败:", error);
    ElMessage.error("删除排班失败");
  }
};

// 页面加载时初始化数据
onMounted(() => {
  loadData();
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

    h3 {
      margin: 0 0 15px 0;
      color: var(--el-text-color-primary);
    }

    .people-list {
      width: calc(100% + 10px);
      height: calc(100% - 30px);

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
        transition: all 0.3s;

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
  }

  .schedule-table-container {
    flex: 1;
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    overflow: auto;

    :deep(.schedule-tag) {
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
  }

  .date-cell {
    display: flex;
    font-size: 14px;
    text-align: center;
    align-items: center;
    min-height: 28px;

    .weekday {
      margin-left: 10px;
    }

    .is-weekend {
      color: var(--el-color-warning);
      font-weight: 600;
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

  .schedule-cell {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    min-height: 20px;
    padding: 5px;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }

    &.drag-over {
      border-color: var(--el-color-success);
      background: var(--el-color-success-light-9);
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
      transition: all 0.2s;
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

  .schedule-person {
    display: flex;
    align-items: center;
    padding: 4px 6px;
    margin-bottom: 4px;
    background: var(--el-fill-color-blank);
    border-radius: 4px;
    border: 1px solid #e4e7ed;
    cursor: move;
  }

  .person-color-small {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
  }

  .person-name-small {
    flex: 1;
    font-size: 12px;
    color: var(--el-text-color-regular);
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

  :deep(.el-table) {
    .el-table__row .el-table__cell {
      position: relative;
    }
  }
}
</style>

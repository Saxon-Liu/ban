<template>
  <div class="schedule-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <span>排班管理</span>
          <div class="header-actions">
            <el-date-picker
              v-model="currentMonth"
              type="month"
              placeholder="选择月份"
              format="YYYY年MM月"
              value-format="YYYY-MM"
              @change="handleMonthChange"
            />
            <el-button type="primary" @click="exportToExcel">
              <el-icon>
                <Download />
              </el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template>

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
                @dragstart="
                  handlePersonDragStart($event, person as PersonWithStatistics)
                "
              >
                <div
                  class="person-color"
                  :style="{ backgroundColor: person.color }"
                ></div>
                <div class="person-info">
                  <span class="person-name">{{ person.name }}</span>
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
            <el-table-column prop="date" label="日期" width="120" fixed>
              <template #default="{ row }">
                <div class="date-cell">
                  <div class="date">{{ formatDate(row.date, "MM-DD") }}</div>
                  <div class="weekday">{{ row.weekdayName }}</div>
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
                <el-space wrap style="opacity: 0;pointer-events: none;">
                  <template
                    v-for="personId in getSchedulePersonIds(row.date, shift.id)"
                    :key="personId"
                  >
                    <el-tag
                      size="large"
                      class="schedule-tag"
                      closable
                      disable-transitions
                    >
                      <span>
                        {{ getPersonName(personId) }}
                      </span>
                    </el-tag>
                  </template>
                </el-space>
                <!-- 占满整个cell -->
                <div
                  class="schedule-cell"
                  :data-date="row.date"
                  :data-shift-id="shift.id"
                  @drop="handleCellDrop($event, row.date, shift.id)"
                  @dragover.prevent
                  @click="handleCellClick(row.date, shift.id)"
                >
                  <el-space wrap>
                    <template
                      v-for="personId in getSchedulePersonIds(
                        row.date,
                        shift.id
                      )"
                      :key="personId"
                    >
                      <el-tag
                        size="large"
                        class="schedule-tag"
                        closable
                        disable-transitions
                        @close="removeSchedule(personId, row.date, shift.id)"
                        :draggable="true"
                        @dragstart="handleScheduleDragStart($event, personId, row.date, shift.id)"
                        :style="{
                          backgroundColor: getPersonColor(personId),
                          color: getAdaptiveTextColor(getPersonColor(personId)),
                        }"
                      >
                        <span>
                          {{ getPersonName(personId) }}
                        </span>
                      </el-tag>
                    </template>
                  </el-space>
                  <!-- <div
                    v-for="personId in getSchedulePersonIds(row.date, shift.id)"
                    :key="personId"
                    class="schedule-person"
                    :draggable="true"
                    @dragstart="
                      handleScheduleDragStart(
                        $event,
                        personId,
                        row.date,
                        shift.id
                      )
                    "
                  >
                    <div
                      class="person-color-small"
                      :style="{ backgroundColor: getPersonColor(personId) }"
                    ></div>
                    <span class="person-name-small">{{
                      getPersonName(personId)
                    }}</span>
                    <el-button
                      type="danger"
                      size="small"
                      circle
                      @click.stop="removeSchedule(personId, row.date, shift.id)"
                    >
                      <el-icon>
                        <Close />
                      </el-icon>
                    </el-button>
                  </div> -->
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import type {
  Person,
  PersonWithStatistics,
  Shift,
  Schedule,
  DragData,
} from "@/types";
//
import { repositories } from "@/repositories";
import { excelExportService } from "@/services";
import { getMonthDates, formatDate, getCurrentMonth } from "@/utils";

// 响应式数据
const currentMonth = ref(getCurrentMonth());
const people = ref<Person[]>([]);
const shifts = ref<Shift[]>([]);
const schedules = ref<Schedule[]>([]);
const loading = ref(false);
const showScheduleDetail = ref(false);
const selectedDate = ref("");
const selectedShiftId = ref("");
const extraRestDaysForCurrentMonth = ref(0);

// 计算属性
const peopleWithStats = computed(() => {
  return people.value.map((person) => {
    const stats = calculatePersonStatistics(person.id, currentMonth.value);
    return {
      ...person,
      statistics: stats,
    };
  });
});

const monthDates = computed(() => {
  return getMonthDates(currentMonth.value);
});

// 方法
/**
 * 加载数据
 */
const loadData = async () => {
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
  if (!person) return null;

  // 这里简化计算，实际应该从Repository获取
  const restShift = shifts.value.find((s) => (s as any).isRest === true);
  if (!restShift) return null;

  const monthSchedules = schedules.value.filter(
    (s) =>
      s.personId === personId && s.month === month && s.shiftId === restShift.id
  );

  const scheduledRestDays = monthSchedules.length;
  const totalRestDays = person.baseRestDays + extraRestDaysForCurrentMonth.value;
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

/**
 * 处理月份变更
 */
const handleMonthChange = async () => {
  await loadData();
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

  event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = "move";
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

    if (
      dragData.type === "schedule" &&
      dragData.sourceDate &&
      dragData.sourceShiftId
    ) {
      const isSameCell =
        dragData.sourceDate === date && dragData.sourceShiftId === shiftId;
      if (isSameCell) {
        return;
      }

      const movingSameDay = dragData.sourceDate === date;
      if (!movingSameDay) {
        const existingScheduleForTargetDay = schedules.value.find(
          (s) => s.personId === dragData.personId && s.date === date
        );
        if (existingScheduleForTargetDay) {
          ElMessage.warning("该员工当天已有排班，请先删除原有排班");
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
        schedules.value = schedules.value.filter((s) => s.id !== sourceSchedule.id);
      }
    }

    // 从人员列表拖拽时，检查当天是否已有排班
    if (dragData.type === "person") {
      const existingSchedule = schedules.value.find(
        (s) => s.personId === dragData.personId && s.date === date
      );
      if (existingSchedule) {
        ElMessage.warning("该员工当天已有排班，请先删除原有排班");
        return;
      }
    }

    // 检查是否为休息班次
    const shift = shifts.value.find((s) => s.id === shiftId);
    if ((shift as any)?.isRest === true) {
      const person = people.value.find((p) => p.id === dragData.personId);
      if (person) {
        const stats = calculatePersonStatistics(person.id, currentMonth.value);
        if (stats && stats.remainingRestDays <= 0) {
          await ElMessageBox.confirm(
            `${person.name} 的剩余休息天数为 ${stats.remainingRestDays}，确定要继续排休吗？`,
            "超额排休提醒",
            {
              confirmButtonText: "确定",
              cancelButtonText: "取消",
              type: "warning",
            }
          ).catch(() => {
            return; // 用户取消
          });
        }
      }
    }

    // 创建新排班记录
    await repositories.schedules.create({
      personId: dragData.personId,
      shiftId,
      date,
      month: currentMonth.value,
    });

    ElMessage.success("排班成功");
    await loadData();
  } catch (error) {
    console.error("排班失败:", error);
    ElMessage.error("排班失败");
  }
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

const getAdaptiveTextColor = (bgColor: string) => {
  try {
    const hex = bgColor.replace("#", "");
    const bigint = parseInt(
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex,
      16
    );
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 186 ? "#000" : "#fff";
  } catch {
    return "#000";
  }
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

/**
 * 导出Excel
 */
const exportToExcel = async () => {
  try {
    const blob = await excelExportService.exportMonthlySchedule(
      currentMonth.value,
      shifts.value,
      people.value,
      schedules.value
    );

    const filename = `${currentMonth.value}排班表.xlsx`;
    excelExportService.downloadExcel(blob, filename);

    ElMessage.success("Excel导出成功");
  } catch (error) {
    console.error("导出Excel失败:", error);
    ElMessage.error("导出Excel失败");
  }
};

// 页面加载时初始化数据
onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
.schedule-page {
  height: 100%;
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

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
      // padding-right: 10px;
      height: calc(100% - 30px);
      // overflow-y: auto;
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
          // transform: translateY(-1px);
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
  }

  .person-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .person-rest-days {
    font-size: 12px;
    color: var(--el-color-success);
    margin-top: 2px;

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
      .el-tag__close {
        color: inherit;
      }
    }
  }

  .date-cell {
    text-align: center;
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

<template>
  <div class="schedule-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <div class="header-title">
            <span>排班管理</span>
            <el-radio-group v-model="activeView">
              <el-radio-button label="table">按日期</el-radio-button>
              <el-radio-button label="person">按人员</el-radio-button>
            </el-radio-group>
          </div>

          <div class="header-actions">
            <el-tooltip content="上一月" placement="top">
              <el-button
                circle
                size="small"
                :icon="ArrowLeft"
                @click="jumpToMonth(-1)"
                style="margin-right: 10px"
              />
            </el-tooltip>

            <el-date-picker
              v-model="currentMonth"
              type="month"
              placeholder="选择月份"
              format="YYYY年MM月"
              value-format="YYYY-MM"
              @change="handleMonthChange"
              :editable="false"
              :clearable="false"
              style="margin-right: 10px; width: 130px"
            />
            <el-tooltip content="下一月" placement="top">
              <el-button
                circle
                size="small"
                :icon="ArrowRight"
                @click="jumpToMonth(1)"
              />
            </el-tooltip>
            <el-button
              type="primary"
              @click="handleExport"
              :loading="exportLoading"
            >
              <el-icon>
                <Download />
              </el-icon>
              导出Excel
            </el-button>

            <el-tooltip content="清空当月排班" placement="top">
              <el-button
                type="danger"
                plain
                @click="handleClearCurrentMonth"
                :disabled="clearingSchedules"
                :icon="Delete"
              >
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>
      <transition name="fade" mode="out-in">
        <ScheduleTableView
          v-if="isTableView"
          ref="tableViewRef"
          key="table"
          :current-month="currentMonth"
          @update:current-month="handleMonthChange"
        />
        <PersonCalendarView
          v-else
          ref="personViewRef"
          key="person"
          :current-month="currentMonth"
          @update:current-month="handleMonthChange"
        />
      </transition>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Download,
  Delete,
  ArrowLeft,
  ArrowRight,
} from "@element-plus/icons-vue";
import ScheduleTableView from "./views/ScheduleTableView.vue";
import PersonCalendarView from "./views/PersonCalendarView.vue";
import { getCurrentMonth, getNextMonth } from "@/utils";
import { excelExportService, scheduleService } from "@/services";
import { repositories } from "@/repositories";
import dayjs from "dayjs";

type ScheduleTableViewInstance = InstanceType<typeof ScheduleTableView> & {
  currentMonth?: { value: string };
  setMonth?: (month: string) => Promise<void>;
  loadData?: () => Promise<void>;
};

type PersonCalendarViewInstance = InstanceType<typeof PersonCalendarView> & {
  currentMonth?: { value: string };
  setMonth?: (month: string) => Promise<void>;
  loadData?: () => Promise<void>;
};

type ViewMode = "table" | "person";

const LAST_VIEWED_MONTH_KEY = "schedule_last_viewed_month";
const getInitialMonth = () => {
  if (typeof window === "undefined") {
    return getNextMonth(getCurrentMonth());
  }
  const saved = window.localStorage.getItem(LAST_VIEWED_MONTH_KEY);
  return saved || getNextMonth(getCurrentMonth());
};

const activeView = ref<ViewMode>("table");
const tableViewRef = ref<ScheduleTableViewInstance | null>(null);
const personViewRef = ref<PersonCalendarViewInstance | null>(null);
const currentMonth = ref<string | null>(getInitialMonth());
const exportLoading = ref(false);
const clearingSchedules = ref(false);

const isTableView = computed(() => activeView.value === "table");

const handleMonthChange = async (val: string | null) => {
  if (!val) return;
  currentMonth.value = val;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_VIEWED_MONTH_KEY, val);
  }
};

const jumpToMonth = (delta: number) => {
  if (!currentMonth.value) return;
  const target = dayjs(`${currentMonth.value}-01`)
    .add(delta, "month")
    .format("YYYY-MM");
  handleMonthChange(target);
};

const handleExport = async () => {
  if (exportLoading.value) return;
  if (!currentMonth.value) {
    ElMessage.warning("请选择要导出的月份");
    return;
  }

  exportLoading.value = true;
  try {
    const [peopleData, shiftData, scheduleData] = await Promise.all([
      repositories.people.getAllIncludingArchived(),
      repositories.shifts.getAllIncludingArchived(),
      repositories.schedules.getByMonth(currentMonth.value),
    ]);

    const blob = await excelExportService.exportMonthlySchedule(
      currentMonth.value,
      shiftData,
      peopleData,
      scheduleData
    );

    const result = await excelExportService.downloadExcel(
      blob,
      `${currentMonth.value}排班表.xlsx`
    );
    if (!result.saved) {
      return;
    }
    ElMessage.success(
      result.filePath ? `已导出到 ${result.filePath}` : "Excel导出成功"
    );
  } catch (error) {
    console.error("导出Excel失败:", error);
    ElMessage.error("导出Excel失败，请稍后重试");
  } finally {
    exportLoading.value = false;
  }
};

const handleClearCurrentMonth = async () => {
  if (clearingSchedules.value) return;
  if (!currentMonth.value) {
    ElMessage.warning("请选择要清空的月份");
    return;
  }

  clearingSchedules.value = true;
  let clearError: unknown = null;
  let clearedCount = 0;
  try {
    const confirmMessage = `确认 <strong style="color: var(--el-color-danger);">清除 ${currentMonth.value} 的所有排班数据</strong>？<br/>此操作 <strong style="color: var(--el-color-danger);">不可恢复</strong>！`;
    await ElMessageBox.confirm(confirmMessage, "清空排班确认", {
      confirmButtonText: "确认清除",
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
        instance.confirmButtonText = "清除中...";
        try {
          clearedCount = await scheduleService.clearMonthSchedules(
            currentMonth.value!
          );
        } catch (error) {
          clearError = error;
        } finally {
          instance.confirmButtonLoading = false;
          instance.confirmButtonText = previousText;
          done();
        }
      },
    });
  } catch {
    clearingSchedules.value = false;
    return;
  }

  try {
    if (clearError) {
      throw clearError;
    }

    if (clearedCount === 0) {
      ElMessage.info("当前月份暂无排班数据");
      return;
    }

    ElMessage.success("已清除当月排班");

    await Promise.all([
      tableViewRef.value?.loadData?.(),
      personViewRef.value?.loadData?.(),
    ]);
  } catch (error) {
    console.error("清除排班失败", error);
    ElMessage.error("清除排班失败，请稍后重试");
  } finally {
    clearingSchedules.value = false;
  }
};
</script>

<style lang="scss" scoped>
.schedule-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 800px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .header-title {
      display: flex;
      align-items: center;
      gap: 20px;
    }
  }

  .header-actions {
    display: flex;
    // gap: 10px;
    align-items: center;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

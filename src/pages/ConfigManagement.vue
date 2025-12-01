<template>
  <div class="config-management-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span style="height: 32px">配置管理</span>
        </div>
      </template>

      <div class="actions-container">
        <div class="action-item">
          <div class="action-info">
            <h3>导出配置</h3>
            <p>将当前的人员、班次和额外休息配置导出为JSON文件进行备份。</p>
          </div>
          <div class="action-controls">
            <el-button type="primary" @click="handleExport">
              导出配置
            </el-button>
            <el-checkbox v-model="exportSchedules" class="export-option">
              同时导出排班记录
            </el-checkbox>
          </div>
        </div>

        <div class="action-item">
          <div class="action-info">
            <h3>导入配置</h3>
            <p>从JSON文件恢复配置。注意：导入将覆盖具有相同ID的现有配置，并合并新配置。</p>
          </div>
          <el-button type="warning" @click="handleImport">
            导入配置
          </el-button>
        </div>

        <div class="action-item danger">
          <div class="action-info">
            <h3>初始化系统（高危）</h3>
            <p>
              该操作将删除所有数据（人员、班次、排班、配置）并重新加载默认班次。
              <strong>请先导出配置备份！</strong>
            </p>
          </div>
          <el-button type="danger" plain @click="handleReinitialize" :loading="reinitializing">
            初始化系统
          </el-button>
        </div>
      </div>
    </el-card>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { repositories } from "@/repositories";
import { dbManager } from "@/repositories/IndexedDBManager";
import { getCurrentDateTime } from "@/utils/common";
import { initializeDefaultShifts } from "@/services/initialization";
import { DEFAULT_SHIFTS } from "@/utils";
import type { Shift, Schedule } from "@/types";

const fileInput = ref<HTMLInputElement | null>(null);
const reinitializing = ref(false);
const exportSchedules = ref(true);

const normalizeShifts = (shifts: Shift[] = []) => {
  const defaultRestShift = DEFAULT_SHIFTS.find((shift) => shift.isRest);
  const dedupMap = new Map<string, Shift>();

  for (const shift of shifts) {
    const normalized: Shift = { ...shift } as Shift;
    if (shift.isRest) {
      if (defaultRestShift) {
        normalized.id = defaultRestShift.id;
        normalized.name = shift.name || defaultRestShift.name;
        normalized.color = shift.color || defaultRestShift.color;
      }
      normalized.isRest = true;
    }

    if (dedupMap.has(normalized.id)) {
      dedupMap.set(normalized.id, { ...dedupMap.get(normalized.id)!, ...normalized });
    } else {
      dedupMap.set(normalized.id, normalized);
    }
  }

  return Array.from(dedupMap.values());
};

/**
 * 导出配置
 */
const handleExport = async () => {
  try {
    const [people, shifts, extraRestConfigs, scheduleData] = await Promise.all([
      repositories.people.getAll(),
      repositories.shifts.getAll(),
      repositories.extraRestConfigs.getAll(),
      exportSchedules.value ? repositories.schedules.getAll() : Promise.resolve([]),
    ]);

    const normalizedShifts = normalizeShifts(shifts as Shift[]);
    const normalizedSchedules = exportSchedules.value
      ? (scheduleData as Schedule[]).map((schedule) => ({
          ...schedule,
          createdAt: schedule.createdAt?.toString?.() ?? schedule.createdAt,
          updatedAt: schedule.updatedAt?.toString?.() ?? schedule.updatedAt,
        }))
      : undefined;

    const configData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        people,
        shifts: normalizedShifts,
        extraRestConfigs,
        schedules: normalizedSchedules,
      },
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `排班配置备份_${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    ElMessage.success("配置导出成功");
  } catch (error: any) {
    console.error("导出配置失败:", error);
    ElMessage.error("导出配置失败: " + (error.message || "未知错误"));
  }
};

const handleReinitialize = async () => {
  try {
    await ElMessageBox.confirm(
      `确认 <strong style="color: var(--el-color-danger);">删除所有数据并重新初始化系统</strong>？<br/>该操作 <strong style="color: var(--el-color-danger);">不可撤销</strong>，请确保已备份。`,
      "初始化系统",
      {
        confirmButtonText: "确认初始化",
        cancelButtonText: "取消",
        confirmButtonClass: "el-button--danger",
        cancelButtonClass: "el-button--primary",
        dangerouslyUseHTMLString: true,
        type: "warning",
      }
    );
  } catch {
    return;
  }

  reinitializing.value = true;
  try {
    await dbManager.deleteDatabase();
    await initializeDefaultShifts();
    ElMessage.success("系统已重新初始化，页面即将刷新");
    setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    console.error("系统初始化失败", error);
    ElMessage.error("初始化失败，请稍后重试");
  } finally {
    reinitializing.value = false;
  }
};

/**
 * 触发导入文件选择
 */
const handleImport = () => {
  if (fileInput.value) {
    fileInput.value.value = "";
    fileInput.value.click();
  }
};

/**
 * 处理文件选择
 */
const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const configData = JSON.parse(text);

    if (!configData.data || !configData.data.people || !configData.data.shifts) {
      throw new Error("无效的配置文件格式");
    }

    await ElMessageBox.confirm(
      "导入将覆盖现有的同ID配置数据，且操作不可撤销。是否继续？",
      "确认导入",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    await importData(configData.data);
    ElMessage.success("配置导入成功，请刷新页面查看最新数据");
    
    // 稍微延迟后刷新页面以确保所有状态更新
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error: any) {
    if (error !== "cancel") {
      console.error("导入配置失败:", error);
      const errorMsg = error.message || "未知错误";
      ElMessage.error({
        message: `导入配置失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    }
  }
};

/**
 * 将字符串时间戳转换为 Date 对象
 */
const parseTimestamp = (value: any): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return getCurrentDateTime();
};

/**
 * 执行数据导入
 */
const importData = async (data: any) => {
  const { people, shifts, extraRestConfigs, schedules: schedulePayload } = data;
  const now = getCurrentDateTime();
  const db = await dbManager.getDB();

  const transaction = db.transaction(
    ['people', 'shifts', 'extraRestConfigs', 'schedules'],
    'readwrite'
  );

  // 导入人员
  if (Array.isArray(people)) {
    for (const p of people) {
      // 验证必要字段
      if (!p.id || !p.name) {
        console.warn('跳过无效人员数据:', p);
        continue;
      }
      
      const item = {
        ...p,
        createdAt: parseTimestamp(p.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('people').put(item);
    }
  }

  // 导入班次
  const normalizedShifts = normalizeShifts(shifts as Shift[]);

  if (Array.isArray(normalizedShifts)) {
    for (const s of normalizedShifts) {
      // 验证必要字段
      if (!s.id || !s.name) {
        console.warn('跳过无效班次数据:', s);
        continue;
      }

      const item = {
        ...s,
        createdAt: parseTimestamp(s.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('shifts').put(item);
    }
  }

  // 导入额外休息配置
  if (Array.isArray(extraRestConfigs)) {
    for (const c of extraRestConfigs) {
      // 验证必要字段
      if (!c.id || typeof c.year !== 'number' || typeof c.month !== 'number') {
        console.warn('跳过无效额外休息配置:', c);
        continue;
      }
      
      const item = {
        ...c,
        createdAt: parseTimestamp(c.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('extraRestConfigs').put(item);
    }
  }

  // 导入排班记录（若存在）
  if (Array.isArray(schedulePayload)) {
    for (const schedule of schedulePayload) {
      if (!schedule.id || !schedule.personId || !schedule.shiftId || !schedule.date) {
        console.warn("跳过无效排班记录:", schedule);
        continue;
      }

      const item = {
        ...schedule,
        createdAt: parseTimestamp(schedule.createdAt),
        updatedAt: parseTimestamp(schedule.updatedAt),
      };
      transaction.objectStore('schedules').put(item);
    }
  }

  // 只需等待事务完成
  await transaction.done;
};
</script>

<style lang="scss" scoped>
.config-management-page {
  height: 100%;

  .el-card {
    height: 100%;
    background: var(--el-bg-color);
    display: flex;
    flex-direction: column;
  }

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px 0;
    overflow-y: auto;
    max-height: calc(100vh - 240px);
    padding-right: 8px;
  }

  .action-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    transition: all 0.3s ease;

    &:hover {
      border-color: var(--el-border-color);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    &.danger {
      border-color: var(--el-color-danger-light-7);
      background: var(--el-color-danger-light-9);

      &:hover {
        border-color: var(--el-color-danger-light-5);
        box-shadow: 0 2px 12px rgba(var(--el-color-danger-rgb), 0.1);
      }

      .action-info h3 {
        color: var(--el-color-danger);
      }
    }

    .action-info {
      flex: 1;
      max-width: 600px;

      h3 {
        margin: 0 0 8px 0;
        font-size: 17px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);

        strong {
          color: var(--el-color-danger);
          font-weight: 600;
        }
      }
    }

    .action-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: flex-end;
      min-width: 140px;

      .export-option {
        font-size: 13px;
        user-select: none;
      }
    }
  }

}
</style>

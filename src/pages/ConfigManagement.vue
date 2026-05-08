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
            <p>从JSON文件恢复配置。默认仅导入活动人员并按 ID 合并；可按需切换为完全覆盖或包含归档人员。</p>
          </div>
          <div class="action-controls">
            <el-button type="warning" @click="handleImport">
              导入配置
            </el-button>
            <el-checkbox v-model="importArchivedPeople" class="export-option">
              包含归档人员
            </el-checkbox>
            <el-checkbox v-model="replaceAllBeforeImport" class="export-option">
              导入前清空现有数据
            </el-checkbox>
          </div>
        </div>

        <div class="action-item">
          <div class="action-info">
            <h3>修改密码</h3>
            <p>修改登录系统的密钥。需要输入当前密码才能修改。</p>
          </div>
          <div class="action-controls">
            <el-button type="success" @click="showChangePasswordDialog = true">
              修改密码
            </el-button>
          </div>
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

    <el-dialog
      v-model="showChangePasswordDialog"
      title="修改密码"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="90px"
        label-position="right"
      >
        <el-form-item label="当前密码" prop="currentPassword">
          <el-input
            v-model="passwordForm.currentPassword"
            type="password"
            show-password
            placeholder="请输入当前密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangePasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleChangePassword" :loading="changingPassword">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElLoading, ElMessage, ElMessageBox } from "element-plus";
import { repositories } from "@/repositories";
import { dbManager } from "@/repositories/IndexedDBManager";
import { getCurrentDateTime } from "@/utils/common";
import { initializeDefaultShifts } from "@/services/initialization";
import { DEFAULT_SHIFTS, DEFAULT_KEY, CUSTOM_KEY_STORAGE } from "@/utils";
import type { Shift, Schedule } from "@/types";
import type { LoadingInstance } from "element-plus/es/components/loading/src/loading";

const fileInput = ref<HTMLInputElement | null>(null);
const reinitializing = ref(false);
const exportSchedules = ref(true);
const importArchivedPeople = ref(false);
const replaceAllBeforeImport = ref(false);
let reinitializeLoading: LoadingInstance | null = null;

const getCorrectKey = () => {
  return localStorage.getItem(CUSTOM_KEY_STORAGE) || DEFAULT_KEY
}

const showChangePasswordDialog = ref(false)
const changingPassword = ref(false)
const passwordFormRef = ref()
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const validateCurrentPassword = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入当前密码'))
  } else if (value !== getCorrectKey()) {
    callback(new Error('当前密码不正确'))
  } else {
    callback()
  }
}

const validateNewPassword = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请输入新密码'))
  } else if (value.length < 4) {
    callback(new Error('密码长度不能少于4位'))
  } else if (value === getCorrectKey()) {
    callback(new Error('新密码不能与当前密码相同'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的新密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  currentPassword: [{ validator: validateCurrentPassword, trigger: 'blur' }],
  newPassword: [{ validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
}

/**
 * 修改密码
 */
const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  try {
    await passwordFormRef.value.validate()
  } catch {
    return
  }

  changingPassword.value = true
  try {
    localStorage.setItem(CUSTOM_KEY_STORAGE, passwordForm.newPassword)
    ElMessage.success('密码修改成功，下次登录请使用新密码')
    showChangePasswordDialog.value = false
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    console.error('修改密码失败:', error)
    ElMessage.error('修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

const normalizeShifts = (shifts: Shift[] = []) => {
  const defaultRestShift = DEFAULT_SHIFTS.find((shift) => shift.isRest);
  const dedupMap = new Map<string, Shift>();
  const shiftIdMap = new Map<string, string>();

  for (const shift of shifts) {
    const normalized: Shift = { ...shift } as Shift;
    if (shift.isRest) {
      if (defaultRestShift) {
        shiftIdMap.set(shift.id, defaultRestShift.id);
        normalized.id = defaultRestShift.id;
        normalized.name = shift.name || defaultRestShift.name;
        normalized.color = shift.color || defaultRestShift.color;
      }
      normalized.isRest = true;
    } else {
      shiftIdMap.set(shift.id, shift.id);
    }

    if (dedupMap.has(normalized.id)) {
      dedupMap.set(normalized.id, { ...dedupMap.get(normalized.id)!, ...normalized });
    } else {
      dedupMap.set(normalized.id, normalized);
    }
  }

  return {
    shifts: Array.from(dedupMap.values()),
    shiftIdMap,
  };
};

/**
 * 导出配置
 */
const handleExport = async () => {
  try {
    const [people, shifts, extraRestConfigs, scheduleData] = await Promise.all([
      repositories.people.getAllIncludingArchived(),
      repositories.shifts.getAllIncludingArchived(),
      repositories.extraRestConfigs.getAll(),
      exportSchedules.value ? repositories.schedules.getAll() : Promise.resolve([]),
    ]);

    const { shifts: normalizedShifts } = normalizeShifts(shifts as Shift[]);
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

const reinitializeResetPassword = ref(false)

const handleReinitialize = async () => {
  const confirmMessage = `确认 <strong style="color: var(--el-color-danger);">删除所有数据并重新初始化系统</strong>？<br/>该操作 <strong style="color: var(--el-color-danger);">不可撤销</strong>，请确保已备份。`
  
  try {
    await new Promise<void>((resolve, reject) => {
      ElMessageBox.confirm(
        `<div style="display: flex; flex-direction: column; gap: 12px;">
          <div>${confirmMessage}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="reset-pwd" style="width: 16px; height: 16px; cursor: pointer;">
            <label for="reset-pwd" style="cursor: pointer; user-select: none; font-size: 14px;">同时重置登录密码为默认值</label>
          </div>
        </div>`,
        "初始化系统",
        {
          confirmButtonText: "确认初始化",
          cancelButtonText: "取消",
          confirmButtonClass: "el-button--danger",
          cancelButtonClass: "el-button--primary",
          dangerouslyUseHTMLString: true,
          type: "warning",
          beforeClose: (action, _instance, done) => {
            if (action === 'confirm') {
              const checkbox = document.getElementById('reset-pwd') as HTMLInputElement
              reinitializeResetPassword.value = checkbox ? checkbox.checked : false
            }
            done()
          }
        }
      ).then(() => resolve()).catch(() => reject())
    })
  } catch {
    return;
  }

  reinitializing.value = true;
  reinitializeLoading = ElLoading.service({
    lock: true,
    text: "正在初始化系统，请稍候...",
    background: "rgba(255, 255, 255, 0.72)",
  });
  try {
    await dbManager.deleteDatabase();
    await initializeDefaultShifts();
    if (reinitializeResetPassword.value) {
      localStorage.removeItem(CUSTOM_KEY_STORAGE);
      ElMessage.success("系统已重新初始化，登录密码已重置为默认值，页面即将刷新");
    } else {
      ElMessage.success("系统已重新初始化，页面即将刷新");
    }
    setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    console.error("系统初始化失败", error);
    ElMessage.error("初始化失败，请稍后重试");
  } finally {
    reinitializeLoading?.close();
    reinitializeLoading = null;
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
      replaceAllBeforeImport.value
        ? "将先清空当前全部数据，再导入配置。该操作不可撤销，是否继续？"
        : `将按 ID 合并导入配置${
            importArchivedPeople.value
              ? "，并包含本次文件中的归档人员"
              : "，本次文件中的归档人员及其排班将被跳过，不影响本地已存在的归档数据"
          }。是否继续？`,
      "确认导入",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    await importData(configData.data, {
      importArchivedPeople: importArchivedPeople.value,
      replaceAllBeforeImport: replaceAllBeforeImport.value,
    });
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

const getScheduleSlotKey = (personId: string, date: string) =>
  `${personId}::${date}`;

/**
 * 执行数据导入
 */
const importData = async (
  data: any,
  options: {
    importArchivedPeople: boolean;
    replaceAllBeforeImport: boolean;
  }
) => {
  const { people, shifts, extraRestConfigs, schedules: schedulePayload } = data;
  const now = getCurrentDateTime();
  const db = await dbManager.getDB();

  const transaction = db.transaction(
    ['people', 'shifts', 'extraRestConfigs', 'schedules'],
    'readwrite'
  );

  if (options.replaceAllBeforeImport) {
    await Promise.all([
      transaction.objectStore('schedules').clear(),
      transaction.objectStore('people').clear(),
      transaction.objectStore('extraRestConfigs').clear(),
      transaction.objectStore('shifts').clear(),
    ]);
  }

  const importedPersonIds = new Set<string>();
  const importedShiftIds = new Set<string>();
  const scheduleStore = transaction.objectStore('schedules');
  const importedScheduleMap = new Map<string, any>();

  // 导入人员
  if (Array.isArray(people)) {
    for (const p of people) {
      // 验证必要字段
      if (!p.id || !p.name) {
        console.warn('跳过无效人员数据:', p);
        continue;
      }

      const isArchived = Boolean(p.archivedAt);
      if (isArchived && !options.importArchivedPeople) {
        continue;
      }
      
      const item = {
        ...p,
        createdAt: parseTimestamp(p.createdAt),
        archivedAt: p.archivedAt ? parseTimestamp(p.archivedAt) : null,
        updatedAt: now,
      };
      await transaction.objectStore('people').put(item);
      importedPersonIds.add(p.id);
    }
  }

  // 导入班次
  const { shifts: normalizedShifts, shiftIdMap } = normalizeShifts(shifts as Shift[]);

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
        archivedAt: s.archivedAt ? parseTimestamp(s.archivedAt) : null,
        updatedAt: now,
      };
      await transaction.objectStore('shifts').put(item);
      importedShiftIds.add(item.id);
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
      await transaction.objectStore('extraRestConfigs').put(item);
    }
  }

  // 导入排班记录（若存在）
  if (Array.isArray(schedulePayload)) {
    for (const schedule of schedulePayload) {
      if (!schedule.id || !schedule.personId || !schedule.shiftId || !schedule.date) {
        console.warn("跳过无效排班记录:", schedule);
        continue;
      }

      if (!options.importArchivedPeople && !importedPersonIds.has(schedule.personId)) {
        continue;
      }

      const mappedShiftId = shiftIdMap.get(schedule.shiftId) || schedule.shiftId;
      if (!importedShiftIds.has(mappedShiftId)) {
        continue;
      }

      const item = {
        ...schedule,
        shiftId: mappedShiftId,
        createdAt: parseTimestamp(schedule.createdAt),
        updatedAt: parseTimestamp(schedule.updatedAt),
      };
      importedScheduleMap.set(
        getScheduleSlotKey(item.personId, item.date),
        item
      );
    }
  }

  for (const item of importedScheduleMap.values()) {
    const existing = await scheduleStore.index('by-personId-date').get([
      item.personId,
      item.date,
    ]);

    if (existing && existing.id !== item.id) {
      await scheduleStore.delete(existing.id);
    }

    await scheduleStore.put(item);
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

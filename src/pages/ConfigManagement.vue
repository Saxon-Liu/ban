<template>
  <div
    class="config-management-page"
    :class="{ 'is-narrow-page': isNarrowPage }"
  >
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>配置管理</span>
          <div style="height: 32px"></div>
        </div>
      </template>

      <div class="actions-container">
        <section class="config-block">
          <div class="block-head">
            <div class="block-icon export">
              <el-icon><Download /></el-icon>
            </div>
            <div class="block-copy">
              <h3>数据导出</h3>
              <p>将当前的人员、班次和额外休息配置导出为 JSON 文件进行备份</p>
            </div>
          </div>
          <div class="block-actions top-align import-actions">
            <el-button type="primary" @click="handleExport">
              导出配置
            </el-button>
            <el-checkbox v-model="exportSchedules" class="inline-option">
              同时导出排班记录
            </el-checkbox>
          </div>
        </section>

        <section class="config-block">
          <div class="block-head">
            <div class="block-icon import">
              <el-icon><Upload /></el-icon>
            </div>
            <div class="block-copy">
              <h3>数据导入</h3>
              <p>
                从 JSON 文件恢复配置，默认仅导入活动人员并按 ID
                合并，可按需切换导入策略
              </p>
            </div>
          </div>
          <div class="block-actions top-align">
            <el-button type="warning" plain @click="handleImport">
              选择文件
            </el-button>

            <div>
              <el-checkbox v-model="importArchivedPeople" class="inline-option">
                包含归档人员
              </el-checkbox>
              <el-checkbox v-model="replaceAllBeforeImport" class="inline-option">
                导入前清空现有数据
              </el-checkbox>
            </div>
          </div>
        </section>

        <section class="config-block holiday-block">
          <div class="block-head">
            <div class="block-icon holiday">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="block-copy">
              <h3>节假日设置</h3>
              <p>设置节假日用于页面展示，不会自动影响排班或月休统计</p>
            </div>
          </div>

          <div class="holiday-status-row">
            <div class="holiday-status">
              <el-tag
                v-for="source in currentHolidaySources"
                :key="`${source.year}-${source.source}`"
                size="small"
                :type="getHolidaySourceTagType(source.source)"
              >
                {{ source.year }} {{ getHolidaySourceLabel(source.source) }}
                {{ source.count }} 条
              </el-tag>
              <span v-if="holidaySummary && currentHolidaySources.length === 0" class="muted-text">
                暂无节假日数据
              </span>
            </div>
            <p v-if="latestHolidaySyncText" class="holiday-sync-state">
              {{ latestHolidaySyncText }}
            </p>

            <div class="holiday-toolbar">
              <span class="toolbar-label">当前年度</span>
              <el-date-picker
                v-model="holidaySyncYearValue"
                class="holiday-year-picker"
                type="year"
                size="small"
                format="YYYY"
                value-format="YYYY"
                :clearable="false"
                :editable="false"
                placeholder="选择年份"
                style="width: 80px"
              />
              <el-button
                type="primary"
                :loading="syncingHolidays"
                @click="handleSyncHolidays"
                size="small"
              >
                手动同步
              </el-button>
            </div>
          </div>

          <div class="holiday-main-row">
            <div class="holiday-stats">
              <div class="holiday-stat intro">
                <div>{{ holidaySyncYear }} 年节假日</div>
              </div>
              <div class="holiday-stat">
                <div class="stat-label">法定节假日</div>
                <div class="stat-value">{{ holidayHolidayCount }} 天</div>
              </div>
              <div class="holiday-stat">
                <div class="stat-label">调休工作日</div>
                <div class="stat-value">{{ holidayWorkdayCount }} 天</div>
              </div>
              <div class="holiday-stat">
                <div class="stat-label">总计天数</div>
                <div class="stat-value">{{ holidayTotalCount }} 天</div>
              </div>
            </div>
          </div>

          <div class="holiday-actions">
            <el-button type="warning" plain @click="handleHolidayImport">
              导入 JSON
            </el-button>
            <el-button
              type="success"
              plain
              :loading="restoringBuiltinHolidays"
              @click="handleRestoreBuiltinHolidays"
            >
              恢复内置
            </el-button>
            <el-button
              type="danger"
              plain
              :loading="clearingHolidayData"
              @click="handleClearRemoteHolidays"
            >
              清理无效
            </el-button>
            <el-button
              type="danger"
              plain
              :loading="clearingHolidayData"
              @click="handleClearManualHolidays"
            >
              清理导入
            </el-button>
          </div>
        </section>

        <section class="config-block">
          <div class="block-head">
            <div class="block-icon password">
              <el-icon><Lock /></el-icon>
            </div>
            <div class="block-copy">
              <h3>修改密码</h3>
              <p>修改登录系统的密码，建议定期更新以保障账户安全</p>
            </div>
          </div>
          <div class="block-actions center-align">
            <el-button
              type="primary"
              plain
              @click="showChangePasswordDialog = true"
            >
              修改密码
            </el-button>
          </div>
        </section>

        <section class="config-block danger-block">
          <div class="block-head">
            <div class="block-icon danger">
              <el-icon><WarningFilled /></el-icon>
            </div>
            <div class="block-copy">
              <h3>初始化系统（高危）</h3>
              <p>
                该操作将删除所有数据（人员、班次、排班、配置）并重新加载默认班次。
                <strong>请先导出配置备份！</strong>
              </p>
            </div>
          </div>
          <div class="block-actions center-align">
            <el-button
              type="danger"
              plain
              @click="handleReinitialize"
              :loading="reinitializing"
            >
              初始化系统
            </el-button>
          </div>
        </section>
      </div>

      <!-- <footer class="config-footer-note">
        所有配置操作均会记录日志，请谨慎操作重要数据。
      </footer> -->
    </el-card>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileChange"
    />

    <input
      ref="holidayFileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleHolidayFileChange"
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
            @keyup.enter="handleChangePassword"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码"
            @keyup.enter="handleChangePassword"
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            @keyup.enter="handleChangePassword"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangePasswordDialog = false">取消</el-button>
        <el-button
          type="primary"
          @click="handleChangePassword"
          :loading="changingPassword"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  ElLoading,
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from "element-plus";
import {
  Calendar,
  Download,
  Lock,
  Upload,
  WarningFilled,
} from "@element-plus/icons-vue";
import { dbManager } from "@/repositories/IndexedDBManager";
import { initializeDefaultShifts } from "@/services/initialization";
import {
  assertImportPayload,
  checkImportFileSize,
  exportConfiguration,
  ImportValidationError,
  importConfiguration,
  validateImportData,
  holidayService,
} from "@/services";
import {
  clearCustomSecret,
  invalidateAuthSessions,
  setCustomSecret,
  verifyLoginSecret,
} from "@/utils";
import type { LoadingInstance } from "element-plus/es/components/loading/src/loading";
import type { HolidayManagementSummary, HolidayYearStats } from "@/services";
import type { HolidaySource } from "@/types";

const fileInput = ref<HTMLInputElement | null>(null);
const holidayFileInput = ref<HTMLInputElement | null>(null);
const router = useRouter();
const reinitializing = ref(false);
const exportSchedules = ref(true);
const importArchivedPeople = ref(false);
const replaceAllBeforeImport = ref(false);
const holidaySummary = ref<HolidayManagementSummary | null>(null);
const holidayYearStats = ref<HolidayYearStats>({
  total: 0,
  publicHoliday: 0,
  transferWorkday: 0,
});
const isNarrowPage = ref(false);
const holidaySyncYear = ref(new Date().getFullYear());
const syncingHolidays = ref(false);
const restoringBuiltinHolidays = ref(false);
const clearingHolidayData = ref(false);
let reinitializeLoading: LoadingInstance | null = null;

const NARROW_PAGE_BREAKPOINT = 720;

const showChangePasswordDialog = ref(false);
const changingPassword = ref(false);
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const validateCurrentPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void,
) => {
  if (!value) {
    callback(new Error("请输入当前密码"));
  } else {
    callback();
  }
};

const validateNewPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void,
) => {
  if (!value) {
    callback(new Error("请输入新密码"));
  } else if (value.length < 4) {
    callback(new Error("密码长度不能少于4位"));
  } else {
    callback();
  }
};

const validateConfirmPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void,
) => {
  if (!value) {
    callback(new Error("请再次输入新密码"));
  } else if (value !== passwordForm.newPassword) {
    callback(new Error("两次输入的新密码不一致"));
  } else {
    callback();
  }
};

const passwordRules: FormRules = {
  currentPassword: [{ validator: validateCurrentPassword, trigger: "blur" }],
  newPassword: [{ validator: validateNewPassword, trigger: "blur" }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: "blur" }],
};

const holidaySyncYearValue = computed({
  get: () => String(holidaySyncYear.value),
  set: (value: string | number) => {
    const nextYear = Number(value);
    if (Number.isFinite(nextYear)) {
      holidaySyncYear.value = Math.trunc(nextYear);
    }
  },
});
const holidayTotalCount = computed(() => holidayYearStats.value.total);
const holidayHolidayCount = computed(
  () => holidayYearStats.value.publicHoliday,
);
const holidayWorkdayCount = computed(
  () => holidayYearStats.value.transferWorkday,
);
const currentHolidaySources = computed(() =>
  (holidaySummary.value?.activeSources || []).filter(
    (source) => source.year === holidaySyncYear.value,
  ),
);

const latestHolidaySyncText = computed(() => {
  const state = holidaySummary.value?.syncStates.find(
    (item) => item.year === holidaySyncYear.value,
  );
  if (!state) return "";
  const status = state.lastSyncStatus === "success" ? "成功" : "失败";
  const time = state.lastSyncAt
    ? new Date(state.lastSyncAt).toLocaleString()
    : "未知时间";
  return `最近同步：${state.year} ${status}，${time}`;
});

const loadHolidaySummary = async (resetYear = false) => {
  try {
    holidaySummary.value = await holidayService.getManagementSummary();
    if (resetYear || !holidaySyncYear.value) {
      holidaySyncYear.value = holidaySummary.value.builtinYear;
    }
    holidayYearStats.value = await holidayService.getYearStats(
      "CN",
      holidaySyncYear.value,
    );
  } catch (error) {
    console.error("加载节假日数据状态失败", error);
  }
};

const getHolidaySourceLabel = (source: HolidaySource) => {
  if (source === "manual-import") return "手动导入";
  if (source === "remote") return "远程同步";
  return "内置";
};

const getHolidaySourceTagType = (source: HolidaySource) => {
  if (source === "manual-import") return "warning";
  if (source === "remote") return "success";
  return "info";
};

const checkPageWidth = () => {
  isNarrowPage.value = window.innerWidth <= NARROW_PAGE_BREAKPOINT;
};

onMounted(() => {
  checkPageWidth();
  window.addEventListener("resize", checkPageWidth);
  loadHolidaySummary(true);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkPageWidth);
});

watch(holidaySyncYear, async (year) => {
  holidayYearStats.value = await holidayService.getYearStats("CN", year);
});

/**
 * 修改密码
 */
const handleChangePassword = async () => {
  if (!passwordFormRef.value) return;
  try {
    await passwordFormRef.value.validate();
  } catch {
    return;
  }

  changingPassword.value = true;
  try {
    if (!(await verifyLoginSecret(passwordForm.currentPassword))) {
      ElMessage.error("当前密码不正确");
      return;
    }

    if (await verifyLoginSecret(passwordForm.newPassword)) {
      ElMessage.error("新密码不能与当前密码相同");
      return;
    }

    await setCustomSecret(passwordForm.newPassword);
    invalidateAuthSessions();
    ElMessage.success("密码修改成功，当前登录会话已失效");
    showChangePasswordDialog.value = false;
    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    await router.replace("/login");
  } catch (error) {
    console.error("修改密码失败:", error);
    ElMessage.error("修改密码失败");
  } finally {
    changingPassword.value = false;
  }
};

/**
 * 导出配置
 */
const handleExport = async () => {
  try {
    const configData = await exportConfiguration(exportSchedules.value);

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
  } catch (error: unknown) {
    console.error("导出配置失败:", error);
    ElMessage.error(
      "导出配置失败: " + (error instanceof Error ? error.message : "未知错误"),
    );
  }
};

const reinitializeResetPassword = ref(false);

const handleReinitialize = async () => {
  const confirmMessage = `确认 <strong style="color: var(--el-color-danger);">删除所有数据并重新初始化系统</strong>？<br/>该操作 <strong style="color: var(--el-color-danger);">不可撤销</strong>，请确保已备份。`;

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
            if (action === "confirm") {
              const checkbox = document.getElementById(
                "reset-pwd",
              ) as HTMLInputElement;
              reinitializeResetPassword.value = checkbox
                ? checkbox.checked
                : false;
            }
            done();
          },
        },
      )
        .then(() => resolve())
        .catch(() => reject());
    });
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
      clearCustomSecret();
      invalidateAuthSessions();
      ElMessage.success("系统已重新初始化，登录密码已重置为默认值");
    } else {
      invalidateAuthSessions();
      ElMessage.success("系统已重新初始化");
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

const handleHolidayImport = () => {
  if (holidayFileInput.value) {
    holidayFileInput.value.value = "";
    holidayFileInput.value.click();
  }
};

const handleSyncHolidays = async () => {
  syncingHolidays.value = true;
  try {
    const result = await holidayService.syncYearFromRemote(
      holidaySyncYear.value,
    );
    await loadHolidaySummary();
    ElMessage.success(`节假日同步成功：${result.year}，共 ${result.count} 条`);
  } catch (error) {
    console.error("节假日同步失败", error);
    ElMessage.error(error instanceof Error ? error.message : "节假日同步失败");
    await loadHolidaySummary();
  } finally {
    syncingHolidays.value = false;
  }
};

const handleRestoreBuiltinHolidays = async () => {
  restoringBuiltinHolidays.value = true;
  try {
    await holidayService.restoreBuiltinHolidays();
    await loadHolidaySummary();
    ElMessage.success("已恢复内置节假日数据");
  } catch (error) {
    console.error("恢复内置节假日失败", error);
    ElMessage.error("恢复内置节假日失败");
  } finally {
    restoringBuiltinHolidays.value = false;
  }
};

const handleClearRemoteHolidays = async () => {
  clearingHolidayData.value = true;
  try {
    await holidayService.clearRemoteData();
    await loadHolidaySummary();
    ElMessage.success("已清理远程同步节假日数据");
  } catch (error) {
    console.error("清理远程节假日失败", error);
    ElMessage.error("清理远程节假日失败");
  } finally {
    clearingHolidayData.value = false;
  }
};

const handleClearManualHolidays = async () => {
  clearingHolidayData.value = true;
  try {
    await holidayService.clearManualImportData();
    await loadHolidaySummary();
    ElMessage.success("已清理手动导入节假日数据");
  } catch (error) {
    console.error("清理手动导入节假日失败", error);
    ElMessage.error("清理手动导入节假日失败");
  } finally {
    clearingHolidayData.value = false;
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
    checkImportFileSize(file);

    const text = await file.text();
    const configData = JSON.parse(text) as unknown;
    assertImportPayload(configData);
    validateImportData(configData.data);

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
      },
    );

    await importConfiguration(configData.data, {
      importArchivedPeople: importArchivedPeople.value,
      replaceAllBeforeImport: replaceAllBeforeImport.value,
    });
    ElMessage.success("配置导入成功");

    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (error: unknown) {
    if (error !== "cancel") {
      console.error("导入配置失败:", error);
      const errorMsg =
        error instanceof ImportValidationError
          ? `数据校验失败:\n${error.message}`
          : error instanceof Error
            ? error.message
            : "未知错误";
      ElMessage.error({
        message: `导入配置失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    }
  }
};

const handleHolidayFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    checkImportFileSize(file);
    const text = await file.text();
    const payload = JSON.parse(text) as unknown;
    const result = await holidayService.importHolidayJson(payload);
    await loadHolidaySummary();
    ElMessage.success(`节假日导入成功：${result.year}，共 ${result.count} 条`);
  } catch (error) {
    console.error("导入节假日失败", error);
    ElMessage.error(
      "导入节假日失败: " +
        (error instanceof Error ? error.message : "未知错误"),
    );
  } finally {
    if (holidayFileInput.value) holidayFileInput.value.value = "";
  }
};
</script>

<style lang="scss" scoped>
.config-management-page {
  height: calc(100% - 2px);
  --config-block-bg: linear-gradient(
    180deg,
    var(--el-bg-color-overlay) 0%,
    var(--el-fill-color-blank) 100%
  );
  --config-block-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  --config-block-shadow-hover: 0 12px 28px rgba(15, 23, 42, 0.06);
  --holiday-stats-bg: var(--el-fill-color-light);
  --danger-block-border: var(--el-color-danger-light-5);
  --danger-block-bg: linear-gradient(
    180deg,
    var(--el-color-danger-light-9),
    var(--el-color-danger-light-8)
  );
  --footer-note-bg: var(--el-fill-color-blank);

  .config-card {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :deep(.el-card__header) {
    padding: 18px 20px;
  }

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: calc(100% - 110px);
    padding: 20px;
    gap: 14px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .hero-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    line-height: 1.2;
  }

  .hero-subtitle {
    margin: 12px 0 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.7;
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    min-height: 0;
    padding-right: 8px;
  }

  .config-block {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 230px;
    column-gap: 20px;
    align-items: center;
    padding: 22px 20px;
    background: var(--config-block-bg);
    border: 1px solid var(--el-border-color-light);
    border-radius: 14px;
    box-shadow: var(--config-block-shadow);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      border-color: var(--el-border-color);
      box-shadow: var(--config-block-shadow-hover);
    }
  }

  .block-head {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    min-width: 0;
  }

  .block-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 22px;

    &.export {
      color: var(--el-color-primary);
      background: linear-gradient(
        180deg,
        var(--el-color-primary-light-8),
        var(--el-color-primary-light-9)
      );
    }

    &.import {
      color: var(--el-color-success);
      background: linear-gradient(
        180deg,
        var(--el-color-success-light-8),
        var(--el-color-success-light-9)
      );
    }

    &.holiday {
      color: var(--el-color-warning);
      background: linear-gradient(
        180deg,
        var(--el-color-warning-light-8),
        var(--el-color-warning-light-9)
      );
    }

    &.password {
      color: var(--el-color-primary);
      background: linear-gradient(
        180deg,
        var(--el-color-primary-light-8),
        var(--el-color-primary-light-9)
      );
    }

    &.danger {
      color: var(--el-color-danger);
      background: linear-gradient(
        180deg,
        var(--el-color-danger-light-8),
        var(--el-color-danger-light-9)
      );
    }
  }

  .block-copy {
    min-width: 0;

    h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.3;
    }

    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.75;
      color: var(--el-text-color-secondary);

      strong {
        color: var(--el-color-danger);
        font-weight: 600;
      }
    }
  }

  .block-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    min-width: 0;

    &.top-align {
      align-self: start;
    }

    &.center-align {
      align-self: center;
    }

    .el-button {
      min-height: 42px;
      margin-left: 0;
    }
  }

  .inline-option {
    margin-left: 0;
    justify-content: flex-start;
    font-size: 13px;
    line-height: 1.45;
  }

  .holiday-block {
    grid-template-columns: 1fr;
    row-gap: 14px;
    align-items: stretch;
  }

  .holiday-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    flex-wrap: wrap;
  }

  .holiday-main-row {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 14px;
    min-width: 0;
  }

  .holiday-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: nowrap;
    // padding: 14px 16px;
    // border: 1px solid var(--el-border-color-light);
    // border-radius: 12px;
    // background: rgba(248, 250, 253, 0.72);
    flex-shrink: 0;

    .toolbar-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    .holiday-year-picker {
      width: 96px;
      flex: 0 0 96px;
    }

    .el-button {
      margin-left: 0;
    }
  }

  .holiday-stats {
    display: grid;
    grid-template-columns: minmax(120px, 1.15fr) repeat(3, minmax(92px, 1fr));
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--holiday-stats-bg);
    flex: 1;
    min-width: 0;
  }

  .holiday-stat {
    min-width: 92px;
    padding: 10px 8px;
    text-align: center;
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    &:last-child {
      border-right: 0;
    }

    &.intro {
      width: auto;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.4;
      white-space: nowrap;
    }

    .stat-value {
      margin-top: 4px;
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.2;
      white-space: nowrap;
    }
  }

  .holiday-status {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .holiday-sync-state {
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  .holiday-actions {
    display: flex;
    gap: 10px;
    flex-wrap: nowrap;
    overflow-x: auto;

    .el-button {
      margin-left: 0;
      min-height: 38px;
      flex: 1;
    }
  }

  .danger-block {
    border-color: var(--danger-block-border);
    background: var(--danger-block-bg);

    .block-copy h3 {
      color: var(--el-color-danger);
    }
  }

  .config-footer-note {
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    background: var(--footer-note-bg);
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }

  .muted-text {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  &.is-narrow-page {
    .import-actions {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;

      .el-button {
        width: 100%;
      }
    }

    .holiday-status-row {
      align-items: flex-start;
      justify-content: flex-start;
      flex-wrap: wrap;
      overflow: visible;
      padding-bottom: 0;
    }

    .holiday-status {
      flex-wrap: wrap;
      white-space: normal;
    }

    .holiday-sync-state {
      flex-shrink: 1;
      white-space: normal;
    }
  }

  @media (max-width: 1180px) {
    .config-block {
      grid-template-columns: 1fr;
      row-gap: 16px;
    }

    .block-actions.center-align,
    .block-actions.top-align {
      align-self: stretch;
    }

    .holiday-main-row {
      flex-direction: column;
    }

    .holiday-toolbar {
      justify-content: flex-start;
      width: fit-content;
      max-width: 100%;
    }
  }

  @media (max-width: 720px) {
    :deep(.el-card__header),
    :deep(.el-card__body) {
      padding-left: 14px;
      padding-right: 14px;
    }

    .config-block {
      padding: 18px 16px;
    }

    .holiday-status-row {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
    }

    .holiday-status {
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    .holiday-sync-state {
      flex-shrink: 0;
    }

    &.is-narrow-page {
      .holiday-status-row {
        align-items: flex-start;
        flex-wrap: wrap;
        overflow: visible;
        padding-bottom: 0;
      }

      .holiday-status {
        flex-wrap: wrap;
        white-space: normal;
      }

      .holiday-sync-state {
        flex-shrink: 1;
        white-space: normal;
      }
    }

    .holiday-toolbar {
      flex-wrap: wrap;
      width: 100%;
    }

    .holiday-stats {
      grid-template-columns: 132px repeat(3, 96px);
    }

    .holiday-actions {
      padding-bottom: 2px;
    }
  }
}
</style>

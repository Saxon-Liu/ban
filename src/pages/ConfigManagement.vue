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
        <el-button type="primary" @click="handleChangePassword" :loading="changingPassword">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElLoading, ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { dbManager } from "@/repositories/IndexedDBManager";
import { initializeDefaultShifts } from "@/services/initialization";
import {
  assertImportPayload,
  checkImportFileSize,
  exportConfiguration,
  ImportValidationError,
  importConfiguration,
  validateImportData,
} from "@/services";
import {
  clearCustomSecret,
  invalidateAuthSessions,
  setCustomSecret,
  verifyLoginSecret,
} from "@/utils";
import type { LoadingInstance } from "element-plus/es/components/loading/src/loading";

const fileInput = ref<HTMLInputElement | null>(null);
const router = useRouter()
const reinitializing = ref(false);
const exportSchedules = ref(true);
const importArchivedPeople = ref(false);
const replaceAllBeforeImport = ref(false);
let reinitializeLoading: LoadingInstance | null = null;

const showChangePasswordDialog = ref(false)
const changingPassword = ref(false)
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const validateCurrentPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void
) => {
  if (!value) {
    callback(new Error('请输入当前密码'))
  } else {
    callback()
  }
}

const validateNewPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void
) => {
  if (!value) {
    callback(new Error('请输入新密码'))
  } else if (value.length < 4) {
    callback(new Error('密码长度不能少于4位'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void
) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的新密码不一致'))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
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
    if (!(await verifyLoginSecret(passwordForm.currentPassword))) {
      ElMessage.error('当前密码不正确')
      return
    }

    if (await verifyLoginSecret(passwordForm.newPassword)) {
      ElMessage.error('新密码不能与当前密码相同')
      return
    }

    await setCustomSecret(passwordForm.newPassword)
    invalidateAuthSessions()
    ElMessage.success('密码修改成功，当前登录会话已失效')
    showChangePasswordDialog.value = false
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    await router.replace('/login')
  } catch (error) {
    console.error('修改密码失败:', error)
    ElMessage.error('修改密码失败')
  } finally {
    changingPassword.value = false
  }
}

/**
 * 导出配置
 */
const handleExport = async () => {
  try {
    const configData = await exportConfiguration(exportSchedules.value)

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
      "导出配置失败: " + (error instanceof Error ? error.message : "未知错误")
    );
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
      clearCustomSecret();
      invalidateAuthSessions();
      ElMessage.success("系统已重新初始化，登录密码已重置为默认值，页面即将刷新");
    } else {
      invalidateAuthSessions();
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
    checkImportFileSize(file)

    const text = await file.text();
    const configData = JSON.parse(text) as unknown;
    assertImportPayload(configData)
    validateImportData(configData.data)

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

    await importConfiguration(configData.data, {
      importArchivedPeople: importArchivedPeople.value,
      replaceAllBeforeImport: replaceAllBeforeImport.value,
    });
    ElMessage.success("配置导入成功，请刷新页面查看最新数据");

    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error: unknown) {
    if (error !== "cancel") {
      console.error("导入配置失败:", error);
      const errorMsg = error instanceof ImportValidationError
        ? `数据校验失败:\n${error.message}`
        : error instanceof Error ? error.message : "未知错误";
      ElMessage.error({
        message: `导入配置失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    }
  }
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

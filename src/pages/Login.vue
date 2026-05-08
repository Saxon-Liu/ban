<template>
  <div class="login-container">
    <div class="login-card">
      <h2 class="login-title">排班系统</h2>
      <p class="login-subtitle">请输入密钥登录</p>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="0"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="secretKey">
          <el-input
            v-model="form.secretKey"
            type="password"
            placeholder="请输入密钥"
            size="large"
            show-password
            :prefix-icon="Lock"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            style="width: 100%"
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
        <el-form-item>
          <el-button
            type="info"
            link
            size="small"
            style="width: 100%"
            @click="showResetDialog = true"
          >
            忘记密码？
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-dialog
      v-model="showResetDialog"
      title="忘记密码"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="请联系系统管理员获取恢复码"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px"
      />
      <el-form
        ref="resetFormRef"
        :model="resetForm"
        :rules="resetRules"
        label-width="80px"
        label-position="right"
      >
        <el-form-item label="恢复码" prop="resetCode">
          <el-input
            v-model="resetForm.resetCode"
            type="password"
            show-password
            placeholder="请输入恢复码"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="resetMode" @change="resetForm.customKey = ''">
            <el-radio label="default">恢复为默认密码</el-radio>
            <el-radio label="custom">自定义新密码</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="resetMode === 'custom'" label="新密码" prop="customKey">
          <el-input
            v-model="resetForm.customKey"
            type="password"
            show-password
            placeholder="请输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResetDialog = false">取消</el-button>
        <el-button type="primary" @click="handleResetPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DEFAULT_KEY, CUSTOM_KEY_STORAGE, RESET_CODE } from '@/utils/constants'
import { startAuthSession } from '@/utils'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)

const getCorrectKey = () => {
  return localStorage.getItem(CUSTOM_KEY_STORAGE) || DEFAULT_KEY
}

const showResetDialog = ref(false)
const resetFormRef = ref<FormInstance>()
const resetMode = ref<'default' | 'custom'>('default')
const resetForm = reactive({
  resetCode: '',
  customKey: '',
})

const resetRules: FormRules = {
  resetCode: [{ required: true, message: '请输入恢复码', trigger: 'blur' }],
  customKey: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 4, message: '密码长度不能少于4位', trigger: 'blur' },
  ],
}

const handleResetPassword = async () => {
  if (!resetFormRef.value) return
  try {
    await resetFormRef.value.validate()
  } catch {
    return
  }

  if (resetForm.resetCode !== RESET_CODE) {
    ElMessage.error('恢复码不正确')
    return
  }

  if (resetMode.value === 'default') {
    localStorage.removeItem(CUSTOM_KEY_STORAGE)
    ElMessage.success('密码已恢复为默认值，请使用默认密码登录')
  } else {
    localStorage.setItem(CUSTOM_KEY_STORAGE, resetForm.customKey)
    ElMessage.success('密码已重置，请使用新密码登录')
  }

  showResetDialog.value = false
  resetForm.resetCode = ''
  resetForm.customKey = ''
  resetMode.value = 'default'
  form.secretKey = ''
}

const form = reactive({
  secretKey: ''
})

const createAuthToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

const rules: FormRules = {
  secretKey: [
    { required: true, message: '请输入密钥', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!formRef.value || loading.value) return

  loading.value = true

  try {
    await formRef.value.validate()
  } catch {
    loading.value = false
    return
  }

  try {
    if (form.secretKey !== getCorrectKey()) {
      ElMessage.error('密钥错误，请重试')
      form.secretKey = ''
      return
    }

    startAuthSession(createAuthToken())
    ElMessage.success('登录成功')

    const redirect = (route.query.redirect as string) || '/schedule'
    await router.push(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.login-card {
  width: 380px;
  padding: 40px;
  background: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.login-title {
  text-align: center;
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.login-subtitle {
  text-align: center;
  margin: 0 0 32px 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
}
</style>

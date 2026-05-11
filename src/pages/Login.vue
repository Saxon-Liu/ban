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
      :close-on-press-escape="!resetLoading"
      :show-close="!resetLoading"
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
        <el-button :disabled="resetLoading" @click="showResetDialog = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="resetLoading"
          @click="handleResetPassword"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  clearCustomSecret,
  invalidateAuthSessions,
  setCustomSecret,
  startAuthSession,
  verifyLoginSecret,
  verifyResetCode,
} from '@/utils'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const resetLoading = ref(false)

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
    {
      validator: (_rule, value, callback) => {
        if (resetMode.value !== 'custom') {
          callback()
          return
        }

        if (!value) {
          callback(new Error('请输入新密码'))
          return
        }

        if (value.length < 4) {
          callback(new Error('密码长度不能少于4位'))
          return
        }

        callback()
      },
      trigger: 'blur',
    },
  ],
}

const handleResetPassword = async () => {
  if (!resetFormRef.value || resetLoading.value) return
  if (isResetInCooldown.value) {
    ElMessage.warning(resetCooldownRemainingText.value)
    return
  }

  try {
    await resetFormRef.value.validate()
  } catch {
    return
  }

  resetLoading.value = true
  try {
    if (!(await verifyResetCode(resetForm.resetCode))) {
      const state = syncResetFailState()
      state.count += 1
      if (state.count >= 5) {
        state.cooldownUntil = Date.now() + 30 * 1000
        resetFailState.value = state
        writeScopedFailState(RESET_FAIL_STORAGE_KEY, state)
        resetCooldownRemaining.value = 30
        startResetCooldownTick()
        ElMessage.error('连续 5 次恢复码错误，请等待 30 秒后重试')
      } else {
        writeScopedFailState(RESET_FAIL_STORAGE_KEY, state)
        ElMessage.error(`恢复码错误，还剩余 ${5 - state.count} 次尝试机会`)
      }
      resetForm.resetCode = ''
      return
    }

    clearScopedFailState(RESET_FAIL_STORAGE_KEY)
    syncResetFailState()

    if (resetMode.value === 'default') {
      clearCustomSecret()
      ElMessage.success('密码已恢复为默认值，请使用默认密码登录')
    } else {
      await setCustomSecret(resetForm.customKey)
      ElMessage.success('密码已重置，请使用新密码登录')
    }

    invalidateAuthSessions()
    clearFailState()

    showResetDialog.value = false
    resetForm.resetCode = ''
    resetForm.customKey = ''
    resetMode.value = 'default'
    form.secretKey = ''
  } finally {
    resetLoading.value = false
  }
}

onBeforeUnmount(() => {
  stopCooldownTick()
  stopResetCooldownTick()
})

const form = reactive({
  secretKey: ''
})

const LOGIN_FAIL_STORAGE_KEY = 'login-fail-state'
const RESET_FAIL_STORAGE_KEY = 'reset-fail-state'

interface LoginFailState {
  count: number
  cooldownUntil: number
}

const readScopedFailState = (storageKey: string): LoginFailState => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { count: 0, cooldownUntil: 0 }
    return JSON.parse(raw) as LoginFailState
  } catch {
    return { count: 0, cooldownUntil: 0 }
  }
}

const readFailState = () => readScopedFailState(LOGIN_FAIL_STORAGE_KEY)

const writeScopedFailState = (storageKey: string, state: LoginFailState) => {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

const writeFailState = (state: LoginFailState) => {
  writeScopedFailState(LOGIN_FAIL_STORAGE_KEY, state)
}

const clearScopedFailState = (storageKey: string) => {
  localStorage.removeItem(storageKey)
}

const clearFailState = () => {
  clearScopedFailState(LOGIN_FAIL_STORAGE_KEY)
}

const failState = ref(readFailState())
const resetFailState = ref(readScopedFailState(RESET_FAIL_STORAGE_KEY))

const cooldownRemaining = ref(0)
const resetCooldownRemaining = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null
let resetCooldownTimer: ReturnType<typeof setInterval> | null = null

const normalizeFailState = (state: LoginFailState, storageKey: string): LoginFailState => {
  if (state.cooldownUntil > 0 && state.cooldownUntil <= Date.now()) {
    clearScopedFailState(storageKey)
    return { count: 0, cooldownUntil: 0 }
  }
  return state
}

const syncFailState = () => {
  const state = normalizeFailState(readFailState(), LOGIN_FAIL_STORAGE_KEY)
  failState.value = state

  if (state.cooldownUntil > Date.now()) {
    cooldownRemaining.value = Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000))
    startCooldownTick()
    return state
  }

  cooldownRemaining.value = 0
  stopCooldownTick()
  return state
}

const syncResetFailState = () => {
  const state = normalizeFailState(readScopedFailState(RESET_FAIL_STORAGE_KEY), RESET_FAIL_STORAGE_KEY)
  resetFailState.value = state

  if (state.cooldownUntil > Date.now()) {
    resetCooldownRemaining.value = Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000))
    startResetCooldownTick()
    return state
  }

  resetCooldownRemaining.value = 0
  stopResetCooldownTick()
  return state
}

const startCooldownTick = () => {
  stopCooldownTick()
  cooldownTimer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((failState.value.cooldownUntil - Date.now()) / 1000))
    cooldownRemaining.value = remaining
    if (remaining <= 0) {
      stopCooldownTick()
      syncFailState()
    }
  }, 1000)
}

const stopCooldownTick = () => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

const startResetCooldownTick = () => {
  stopResetCooldownTick()
  resetCooldownTimer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((resetFailState.value.cooldownUntil - Date.now()) / 1000))
    resetCooldownRemaining.value = remaining
    if (remaining <= 0) {
      stopResetCooldownTick()
      syncResetFailState()
    }
  }, 1000)
}

const stopResetCooldownTick = () => {
  if (resetCooldownTimer) {
    clearInterval(resetCooldownTimer)
    resetCooldownTimer = null
  }
}

const isInCooldown = computed(() => failState.value.cooldownUntil > Date.now())
const isResetInCooldown = computed(() => resetFailState.value.cooldownUntil > Date.now())

const cooldownRemainingText = computed(() => {
  if (!isInCooldown.value) return ''
  return `请等待 ${cooldownRemaining.value} 秒后重试`
})

const resetCooldownRemainingText = computed(() => {
  if (!isResetInCooldown.value) return ''
  return `请等待 ${resetCooldownRemaining.value} 秒后重试恢复码`
})

syncFailState()
syncResetFailState()

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

  if (isInCooldown.value) {
    ElMessage.warning(cooldownRemainingText.value)
    return
  }

  loading.value = true

  try {
    await formRef.value.validate()
  } catch {
    loading.value = false
    return
  }

  try {
    if (!(await verifyLoginSecret(form.secretKey))) {
      const state = syncFailState()
      state.count += 1
      if (state.count >= 5) {
        state.cooldownUntil = Date.now() + 30 * 1000
        failState.value = state
        writeFailState(state)
        cooldownRemaining.value = 30
        startCooldownTick()
        ElMessage.error('连续 5 次密码错误，请等待 30 秒后重试')
      } else {
        writeFailState(state)
        ElMessage.error(`密钥错误，还剩余 ${5 - state.count} 次尝试机会`)
      }
      form.secretKey = ''
      return
    }

    clearFailState()
    syncFailState()
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

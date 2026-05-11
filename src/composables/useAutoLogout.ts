import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AUTO_LOGOUT_ENABLED_KEY,
  AUTO_LOGOUT_TOTAL_KEY,
  AUTO_LOGOUT_TOTAL_MINUTES,
  AUTO_LOGOUT_WARNING_KEY,
  AUTO_LOGOUT_WARNING_MINUTES,
  clearAuthSession,
  isAuthSessionValid,
  refreshAuthSessionExpiry,
} from '@/utils'

const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
]

function getAutoLogoutConfig() {
  const enabledRaw = localStorage.getItem(AUTO_LOGOUT_ENABLED_KEY)
  const warningRaw = Number(localStorage.getItem(AUTO_LOGOUT_WARNING_KEY))
  const totalRaw = Number(localStorage.getItem(AUTO_LOGOUT_TOTAL_KEY))

  const enabled = enabledRaw === null ? true : enabledRaw === 'true'
  const warningMinutes = Number.isFinite(warningRaw) && warningRaw >= 1 ? warningRaw : AUTO_LOGOUT_WARNING_MINUTES
  const totalMinutes =
    Number.isFinite(totalRaw) && totalRaw > warningMinutes ? totalRaw : AUTO_LOGOUT_TOTAL_MINUTES

  return {
    enabled,
    warningMinutes,
    totalMinutes: totalMinutes > warningMinutes ? totalMinutes : warningMinutes + 1,
  }
}

export function useAutoLogout() {
  const route = useRoute()
  const router = useRouter()

  let warningTimer: ReturnType<typeof setTimeout> | null = null
  let forceLogoutTimer: ReturnType<typeof setTimeout> | null = null
  let warningVisible = false
  let closingForActivity = false
  let warningToken = 0

  const isPublicRoute = () => route.path === '/login' || route.matched.some(record => record.meta.public)

  const isAutoLogoutActive = () => !isPublicRoute() && isAuthSessionValid()

  const clearTimers = () => {
    if (warningTimer) {
      clearTimeout(warningTimer)
      warningTimer = null
    }
    if (forceLogoutTimer) {
      clearTimeout(forceLogoutTimer)
      forceLogoutTimer = null
    }
  }

  const closeWarning = () => {
    if (!warningVisible) return
    closingForActivity = true
    warningVisible = false
    warningToken += 1
    ElMessageBox.close()
    setTimeout(() => {
      closingForActivity = false
    }, 100)
  }

  const logout = async (message?: string) => {
    clearTimers()
    closeWarning()
    clearAuthSession()
    if (message) {
      ElMessage.warning(message)
    }
    if (!isPublicRoute()) {
      await router.push('/login')
    }
  }

  const resetTimers = () => {
    clearTimers()
    if (!isAutoLogoutActive()) return
    const config = getAutoLogoutConfig()
    if (!config.enabled) return

    warningTimer = setTimeout(() => {
      if (!isAutoLogoutActive()) return
      void showWarning()
    }, config.warningMinutes * 60 * 1000)
  }

  const handleWarningClosed = () => {
    if (closingForActivity) {
      closingForActivity = false
      return
    }

    warningVisible = false
    refreshAuthSessionExpiry()
    resetTimers()
  }

  const showWarning = async () => {
    if (warningVisible || !isAutoLogoutActive()) return
    const config = getAutoLogoutConfig()
    if (!config.enabled) return

    const currentToken = ++warningToken
    warningVisible = true
    forceLogoutTimer = setTimeout(() => {
      if (currentToken !== warningToken) {
        return
      }
      if (!isAutoLogoutActive()) {
        warningVisible = false
        clearTimers()
        return
      }
      warningVisible = false
      void logout('长时间未操作，已自动退出登录')
    }, (config.totalMinutes - config.warningMinutes) * 60 * 1000)

    try {
      await ElMessageBox.confirm(
        `您已连续 ${config.warningMinutes} 分钟未操作，再过 ${
          config.totalMinutes - config.warningMinutes
        } 分钟将自动退出登录。`,
        '会话超时提醒',
        {
          confirmButtonText: '继续使用',
          cancelButtonText: '退出登录',
          closeOnClickModal: false,
          closeOnPressEscape: false,
          distinguishCancelAndClose: true,
          type: 'warning',
        }
      )

      if (currentToken !== warningToken) {
        return
      }
      warningVisible = false
      refreshAuthSessionExpiry()
      resetTimers()
    } catch (action) {
      if (currentToken !== warningToken) {
        return
      }
      if (action === 'cancel') {
        warningVisible = false
        void logout('长时间未操作，已退出登录')
        return
      }
      handleWarningClosed()
    }
  }

  const handleActivity = () => {
    if (!isAutoLogoutActive()) return
    if (warningVisible) return
    refreshAuthSessionExpiry()
    resetTimers()
  }

  onMounted(() => {
    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleActivity, { passive: true })
    })
    resetTimers()
  })

  onBeforeUnmount(() => {
    clearTimers()
    closeWarning()
    ACTIVITY_EVENTS.forEach((eventName) => {
      document.removeEventListener(eventName, handleActivity)
    })
  })

  watch(
    () => route.path,
    () => {
      if (isPublicRoute()) {
        clearTimers()
        closeWarning()
        return
      }
      if (isAuthSessionValid()) {
        refreshAuthSessionExpiry()
      }
      resetTimers()
    },
    { immediate: true }
  )

  return {
    resetAutoLogoutTimer: resetTimers,
    triggerLogout: logout,
  }
}

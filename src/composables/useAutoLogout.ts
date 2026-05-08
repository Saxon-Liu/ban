import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  AUTH_EXPIRY_KEY,
  AUTH_STORAGE_KEY,
  AUTO_LOGOUT_TOTAL_MINUTES,
  AUTO_LOGOUT_WARNING_MINUTES,
} from '@/utils'

const WARNING_TIMEOUT_MS = AUTO_LOGOUT_WARNING_MINUTES * 60 * 1000
const FORCE_LOGOUT_TIMEOUT_MS =
  (AUTO_LOGOUT_TOTAL_MINUTES - AUTO_LOGOUT_WARNING_MINUTES) * 60 * 1000
const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
]

export function useAutoLogout() {
  const route = useRoute()
  const router = useRouter()

  let warningTimer: ReturnType<typeof setTimeout> | null = null
  let forceLogoutTimer: ReturnType<typeof setTimeout> | null = null
  let warningVisible = false
  let closingForActivity = false

  const isAuthenticated = () => {
    const token = localStorage.getItem(AUTH_STORAGE_KEY)
    const expiry = Number(localStorage.getItem(AUTH_EXPIRY_KEY))

    return Boolean(token) && Number.isFinite(expiry) && Date.now() <= expiry
  }

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
    ElMessageBox.close()
  }

  const logout = async (message?: string) => {
    clearTimers()
    closeWarning()
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_EXPIRY_KEY)
    if (message) {
      ElMessage.warning(message)
    }
    if (route.path !== '/login') {
      await router.push('/login')
    }
  }

  const resetTimers = () => {
    clearTimers()
    if (route.path === '/login' || !isAuthenticated()) return

    warningTimer = setTimeout(() => {
      void showWarning()
    }, WARNING_TIMEOUT_MS)
  }

  const handleWarningClosed = () => {
    if (closingForActivity) {
      closingForActivity = false
      return
    }

    warningVisible = false
    void logout('长时间未操作，已自动退出登录')
  }

  const showWarning = async () => {
    if (warningVisible || route.path === '/login' || !isAuthenticated()) return

    warningVisible = true
    forceLogoutTimer = setTimeout(() => {
      warningVisible = false
      void logout('长时间未操作，已自动退出登录')
    }, FORCE_LOGOUT_TIMEOUT_MS)

    try {
      await ElMessageBox.confirm(
        `您已连续 ${AUTO_LOGOUT_WARNING_MINUTES} 分钟未操作，再过 ${
          AUTO_LOGOUT_TOTAL_MINUTES - AUTO_LOGOUT_WARNING_MINUTES
        } 分钟将自动退出登录。`,
        '会话超时提醒',
        {
          confirmButtonText: '继续使用',
          cancelButtonText: '退出登录',
          closeOnClickModal: false,
          closeOnPressEscape: false,
          type: 'warning',
        }
      )

      warningVisible = false
      resetTimers()
    } catch {
      handleWarningClosed()
    }
  }

  const handleActivity = () => {
    if (route.path === '/login' || !isAuthenticated()) return

    if (warningVisible) {
      closeWarning()
    }
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
      if (route.path === '/login') {
        clearTimers()
        closeWarning()
        return
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

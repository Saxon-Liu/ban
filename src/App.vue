<template>
  <div id="app">
    <router-view v-if="isLoginPage" />
    <el-container v-else>
      <el-aside :width="asideCollapsed ? '0px' : asideWidth + 'px'" :class="['app-aside', { collapsed: asideCollapsed }]">
        <div class="aside-top">
          <el-button size="small" circle @click="toggleAside">
            <el-icon>
              <Fold />
            </el-icon>
          </el-button>
        </div>
        <transition name="fade">
          <el-menu
          :default-active="$route.path"
          router
          v-show="!asideCollapsed"
          >
          <el-menu-item index="/schedule">
            <el-icon>
              <Calendar />
            </el-icon>
            <span>排班管理</span>
          </el-menu-item>
          <el-menu-item index="/dashboard">
            <el-icon><Tools /></el-icon>
            <span>基础配置</span>
          </el-menu-item>
          </el-menu>
        </transition>
        <transition name="fade">
          <div class="aside-bottom" v-show="!asideCollapsed">
            <el-select v-model="themeMode" size="small" style="flex: 1">
              <el-option label="跟随系统" value="system" />
              <el-option label="亮色" value="light" />
              <el-option label="暗色" value="dark" />
            </el-select>
            <el-tooltip content="退出登录" placement="top">
              <el-button plain size="small" circle @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </transition>
        <div v-show="!asideCollapsed" class="aside-resizer" @mousedown="startAsideResize"></div>
      </el-aside>
      <el-main>
        <el-button v-if="asideCollapsed" class="aside-expand-btn" size="small" circle @click="toggleAside">
          <el-icon>
            <Expand />
          </el-icon>
        </el-button>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Calendar, Tools, Fold, Expand, SwitchButton } from '@element-plus/icons-vue'
import { useAutoLogout } from '@/composables/useAutoLogout'

const route = useRoute()

const isLoginPage = computed(() => route.path === '/login')
const { triggerLogout } = useAutoLogout()

const handleLogout = () => {
  void triggerLogout()
}

const THEME_KEY = 'theme-mode'
const themeMode = ref<'system' | 'light' | 'dark'>('system')
const ASIDE_WIDTH_KEY = 'aside-width'
const ASIDE_COLLAPSE_KEY = 'aside-collapsed'
const asideWidth = ref(130)
const asideCollapsed = ref(true)
let media: MediaQueryList | null = null
let mediaChangeHandler: (() => void) | null = null

const isSystemDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
const applyTheme = () => {
  const mode = themeMode.value
  const dark = mode === 'system' ? isSystemDark() : mode === 'dark'
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(THEME_KEY) as 'system' | 'light' | 'dark' | null
    themeMode.value = saved || 'system'
    applyTheme()
  } catch (error: any) {
    console.error('[theme-init-error]', {
      time: new Date().toISOString(),
      params: {},
      message: error?.message,
      stack: error?.stack,
    })
  }
  try {
    const w = Number(localStorage.getItem(ASIDE_WIDTH_KEY) || '130')
    asideWidth.value = Number.isFinite(w) && w >= 130 && w <= 320 ? w : 130
    const c = localStorage.getItem(ASIDE_COLLAPSE_KEY)
    // 如果没有存储值，或者存储值不为 'false'，则默认为收起 (true)
    // 即：只有明确存为 'false' 时才展开
    asideCollapsed.value = c !== 'false'
  } catch (error: any) {
    console.error('[aside-init-error]', {
      time: new Date().toISOString(),
      params: {},
      message: error?.message,
      stack: error?.stack,
    })
  }
  media = window.matchMedia('(prefers-color-scheme: dark)')
  mediaChangeHandler = () => themeMode.value === 'system' && applyTheme()
  media.addEventListener('change', mediaChangeHandler)
})

onBeforeUnmount(() => {
  if (media && mediaChangeHandler) {
    media.removeEventListener('change', mediaChangeHandler)
  }
})

watch(themeMode, (val) => {
  localStorage.setItem(THEME_KEY, val)
  applyTheme()
})

const toggleAside = () => {
  try {
    asideCollapsed.value = !asideCollapsed.value
    localStorage.setItem(ASIDE_COLLAPSE_KEY, String(asideCollapsed.value))
  } catch (error: any) {
    console.error('[aside-toggle-error]', {
      time: new Date().toISOString(),
      params: { collapsed: asideCollapsed.value },
      message: error?.message,
      stack: error?.stack,
    })
  }
}

const startAsideResize = (e: MouseEvent) => {
  try {
    if (asideCollapsed.value) return
    const startX = e.clientX
    const startWidth = asideWidth.value
    const onMove = (ev: MouseEvent) => {
      try {
        const delta = ev.clientX - startX
        const next = Math.min(320, Math.max(130, startWidth + delta))
        asideWidth.value = next
      } catch (error: any) {
        console.error('[aside-resize-move-error]', {
          time: new Date().toISOString(),
          params: {},
          message: error?.message,
          stack: error?.stack,
        })
      }
    }
    const onUp = () => {
      try {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        localStorage.setItem(ASIDE_WIDTH_KEY, String(asideWidth.value))
      } catch (error: any) {
        console.error('[aside-resize-up-error]', {
          time: new Date().toISOString(),
          params: {},
          message: error?.message,
          stack: error?.stack,
        })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  } catch (error: any) {
    console.error('[aside-resize-start-error]', {
      time: new Date().toISOString(),
      params: {},
      message: error?.message,
      stack: error?.stack,
    })
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
}

.el-container {
  height: 100vh;
}

.app-aside {
  position: relative;
  overflow: hidden;
  transition: width 0.25s ease;
  border-right: 1px solid var(--el-border-color-light);
  background:
    linear-gradient(
      180deg,
      var(--el-bg-color) 0%,
      var(--el-fill-color-blank) 100%
    );
}

.el-main {
  background-color: var(--el-bg-color-page);
  padding: 16px;
}

.aside-bottom {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.aside-top {
  display: flex;
  align-items: center;
  padding: 8px 8px 6px;
}

.aside-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
}

.aside-expand-btn {
  position: fixed;
  left: 8px;
  top: 8px;
  z-index: 1000;
}

.app-aside.collapsed {
  pointer-events: none;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.app-aside :deep(.el-menu) {
  border-right: 0;
  background: transparent;
}

.app-aside :deep(.el-menu-item) {
  margin: 4px 8px;
  height: 42px;
  line-height: 42px;
  border-radius: 10px;
}

.app-aside :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary-light-9);
}

.app-aside :deep(.el-select .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color-light) inset;
}
</style>

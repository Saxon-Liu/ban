<template>
  <div id="app">
    <el-container>
      <el-aside width="200px" class="app-aside">
        <el-menu
          :default-active="$route.path"
          router
        >
          <el-menu-item index="/schedule">
            <el-icon>
              <Calendar />
            </el-icon>
            <span>排班管理</span>
          </el-menu-item>
          <el-menu-item index="/dashboard">
            <el-icon><Tools /></el-icon>
            <!-- <el-icon>
              <Setting />
            </el-icon> -->
            <span>基础配置</span>
          </el-menu-item>
          <!-- <el-menu-item index="/people">
            <el-icon><User /></el-icon>
            <span>人员管理</span>
          </el-menu-item>
          <el-menu-item index="/shifts">
            <el-icon><Clock /></el-icon>
            <span>班次管理</span>
          </el-menu-item>
          <el-menu-item index="/extra-rest">
            <el-icon><Setting /></el-icon>
            <span>额外休息配置</span>
          </el-menu-item> -->
        </el-menu>
        <div class="theme-switcher">
          <el-select v-model="themeMode" size="small" style="width: 160px">
            <el-option label="跟随系统" value="system" />
            <el-option label="亮色" value="light" />
            <el-option label="暗色" value="dark" />
          </el-select>
        </div>
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Calendar, Tools } from '@element-plus/icons-vue'

const THEME_KEY = 'theme-mode'
const themeMode = ref<'system' | 'light' | 'dark'>('system')

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
  const saved = localStorage.getItem(THEME_KEY) as 'system' | 'light' | 'dark' | null
  themeMode.value = saved || 'system'
  applyTheme()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => themeMode.value === 'system' && applyTheme()
  media.addEventListener('change', handler)
})

watch(themeMode, (val) => {
  localStorage.setItem(THEME_KEY, val)
  applyTheme()
})
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
}

.el-main {
  background-color: var(--el-bg-color-page);
  padding: 20px;
}

.theme-switcher {
  position: absolute;
  left: 10px;
  bottom: 10px;
}
</style>

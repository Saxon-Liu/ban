import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import { initializeSystem } from '@/services'

import SchedulePage from './pages/Schedule.vue'
import DashboardPage from './pages/Dashboard.vue'
import LoginPage from './pages/Login.vue'
import { isAuthSessionValid, refreshAuthSessionExpiry } from './utils'

const routes = [
  { path: '/', redirect: '/schedule' },
  { path: '/login', component: LoginPage, name: '登录', meta: { public: true } },
  { path: '/schedule', component: SchedulePage, name: '排班管理' },
  { path: '/dashboard', component: DashboardPage, name: '基础配置' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    next()
    return
  }
  if (!isAuthSessionValid()) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else {
    refreshAuthSessionExpiry()
    next()
  }
})

// 创建应用
const app = createApp(App)


app.use(ElementPlus, {
  locale: zhCn
})
app.use(router)

// 初始化系统数据
initializeSystem().catch(error => {
  console.error('系统初始化失败:', error)
})

app.mount('#app')

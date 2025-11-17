import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import { initializeSystem } from '@/services'

// 导入页面组件
import SchedulePage from './pages/Schedule.vue'
// import PeoplePage from './pages/People.vue'
// import ShiftsPage from './pages/Shifts.vue'
// import ExtraRestPage from './pages/ExtraRest.vue'
import DashboardPage from './pages/Dashboard.vue'

// 创建路由
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/schedule', component: SchedulePage, name: '排班管理' },
  // { path: '/people', component: PeoplePage, name: '人员管理' },
  // { path: '/shifts', component: ShiftsPage, name: '班次管理' },
  // { path: '/extra-rest', component: ExtraRestPage, name: '额外休息配置' },
  { path: '/dashboard', component: DashboardPage, name: '基础配置' },
  // { path: '/test', component: () => import('./pages/Test.vue'), name: '功能测试' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 创建应用
const app = createApp(App)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, {
  locale: zhCn
})
app.use(router)

// 初始化系统数据
initializeSystem().catch(error => {
  console.error('系统初始化失败:', error)
})

app.mount('#app')
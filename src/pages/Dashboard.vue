<template>
  <div class="dashboard-page">
    <!-- 小屏幕/窄屏模式：使用 Tabs -->
    <div v-if="isMobile" class="dashboard-tabs-container">
      <el-tabs v-model="activeTab" type="border-card" class="dashboard-tabs">
        <el-tab-pane label="人员管理" name="people">
          <div class="tab-content-wrapper">
            <PeoplePage />
          </div>
        </el-tab-pane>
        <el-tab-pane label="班次管理" name="shifts">
          <div class="tab-content-wrapper">
            <ShiftsPage />
          </div>
        </el-tab-pane>
        <el-tab-pane label="补休管理" name="extraRest">
          <div class="tab-content-wrapper">
            <ExtraRestPage />
          </div>
        </el-tab-pane>
        <el-tab-pane label="配置管理" name="config">
          <div class="tab-content-wrapper">
            <ConfigPage />
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 大屏幕模式：双列布局 -->
    <div v-else class="dashboard-layout">
      <el-row :gutter="20" class="dashboard-row">
        <el-col :span="12" class="dashboard-col">
          <PeoplePage />
        </el-col>
        <el-col :span="12" class="dashboard-col">
          <ShiftsPage />
        </el-col>
      </el-row>

      <el-row :gutter="20" class="dashboard-row">
        <el-col :span="12" class="dashboard-col">
          <ExtraRestPage />
        </el-col>
        <el-col :span="12" class="dashboard-col">
          <ConfigPage />
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import PeoplePage from './People.vue'
import ShiftsPage from './Shifts.vue'
import ExtraRestPage from './ExtraRest.vue'
import ConfigPage from './ConfigManagement.vue'

const isMobile = ref(false)
const activeTab = ref('people')

const checkScreenSize = () => {
  // 当宽度小于 1200px 时切换为 Tabs 模式，因为双列布局在较窄屏幕下会显得拥挤
  isMobile.value = window.innerWidth < 1200
}

onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})
</script>

<style lang="scss" scoped>
.dashboard-page {
  height: 100%;
  // padding: 10px;
  box-sizing: border-box;
  overflow: hidden;

  // Tabs 模式样式
  .dashboard-tabs-container {
    height: 100%;
    min-height: 0;
    
    .dashboard-tabs {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;

      :deep(.el-tabs__content) {
        flex: 1;
        min-height: 0;
        padding: 15px;
        overflow: hidden;
      }

      :deep(.el-tab-pane) {
        height: 100%;
        min-height: 0;
      }
    }

    .tab-content-wrapper {
      height: 100%;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
  }

  // 原有 Grid 模式样式
  .dashboard-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 20px;
  }

  .dashboard-row {
    flex: 1;
    min-height: 0; // Critical for nested flex scrolling
  }

  .dashboard-col {
    height: 100%;
  }

  .card-header {
    height: 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }
}
</style>

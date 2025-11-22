<template>
  <div class="dashboard-page">
    <div class="dashboard-layout">
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
import PeoplePage from './People.vue'
import ShiftsPage from './Shifts.vue'
import ExtraRestPage from './ExtraRest.vue'
import ConfigPage from './ConfigManagement.vue'
</script>

<style lang="scss" scoped>
.dashboard-page {
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden;

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
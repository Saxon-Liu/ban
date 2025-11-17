<template>
  <div class="dashboard-page">
    <el-row :gutter="10">
      <el-col :span="12">
        <PeoplePage />
      </el-col>
      <el-col :span="12">
        <ShiftsPage />
      </el-col>
    </el-row>
    <el-row :gutter="0" class="row-gap">
      <el-col :span="12">
        <ExtraRestPage />
      </el-col>
      <el-col :span="12">

      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import PeoplePage from './People.vue'
import ShiftsPage from './Shifts.vue'
import ExtraRestPage from './ExtraRest.vue'
</script>

<style lang="scss" scoped>
.dashboard-page {
  .row-gap {
    margin-top: 20px;
  }

  .card-header {
    font-weight: 600;
  }

  .placeholder-card {
    width: 100%;
  }
}
</style>
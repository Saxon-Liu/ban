<template>
  <div id="app">
    <el-container>
      <el-aside width="200px">
        <el-menu
          :default-active="$route.path"
          router
          background-color="#545c64"
          text-color="#fff"
          active-text-color="#ffd04b"
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
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
// import { Calendar, Setting } from "@element-plus/icons-vue";
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

.el-aside {
  background-color: #545c64;
}

.el-main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>

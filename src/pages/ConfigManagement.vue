<template>
  <div class="config-management-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span style="height: 32px">配置管理</span>
        </div>
      </template>

      <div class="actions-container">
        <div class="action-item">
          <div class="action-info">
            <h3>导出配置</h3>
            <p>将当前的人员、班次和额外休息配置导出为JSON文件进行备份。</p>
          </div>
          <el-button type="primary" @click="handleExport">
            导出配置
          </el-button>
        </div>

        <div class="divider"></div>

        <div class="action-item">
          <div class="action-info">
            <h3>导入配置</h3>
            <p>从JSON文件恢复配置。注意：导入将覆盖具有相同ID的现有配置，并合并新配置。</p>
          </div>
          <el-button type="warning" @click="handleImport">
            导入配置
          </el-button>
        </div>
      </div>
    </el-card>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { repositories } from "@/repositories";
import { dbManager } from "@/repositories/IndexedDBManager";
import { getCurrentDateTime } from "@/utils/common";

const fileInput = ref<HTMLInputElement | null>(null);

/**
 * 导出配置
 */
const handleExport = async () => {
  try {
    const [people, shifts, extraRestConfigs] = await Promise.all([
      repositories.people.getAll(),
      repositories.shifts.getAll(),
      repositories.extraRestConfigs.getAll(),
    ]);

    const configData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        people,
        shifts,
        extraRestConfigs,
      },
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `排班配置备份_${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    ElMessage.success("配置导出成功");
  } catch (error: any) {
    console.error("导出配置失败:", error);
    ElMessage.error("导出配置失败: " + (error.message || "未知错误"));
  }
};

/**
 * 触发导入文件选择
 */
const handleImport = () => {
  if (fileInput.value) {
    fileInput.value.value = "";
    fileInput.value.click();
  }
};

/**
 * 处理文件选择
 */
const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const configData = JSON.parse(text);

    if (!configData.data || !configData.data.people || !configData.data.shifts) {
      throw new Error("无效的配置文件格式");
    }

    await ElMessageBox.confirm(
      "导入将覆盖现有的同ID配置数据，且操作不可撤销。是否继续？",
      "确认导入",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    await importData(configData.data);
    ElMessage.success("配置导入成功，请刷新页面查看最新数据");
    
    // 稍微延迟后刷新页面以确保所有状态更新
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error: any) {
    if (error !== "cancel") {
      console.error("导入配置失败:", error);
      const errorMsg = error.message || "未知错误";
      ElMessage.error({
        message: `导入配置失败: ${errorMsg}`,
        duration: 5000,
        showClose: true,
      });
    }
  }
};

/**
 * 将字符串时间戳转换为 Date 对象
 */
const parseTimestamp = (value: any): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return getCurrentDateTime();
};

/**
 * 执行数据导入
 */
const importData = async (data: any) => {
  const { people, shifts, extraRestConfigs } = data;
  const now = getCurrentDateTime();
  const db = await dbManager.getDB();

  const transaction = db.transaction(
    ['people', 'shifts', 'extraRestConfigs'],
    'readwrite'
  );

  // 导入人员
  if (Array.isArray(people)) {
    for (const p of people) {
      // 验证必要字段
      if (!p.id || !p.name) {
        console.warn('跳过无效人员数据:', p);
        continue;
      }
      
      const item = {
        ...p,
        createdAt: parseTimestamp(p.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('people').put(item);
    }
  }

  // 导入班次
  if (Array.isArray(shifts)) {
    for (const s of shifts) {
      // 验证必要字段
      if (!s.id || !s.name) {
        console.warn('跳过无效班次数据:', s);
        continue;
      }
      
      const item = {
        ...s,
        createdAt: parseTimestamp(s.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('shifts').put(item);
    }
  }

  // 导入额外休息配置
  if (Array.isArray(extraRestConfigs)) {
    for (const c of extraRestConfigs) {
      // 验证必要字段
      if (!c.id || typeof c.year !== 'number' || typeof c.month !== 'number') {
        console.warn('跳过无效额外休息配置:', c);
        continue;
      }
      
      const item = {
        ...c,
        createdAt: parseTimestamp(c.createdAt),
        updatedAt: now,
      };
      transaction.objectStore('extraRestConfigs').put(item);
    }
  }

  // 只需等待事务完成
  await transaction.done;
};
</script>

<style lang="scss" scoped>
.config-management-page {
  height: 100%;
   min-height: 300px;
  .el-card {
    height: 100%;
    background: var(--el-bg-color);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 0;
  }

  .action-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 10px;

    .action-info {
      h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: var(--el-text-color-primary);
      }
      p {
        margin: 0;
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .divider {
    height: 1px;
    background-color: var(--el-border-color-lighter);
    margin: 0 10px;
  }
}
</style>

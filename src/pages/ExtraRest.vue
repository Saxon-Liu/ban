<template>
  <div class="extra-rest-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>额外休息配置</span>
          <el-date-picker
            v-model="selectedYearValue"
            type="year"
            format="YYYY年"
            value-format="YYYY"
            :clearable="false"
            :editable="false"
            style="width: 120px"
          />
        </div>
      </template>

      <el-table :data="configs" style="width: 100%; flex: 1;" v-loading="loading" height="100%">
        <el-table-column prop="month" label="月份" width="80">
          <template #default="{ row }"> {{ row.month }}月 </template>
        </el-table-column>
        <el-table-column label="额外休息天数" width="150">
          <template #default="{ row }">
            <el-input-number
              v-model="row.extraRestDays"
              :min="0"
              :max="31"
              :step="1"
              :disabled="isConfigSaving(row.month)"
              @change="handleConfigChange(row)"
              style="width: 120px"
            />
          </template>
        </el-table-column>
        <el-table-column label="说明" minWidth="250">
          <template #default="{ row }">
            该月所有员工增加 {{ row.extraRestDays }} 天休息天数
          </template>
        </el-table-column>
      </el-table>

      <div class="tips">
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          description="额外休息天数会影响员工的应休天数计算，修改后会实时保存并影响当月的人员剩余未排休天数统计。"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import type { ExtraRestConfig } from "@/types";
import { repositories } from "@/repositories";

// 响应式数据
const configs = ref<ExtraRestConfig[]>([]);
const loading = ref(false);
const savingMonths = ref<Set<number>>(new Set());
const selectedYear = ref(new Date().getFullYear());
const selectedYearValue = computed({
  get: () => String(selectedYear.value),
  set: (value: string | number) => {
    const nextYear = Number(value);
    if (!Number.isFinite(nextYear) || nextYear === selectedYear.value) return;
    selectedYear.value = nextYear;
    void loadConfigs();
  },
});

/**
 * 加载配置数据
 */
const loadConfigs = async () => {
  loading.value = true;
  try {
    // 获取指定年份的配置
    const yearConfigs = await repositories.extraRestConfigs.getByYear(
      selectedYear.value
    );

    // 创建12个月的配置数据
    const monthConfigs: ExtraRestConfig[] = [];
    for (let month = 1; month <= 12; month++) {
      const existingConfig = yearConfigs.find(
        (config) => config.month === month
      );
      if (existingConfig) {
        monthConfigs.push(existingConfig);
      } else {
        // 创建默认配置（0天）
        monthConfigs.push({
          id: "",
          year: selectedYear.value,
          month,
          extraRestDays: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    configs.value = monthConfigs;
  } catch (error) {
    console.error("加载配置失败:", error);
    ElMessage.error("加载配置失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 处理配置变更
 */
const handleConfigChange = async (config: ExtraRestConfig) => {
  if (savingMonths.value.has(config.month)) return;
  savingMonths.value = new Set(savingMonths.value).add(config.month);
  try {
    if (config.id) {
      // 更新现有配置
      await repositories.extraRestConfigs.update(config.id, {
        extraRestDays: config.extraRestDays,
      });
    } else {
      // 创建新配置
      const newConfig = await repositories.extraRestConfigs.create({
        year: config.year,
        month: config.month,
        extraRestDays: config.extraRestDays,
      });
      config.id = newConfig.id;
    }

    ElMessage.success(`${config.month}月配置已更新`);
  } catch (error) {
    console.error("保存配置失败:", error);
    ElMessage.error("保存配置失败");
    // 重新加载数据以恢复原值
    await loadConfigs();
  } finally {
    const nextSavingMonths = new Set(savingMonths.value);
    nextSavingMonths.delete(config.month);
    savingMonths.value = nextSavingMonths;
  }
};

const isConfigSaving = (month: number) => savingMonths.value.has(month);

// 页面加载时初始化数据
onMounted(() => {
  loadConfigs();
});
</script>

<style lang="scss" scoped>
.extra-rest-page {
  height: calc(100% - 2px);
  
  .el-card {
    height: 100%;
    background: var(--el-bg-color);
    display: flex;
    flex-direction: column;
  }

  :deep(.el-card__body) {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tips {
    margin-top: 20px;
  }
}
</style>

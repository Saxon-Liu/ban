<template>
  <div class="people-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>人员管理</span>
          <el-button
            type="primary"
            @click="
              showAddDialog = true;
              selectRandomColor();
            "
          >
            <el-icon>
              <Plus />
            </el-icon>
            新增人员
          </el-button>
        </div>
      </template>

      <el-table
        :data="people"
        style="width: 100%"
        v-loading="loading"
        row-key="id"
      >
        <el-table-column label="排序" width="60" fixed="left" align="center">
          <template #default="{ row }">
            <div
              :draggable="true"
              @dragstart="handleRowDragStart(row.id)"
              @dragover.prevent
              @drop="handleRowDrop(row.id)"
            >
              ≡
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="name"
          label="姓名"
          minWidth="120"
          show-overflow-tooltip
        />
        <el-table-column label="颜色" width="120">
          <template #default="{ row }">
            <div class="color-display">
              <div
                class="color-box"
                :style="{ backgroundColor: row.color }"
              ></div>
              <span>{{ row.color }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="baseRestDays" label="基础月休天数" width="120" />
        <el-table-column label="当前月份剩余未排休天数" width="200">
          <template #default="{ row }">
            <span :class="{ 'over-rest': row.statistics?.isOverRest }">
              {{
                row.statistics
                  ? row.statistics.isOverRest
                    ? `超休${Math.abs(row.statistics.remainingRestDays)}天`
                    : `剩余休息${row.statistics.remainingRestDays}天`
                  : "加载中..."
              }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              <el-icon>
                <Edit />
              </el-icon>
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              <el-icon>
                <Delete />
              </el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingPerson ? '编辑人员' : '新增人员'"
      width="400px"
    >
      <el-form
        :model="personForm"
        :rules="personRules"
        ref="personFormRef"
        label-width="110px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="personForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <div class="color-picker-container">
            <!-- <div
              class="color-preview"
              :style="{ backgroundColor: personForm.color }"
            ></div> -->
            <!-- <el-button @click="selectRandomColor">随机选择</el-button> -->
            <el-color-picker v-model="personForm.color" />
          </div>
        </el-form-item>
        <el-form-item label="基础月休天数" prop="baseRestDays">
          <el-input-number
            v-model="personForm.baseRestDays"
            :min="0"
            :max="31"
            :step="1"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Edit, Delete } from "@element-plus/icons-vue";
import type { Person, PersonWithStatistics } from "@/types";
import { repositories } from "@/repositories";
import { getCurrentMonth } from "@/utils";

// 响应式数据
const people = ref<PersonWithStatistics[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);
const editingPerson = ref<Person | null>(null);
const personFormRef = ref();

// 表单数据
const personForm = reactive({
  name: "",
  color: "#FF6B6B",
  baseRestDays: 4,
});

// 表单验证规则
const personRules = {
  name: [
    { required: true, message: "请输入姓名", trigger: "blur" },
    { min: 1, max: 10, message: "姓名长度不能超过10个字符", trigger: "blur" },
  ],
  color: [{ required: true, message: "请选择颜色", trigger: "change" }],
  baseRestDays: [
    { required: true, message: "请输入基础月休天数", trigger: "change" },
    {
      type: "number",
      min: 0,
      max: 31,
      message: "基础月休天数必须在0-31之间",
      trigger: "change",
    },
  ],
};

/**
 * 加载人员列表
 */
const loadPeople = async () => {
  loading.value = true;
  try {
    const currentMonth = getCurrentMonth();
    people.value = await repositories.people.getAllWithStatistics(currentMonth);
  } catch (error) {
    console.error("加载人员列表失败:", error);
    ElMessage.error("加载人员列表失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 随机选择颜色
 */
const selectRandomColor = async () => {
  try {
    const color = await repositories.people.getNextColor();
    personForm.color = color;
  } catch (error) {
    console.error("获取随机颜色失败:", error);
    ElMessage.error("获取随机颜色失败");
  }
};

/**
 * 编辑人员
 */
const handleEdit = (person: PersonWithStatistics) => {
  editingPerson.value = person;
  personForm.name = person.name;
  personForm.color = person.color;
  personForm.baseRestDays = person.baseRestDays;
  showAddDialog.value = true;
};

/**
 * 删除人员
 */
const handleDelete = async (person: PersonWithStatistics) => {
  try {
    // 检查是否有排班记录
    const hasSchedules = await repositories.people.hasScheduleRecords(
      person.id
    );

    if (hasSchedules) {
      await ElMessageBox.confirm(
        `人员 "${person.name}" 已有排班记录，删除将同时清理所有相关排班数据。是否继续？`,
        "确认删除",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    } else {
      await ElMessageBox.confirm(
        `确定要删除人员 "${person.name}" 吗？`,
        "确认删除",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    }

    await repositories.people.delete(person.id);
    ElMessage.success("删除成功");
    await loadPeople();
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除人员失败:", error);
      ElMessage.error("删除失败");
    }
  }
};

/**
 * 提交表单
 */
const handleSubmit = async () => {
  try {
    await personFormRef.value.validate();

    if (editingPerson.value) {
      // 编辑模式
      await repositories.people.update(editingPerson.value.id, personForm);
      ElMessage.success("编辑成功");
    } else {
      // 新增模式
      await repositories.people.create(personForm);
      ElMessage.success("新增成功");
    }

    showAddDialog.value = false;
    await loadPeople();
  } catch (error) {
    console.error("保存人员失败:", error);
    ElMessage.error("保存失败");
  }
};

// 监听对话框关闭事件，重置表单
watch(showAddDialog, (newVal) => {
  if (!newVal) {
    editingPerson.value = null;
    personForm.name = "";
    personForm.color = "#FF6B6B";
    personForm.baseRestDays = 8;
    personFormRef.value?.resetFields();
  }
});

// 页面加载时初始化数据
onMounted(() => {
  loadPeople();
});

// 拖拽排序
const draggingId = ref<string | null>(null);
const handleRowDragStart = (id: string) => {
  draggingId.value = id;
};
const handleRowDrop = async (targetId: string) => {
  try {
    if (!draggingId.value || draggingId.value === targetId) return;
    const list = [...people.value];
    const from = list.findIndex((p) => p.id === draggingId.value);
    const to = list.findIndex((p) => p.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const updates = list.map((p, idx) => ({
      id: p.id,
      data: { order: idx + 1 },
    }));
    await repositories.people.batchUpdate(updates);
    await loadPeople();
  } catch (error) {
    console.error("[people-reorder-error]", {
      time: new Date().toISOString(),
      params: { draggingId: draggingId.value, targetId },
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    });
    ElMessage.error("排序失败");
  } finally {
    draggingId.value = null;
  }
};
</script>

<style lang="scss" scoped>
.people-page {
  height: 100%;
  min-height: 300px;

  .el-card {
    height: 100%;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .color-display {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-box {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  .color-picker-container {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .color-preview {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  .over-rest {
    color: #f56c6c;
    font-weight: bold;
  }
}
</style>

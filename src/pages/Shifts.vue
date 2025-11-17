<template>
  <div class="shifts-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>班次管理</span>
          <el-button type="primary" @click="showAddDialog = true">
            <el-icon><Plus /></el-icon>
            新增班次
          </el-button>
        </div>
      </template>

      <!-- 班次列表（支持拖拽排序） -->
      <div class="shift-section">
        <h3>班次列表</h3>
        <el-table
          :data="shifts"
          style="width: 100%"
          v-loading="loading"
          row-key="id"
        >
          <el-table-column label="排序" width="80">
            <template #default="{ row }">
              <div
                class="drag-handle"
                :draggable="true"
                @dragstart="handleRowDragStart(row.id)"
                @dragover.prevent
                @drop="handleRowDrop(row.id)"
              >
                ≡
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="班次名称" minWidth="120" />
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
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingShift ? '编辑班次' : '新增班次'"
      width="400px"
    >
      <el-form
        :model="shiftForm"
        :rules="shiftRules"
        ref="shiftFormRef"
        label-width="100px"
      >
        <el-form-item label="班次名称" prop="name">
          <el-input v-model="shiftForm.name" placeholder="请输入班次名称" />
        </el-form-item>
        <el-form-item label="颜色" prop="color">
          <div class="color-picker-container">
            <!-- <div
              class="color-preview"
              :style="{ backgroundColor: shiftForm.color }"
            ></div> -->
            <el-color-picker v-model="shiftForm.color" />
          </div>
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
import type { Shift } from "@/types";
import { repositories } from "@/repositories";

// 响应式数据
const shifts = ref<Shift[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);
const editingShift = ref<Shift | null>(null);
const shiftFormRef = ref();

// 表单数据
const shiftForm = reactive({
  name: "",
  color: "#FF6B6B",
});

// 表单验证规则
const shiftRules = {
  name: [
    { required: true, message: "请输入班次名称", trigger: "blur" },
    {
      min: 1,
      max: 10,
      message: "班次名称长度不能超过10个字符",
      trigger: "blur",
    },
  ],
  color: [{ required: true, message: "请选择颜色", trigger: "change" }],
};

/**
 * 加载班次列表
 */
const loadShifts = async () => {
  loading.value = true;
  try {
    const all = await repositories.shifts.getAll();
    shifts.value = all;
    console.log("班次加载完成:", {
      总班次: all.length,
      班次列表: all.map((s) => s.name),
    });
  } catch (error) {
    console.error("[loadShifts-error]", {
      time: new Date().toISOString(),
      params: {},
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    });
    ElMessage.error("加载班次列表失败");
  } finally {
    loading.value = false;
  }
};

/**
 * 编辑班次
 */
const handleEdit = (shift: Shift) => {
  editingShift.value = shift;
  shiftForm.name = shift.name;
  shiftForm.color = shift.color;
  showAddDialog.value = true;
};

/**
 * 删除班次
 */
const handleDelete = async (shift: Shift) => {
  try {
    // 检查是否有排班记录
    const hasSchedules = await repositories.shifts.hasScheduleRecords(shift.id);

    if (hasSchedules) {
      await ElMessageBox.confirm(
        `班次 "${shift.name}" 已有排班记录，删除将同时清理所有相关排班数据。是否继续？`,
        "确认删除",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    } else {
      await ElMessageBox.confirm(
        `确定要删除班次 "${shift.name}" 吗？`,
        "确认删除",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    }

    await repositories.shifts.delete(shift.id);
    ElMessage.success("删除成功");
    await loadShifts();
  } catch (error) {
    if (error !== "cancel") {
      console.error("[deleteShift-error]", {
        time: new Date().toISOString(),
        params: { id: shift.id, name: shift.name },
        message: (error as any)?.message,
        stack: (error as any)?.stack,
      });
      ElMessage.error((error as any)?.message || "删除失败");
    }
  }
};

/**
 * 提交表单
 */
const handleSubmit = async () => {
  try {
    await shiftFormRef.value.validate();

    // 检查班次名称是否已存在
    const isNameExists = await repositories.shifts.isNameExists(
      shiftForm.name,
      editingShift.value?.id
    );

    if (isNameExists) {
      ElMessage.error("班次名称已存在");
      return;
    }

    if (editingShift.value) {
      // 编辑模式
      await repositories.shifts.update(editingShift.value.id, shiftForm);
      ElMessage.success("编辑成功");
    } else {
      // 新增模式
      const newShift = await repositories.shifts.create({
        name: shiftForm.name,
        color: shiftForm.color,
        isRest: false,
      });
      console.log("新增班次成功:", newShift);
      ElMessage.success("新增成功");
    }

    showAddDialog.value = false;
    await loadShifts();
  } catch (error) {
    console.error("[saveShift-error]", {
      time: new Date().toISOString(),
      params: {
        editingId: editingShift.value?.id,
        name: shiftForm.name,
        color: shiftForm.color,
      },
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    });
    ElMessage.error("保存失败");
  }
};

// 监听对话框关闭事件，重置表单
watch(showAddDialog, (newVal) => {
  if (!newVal) {
    editingShift.value = null;
    shiftForm.name = "";
    shiftForm.color = "#FF6B6B";
    shiftFormRef.value?.resetFields();
  }
});

// 页面加载时初始化数据
onMounted(() => {
  loadShifts();
});

// 拖拽排序
const draggingId = ref<string | null>(null);
const handleRowDragStart = (id: string) => {
  draggingId.value = id;
};
const handleRowDrop = async (targetId: string) => {
  try {
    if (!draggingId.value || draggingId.value === targetId) return;
    const list = [...shifts.value];
    const from = list.findIndex((s) => s.id === draggingId.value);
    const to = list.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    // 重新计算并持久化顺序
    const updates = list.map((s, idx) => ({
      id: s.id,
      data: { order: idx + 1 },
    }));
    await repositories.shifts.batchUpdate(updates);
    shifts.value = await repositories.shifts.getAll();
  } catch (error) {
    console.error("[shift-reorder-error]", {
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
.shifts-page {
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

  .shift-section {
    margin-bottom: 30px;

    h3 {
      margin-bottom: 15px;
      color: #303133;
    }
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
}
</style>

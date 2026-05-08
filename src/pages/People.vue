<template>
  <div class="people-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>人员管理</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <el-button
              type="primary"
              :icon="Plus"
              @click="
                showAddDialog = true;
                selectRandomColor();
              "
            >
              新增人员
            </el-button>
            <el-button @click="handleImportPeople" :icon="Upload">

              导入
            </el-button>
            <el-button @click="handleExportPeople" :icon="Download">
              导出
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="people"
        style="width: 100%; flex: 1;"
        v-loading="loading"
        row-key="id"
        id="people-table"
        height="100%"
      >
        <el-table-column label="排序" width="60" fixed="left" align="center">
          <template #default>
            <div class="drag-handle">
              <el-icon><Rank /></el-icon>
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
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)" :icon="Edit">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)" :icon="Delete">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <input
      ref="importFileRef"
      type="file"
      accept=".xlsx"
      style="display:none;"
      @change="handleImportFileChange"
    />

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
import { ref, onMounted, onBeforeUnmount, reactive, watch, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Edit, Delete, Upload, Download, Rank } from "@element-plus/icons-vue";
import type { Person, PersonWithStatistics } from "@/types";
import { repositories } from "@/repositories";
import { excelExportService, getViewedScheduleMonth } from "@/services";
import Sortable from "sortablejs";

// 响应式数据
const people = ref<PersonWithStatistics[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);
const editingPerson = ref<Person | null>(null);
const personFormRef = ref();
const importFileRef = ref<HTMLInputElement | null>(null);
let sortableInstance: Sortable | null = null;

// 表单数据
const personForm = reactive({
  name: "",
  color: "#FF6B6B",
  baseRestDays: 8,
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
    const currentMonth = getViewedScheduleMonth();
    people.value = await repositories.people.getAllWithStatistics(currentMonth);
    initSortable();
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
        `人员 "${person.name}" 已有历史排班记录。归档后会保留今天之前的历史排班，并自动清理今天及未来的待执行排班，后续新增同名人员也会视为新人员。是否继续？`,
        "确认归档",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning",
        }
      );
    } else {
      await ElMessageBox.confirm(
        `确定要归档人员 "${person.name}" 吗？归档后该人员将不再出现在后续排班和人员列表中。`,
        "确认归档",
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

const initSortable = () => {
  nextTick(() => {
    sortableInstance?.destroy();
    sortableInstance = null;
    const table = document.querySelector("#people-table .el-table__body-wrapper tbody");
    if (table) {
      sortableInstance = Sortable.create(table as HTMLElement, {
        handle: ".drag-handle",
        animation: 150,
        ghostClass: "sortable-ghost",
        onEnd: async (evt: any) => {
          const { newIndex, oldIndex } = evt;
          if (newIndex === oldIndex) return;
          
          // Update local array
          const list = [...people.value];
          const [movedItem] = list.splice(oldIndex, 1);
          list.splice(newIndex, 0, movedItem);
          people.value = list;

          // Update backend
          try {
            const updates = list.map((p, idx) => ({
              id: p.id,
              data: { order: idx + 1 },
            }));
            if (repositories.people.batchUpdate) {
              await repositories.people.batchUpdate(updates);
            } else {
              for (const u of updates) {
                await repositories.people.update(u.id, u.data);
              }
            }
          } catch (error) {
            console.error("更新排序失败:", error);
            ElMessage.error("排序保存失败");
            // Reload to revert if failed
            await loadPeople();
          }
        },
      });
    }
  });
};

// 页面加载时初始化数据
onMounted(() => {
  loadPeople();
});

onBeforeUnmount(() => {
  sortableInstance?.destroy();
  sortableInstance = null;
});

const handleExportPeople = async () => {
  try {
    const list = await repositories.people.getAll();
    let fileName = '人员模板'
    if (list.length > 0) {
      fileName= '人员列表'
    }
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(fileName);
    sheet.addRow(["姓名", "颜色", "基础月休天数"]);
    if (list.length > 0) {
      list.forEach((p) => {
        sheet.addRow([p.name, p.color, p.baseRestDays]);
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    excelExportService.downloadExcel(blob, `${fileName}.xlsx`);
    ElMessage.success("导出成功");
  } catch (error: any) {
    console.error("[people-export-error]", {
      time: new Date().toISOString(),
      params: {},
      message: error?.message,
      stack: error?.stack,
    });
    ElMessage.error("导出失败");
  }
};

const handleImportPeople = () => {
  try {
    importFileRef.value?.click();
  } catch (error: any) {
    console.error("[people-import-open-error]", {
      time: new Date().toISOString(),
      params: {},
      message: error?.message,
      stack: error?.stack,
    });
  }
};

const handleImportFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    const existingPeople = await repositories.people.getAll();
    const existingNameSet = new Set(
      existingPeople.map((person) => person.name.trim())
    );
    const buffer = await file.arrayBuffer();
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      ElMessage.error("文件内容为空");
      return;
    }
    const header = sheet.getRow(1).values as any[];
    const nameIdx = header.findIndex((v) => v === "姓名");
    const colorIdx = header.findIndex((v) => v === "颜色");
    const restIdx = header.findIndex((v) => v === "基础月休天数");
    if (nameIdx < 0 || colorIdx < 0 || restIdx < 0) {
      ElMessage.error("模板表头不正确");
      return;
    }
    const rows = sheet.getRows(2, sheet.rowCount - 1) || [];
    const duplicateExistingNames = new Set<string>();
    const duplicateInFileNames = new Set<string>();
    const fileNameSet = new Set<string>();
    for (const r of rows) {
      const vals = (r.values as any[]) || [];
      const name = String(vals[nameIdx] || "").trim();
      if (!name) continue;
      if (existingNameSet.has(name)) {
        duplicateExistingNames.add(name);
      }
      if (fileNameSet.has(name)) {
        duplicateInFileNames.add(name);
      } else {
        fileNameSet.add(name);
      }
    }

    let skipExistingDuplicates = false;
    if (duplicateExistingNames.size > 0) {
      try {
        await ElMessageBox.confirm(
          `检测到与当前人员列表重名 ${duplicateExistingNames.size} 条。确定后将继续导入，并把这些重名人员视为新人员；取消则跳过这些重名人员。`,
          "重名导入确认",
          {
            confirmButtonText: "继续导入重名",
            cancelButtonText: "跳过现有重名",
            type: "warning",
            distinguishCancelAndClose: true,
          }
        );
      } catch (error) {
        if (error === "cancel") {
          skipExistingDuplicates = true;
        } else {
          throw error;
        }
      }
    }

    let created = 0;
    let skippedExisting = 0;
    let skippedInFile = 0;
    const importedNameSet = new Set<string>();
    for (const r of rows) {
      const vals = (r.values as any[]) || [];
      const name = String(vals[nameIdx] || "").trim();
      if (!name) continue;
      if (skipExistingDuplicates && existingNameSet.has(name)) {
        skippedExisting++;
        continue;
      }
      if (importedNameSet.has(name)) {
        skippedInFile++;
        continue;
      }
      let color = String(vals[colorIdx] || "").trim();
      if (!color) {
        try {
          color = await repositories.people.getNextColor();
        } catch {
          color = "#FF6B6B";
        }
      }
      let baseRestDays = Number(vals[restIdx] ?? 8);
      if (Number.isNaN(baseRestDays)) baseRestDays = 8;
      if (baseRestDays < 0) baseRestDays = 0;
      if (baseRestDays > 31) baseRestDays = 31;
      try {
        await repositories.people.create({ name, color, baseRestDays });
        importedNameSet.add(name);
        created++;
      } catch (err: any) {
        console.error("[people-import-create-error]", {
          time: new Date().toISOString(),
          params: { name, color, baseRestDays },
          message: err?.message,
          stack: err?.stack,
        });
      }
    }
    ElMessage.success(
      `导入完成：新增 ${created} 条，跳过现有重名 ${skippedExisting} 条，跳过文件内重复 ${skippedInFile} 条`
    );
    await loadPeople();
  } catch (error: any) {
    console.error("[people-import-error]", {
      time: new Date().toISOString(),
      params: { fileName: file.name },
      message: error?.message,
      stack: error?.stack,
    });
    ElMessage.error("导入失败");
  } finally {
    if (importFileRef.value) importFileRef.value.value = "";
  }
};
</script>

<style lang="scss" scoped>
.people-page {
  height: 100%;
  /* min-height: 300px; Remove explicit min-height to allow flex shrinking if needed, or keep if desired */
  
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
    color: var(--el-color-error);
    font-weight: bold;
  }

  .drag-handle {
    cursor: grab;
    padding: 8px;
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    transition: all 0.2s;
    display: flex;
    justify-content: center;
    align-items: center;

    &:hover {
      background-color: var(--el-fill-color-light);
      color: var(--el-color-primary);
      transform: scale(1.2);
    }

    &:active {
      cursor: grabbing;
      transform: scale(1.1);
    }

    .el-icon {
      font-size: 18px;
    }
  }

  :deep(.el-table__row) {
    &.sortable-ghost {
      opacity: 0.5;
      background-color: var(--el-color-primary-light-9);
      border: 1px dashed var(--el-color-primary);
      
      td {
        background-color: transparent !important;
      }
    }
  }
}
</style>

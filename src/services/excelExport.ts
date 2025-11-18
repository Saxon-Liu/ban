/**
 * Excel导出服务
 * 提供排班数据导出为Excel文件的功能
 */

import type { Worksheet } from 'exceljs'
import type { Shift, Person, Schedule } from '@/types'
import { formatDate, getMonthDates } from '@/utils'

/**
 * 月度排班导出数据
 */
interface MonthlyExportData {
  /** 日期 */
  date: string
  /** 星期几 */
  weekday: string
  /** 各班次的人员列表（班次名称 -> 人员姓名列表） */
  shifts: Record<string, string[]>
}

/**
 * Excel导出服务类
 */
export class ExcelExportService {
  /**
   * 导出月度排班数据到Excel
   * @param yearMonth - 年月字符串（YYYY-MM格式）
   * @param shifts - 班次列表
   * @param people - 人员列表
   * @param schedules - 排班记录列表
   * @returns Excel文件的Blob对象
   */
  async exportMonthlySchedule(
    yearMonth: string,
    shifts: Shift[],
    people: Person[],
    schedules: Schedule[]
  ): Promise<Blob> {
    try {
      const exportData = this.prepareExportData(yearMonth, shifts, people, schedules)
      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      const worksheet = workbook.addWorksheet(`${yearMonth}排班表`)
      this.fillWorksheetWithExcelJS(worksheet, exportData, shifts)
      const buffer = await workbook.xlsx.writeBuffer()
      return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    } catch (error: any) {
      console.error('[excel-export-error]', {
        time: new Date().toISOString(),
        params: { yearMonth, shiftCount: shifts.length, peopleCount: people.length, scheduleCount: schedules.length },
        message: error?.message,
        stack: error?.stack,
      })
      throw error
    }
  }

  /**
   * 准备导出数据
   */
  private prepareExportData(
    yearMonth: string,
    shifts: Shift[],
    people: Person[],
    schedules: Schedule[]
  ): MonthlyExportData[] {
    const dates = getMonthDates(yearMonth)
    const peopleMap = new Map(people.map(p => [p.id, p]))
    
    return dates.map(dateInfo => {
      // 获取当天的排班记录
      const daySchedules = schedules.filter(s => s.date === dateInfo.date)
      
      // 按班次分组人员
      const shiftPeople: Record<string, string[]> = {}
      shifts.forEach(shift => {
        const personIds = daySchedules
          .filter(s => s.shiftId === shift.id)
          .map(s => s.personId)
        
        shiftPeople[shift.name] = personIds
          .map(id => peopleMap.get(id)?.name)
          .filter(Boolean) as string[]
      })
      
      return {
        date: formatDate(dateInfo.date, 'MM-DD'),
        weekday: dateInfo.weekdayName,
        shifts: shiftPeople
      }
    })
  }

  /**
   * 创建工作表
   */
  private fillWorksheetWithExcelJS(
    worksheet: Worksheet,
    exportData: MonthlyExportData[],
    shifts: Shift[]
  ): void {
    const maxPerShift = shifts.map(shift => {
      let max = 1
      for (const d of exportData) {
        const list = d.shifts[shift.name] || []
        if (list.length > max) max = list.length
      }
      const minSpan = shift.isRest ? 1 : 4
      return Math.max(max, minSpan)
    })

    let col = 1
    worksheet.getCell(1, col).value = '日期'
    worksheet.getCell(1, col).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(1, col).font = { bold: true }
    worksheet.getColumn(col).width = 10
    col++
    worksheet.getCell(1, col).value = '星期'
    worksheet.getCell(1, col).alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getCell(1, col).font = { bold: true }
    worksheet.getColumn(col).width = 8
    col++

    const groupRanges: { start: number; end: number }[] = []
    shifts.forEach((shift, idx) => {
      const span = maxPerShift[idx]
      const start = col
      const end = col + span - 1
      worksheet.getCell(1, start).value = shift.name
      worksheet.mergeCells(1, start, 1, end)
      worksheet.getCell(1, start).alignment = { horizontal: 'center', vertical: 'middle' }
      worksheet.getCell(1, start).font = { bold: true }
      for (let c = start; c <= end; c++) {
        worksheet.getColumn(c).width = 10
      }
      groupRanges.push({ start, end })
      col = end + 1
    })

    for (const range of groupRanges) {
      const leftCell = worksheet.getCell(1, range.start)
      const rightCell = worksheet.getCell(1, range.end)
      leftCell.border = {
        left: { style: 'medium', color: { argb: 'FF000000' } },
      }
      rightCell.border = {
        right: { style: 'medium', color: { argb: 'FF000000' } },
      }
    }

    for (let i = 0; i < exportData.length; i++) {
      const rowIndex = i + 2
      const d = exportData[i]
      worksheet.getRow(rowIndex).height = 20
      worksheet.getCell(rowIndex, 1).value = d.date
      worksheet.getCell(rowIndex, 2).value = d.weekday
      let c = 3
      shifts.forEach((shift, idx) => {
        const span = maxPerShift[idx]
        const names = d.shifts[shift.name] || []
        for (let k = 0; k < span; k++) {
          worksheet.getCell(rowIndex, c + k).value = names[k] || ''
        }
        c += span
      })
      const isWeekend = d.weekday === '周六' || d.weekday === '周日'
      if (isWeekend) {
        const lastCol = 2 + maxPerShift.reduce((a, b) => a + b, 0)
        for (let cc = 1; cc <= lastCol; cc++) {
          const cell = worksheet.getCell(rowIndex, cc)
          // 周末单元格背景颜色为黄色
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
          }
        }
      }
      for (const range of groupRanges) {
        const leftCell = worksheet.getCell(rowIndex, range.start)
        const rightCell = worksheet.getCell(rowIndex, range.end)
        leftCell.border = {
          ...leftCell.border,
          left: { style: 'medium', color: { argb: 'FF000000' } },
        }
        rightCell.border = {
          ...rightCell.border,
          right: { style: 'medium', color: { argb: 'FF000000' } },
        }
      }
    }
  }

  /**
   * 下载Excel文件
   * @param blob - Excel文件的Blob对象
   * @param filename - 文件名
   */
  downloadExcel(blob: Blob, filename: string): void {
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    
    // 触发下载
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * 全局Excel导出服务实例
 */
export const excelExportService = new ExcelExportService()
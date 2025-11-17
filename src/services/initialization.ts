/**
 * 数据初始化服务
 * 负责系统初始化时的默认数据创建
 */

import { repositories } from '@/repositories'
import { DEFAULT_SHIFTS } from '@/utils/constants'

/**
 * 初始化默认班次
 * 如果数据库中没有班次数据，则创建默认班次
 */
export async function initializeDefaultShifts(): Promise<void> {
  try {
    const existingShifts = await repositories.shifts.getAll()
    console.log('班次数据检查:', {
      总班次数量: existingShifts.length,
      有效班次数量: existingShifts.filter(s => s && s.name && s.color).length
    })
    if (existingShifts.length === 0) {
      console.log('无班次数据，开始初始化默认班次...')
      for (const shift of DEFAULT_SHIFTS) {
        try {
          const newShift = await repositories.shifts.create({
            name: shift.name,
            color: shift.color,
            isRest: shift.isRest
          })
          console.log('创建班次成功:', { name: newShift.name, id: newShift.id })
        } catch (error: any) {
          console.error('[initializeDefaultShifts-error]', {
            time: new Date().toISOString(),
            params: { name: shift.name, color: shift.color, isRest: shift.isRest },
            message: error?.message,
            stack: error?.stack,
          })
        }
      }
      console.log('默认班次初始化完成')
    } else {
      console.log('已有班次数据，跳过默认班次初始化')
    }
  } catch (error) {
    console.error('[initializeDefaultShifts-fatal]', {
      time: new Date().toISOString(),
      params: {},
      message: (error as any)?.message,
      stack: (error as any)?.stack,
    })
    throw error
  }
}

/**
 * 初始化系统数据
 * 调用所有初始化函数
 */
export async function initializeSystem(): Promise<void> {
  try {
    await initializeDefaultShifts()
    console.log('系统初始化完成')
  } catch (error) {
    console.error('系统初始化失败:', error)
    throw error
  }
}
/**
 * 数据初始化服务
 * 负责系统初始化时的默认数据创建
 */

import { dbManager } from '@/repositories/IndexedDBManager'
import { getCurrentDateTime } from '@/utils/common'
import { DEFAULT_SHIFTS } from '@/utils/constants'

/**
 * 初始化默认班次
 * 如果数据库中没有班次数据，则创建默认班次
 */
export async function initializeDefaultShifts(): Promise<void> {
  try {
    const db = await dbManager.getDB()
    const count = await db.count('shifts')
    console.log('班次数据检查:', { 总班次数量: count })
    if (count === 0) {
      console.log('无班次数据，开始初始化默认班次...')
      const now = getCurrentDateTime()
      const tx = db.transaction('shifts', 'readwrite')
      await Promise.all(
        DEFAULT_SHIFTS.map((shift, index) =>
          tx.store.add({
            id: shift.id,
            name: shift.name,
            color: shift.color,
            isRest: shift.isRest,
            order: index + 1,
            createdAt: now,
            updatedAt: now,
          })
        )
      )
      await tx.done
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
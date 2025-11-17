/**
 * 强制重新初始化数据库
 * 清除所有数据并重新创建默认班次
 */

const { repositories } = require('./src/repositories/index.ts')
const { DEFAULT_SHIFTS } = require('./src/utils/constants.ts')

async function forceReinitialize() {
  console.log('=== 强制重新初始化开始 ===')
  
  try {
    // 1. 清除所有现有班次数据
    console.log('1. 清除所有班次数据...')
    const existingShifts = await repositories.shifts.getAll()
    console.log(`找到 ${existingShifts.length} 个班次`)
    
    for (const shift of existingShifts) {
      if (shift && shift.id) {
        try {
          await repositories.shifts.delete(shift.id)
          console.log(`删除班次: ${shift.name} (${shift.id})`)
        } catch (error) {
          console.warn(`删除班次失败: ${shift.id}`, error)
        }
      }
    }
    
    // 2. 重新创建默认班次
    console.log('\n2. 创建默认班次...')
    for (const shift of DEFAULT_SHIFTS) {
      try {
        const newShift = await repositories.shifts.create({
          name: shift.name,
          color: shift.color,
          isDefault: shift.isDefault
        })
        console.log(`✅ 创建班次: ${newShift.name} (${newShift.id})`)
      } catch (error) {
        console.error(`❌ 创建班次失败: ${shift.name}`, error)
      }
    }
    
    // 3. 验证创建结果
    console.log('\n3. 验证创建结果...')
    const finalShifts = await repositories.shifts.getAll()
    const defaultShifts = await repositories.shifts.getDefaultShifts()
    const customShifts = await repositories.shifts.getCustomShifts()
    
    console.log(`总班次数量: ${finalShifts.length}`)
    console.log(`默认班次数量: ${defaultShifts.length}`)
    console.log(`自定义班次数量: ${customShifts.length}`)
    
    console.log('\n默认班次列表:')
    defaultShifts.forEach(shift => {
      console.log(`- ${shift.name} (${shift.color})`)
    })
    
    console.log('\n✅ 强制重新初始化完成！')
    
  } catch (error) {
    console.error('❌ 强制重新初始化失败:', error)
  }
  
  process.exit(0)
}

// 执行强制重新初始化
forceReinitialize().catch(console.error)
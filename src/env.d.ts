/**
 * 全局类型声明文件
 * 为Vue组件提供TypeScript类型支持
 */

import type { ComponentCustomProperties } from 'vue'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    // 可以在这里添加全局属性
  }
}

export {}
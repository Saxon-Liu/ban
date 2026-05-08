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

interface ElectronAppContext {
  userName: string
  roles: string[]
  permissions: string[]
  routeBase: string
  defaultRoute: string
  themeMode: string
  locale: string
}

interface ElectronExportLogResult {
  success: boolean
  filePath?: string
  files?: string[]
}

interface Window {
  electronAPI?: {
    getAppContext: () => Promise<ElectronAppContext>
    getVersion: () => Promise<string>
    exportLog: () => Promise<ElectronExportLogResult>
    onThemeChange: (callback: (theme: 'dark' | 'light') => void) => () => void
    platform: string
    isElectron: true
  }
}

export {}

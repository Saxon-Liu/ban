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

declare global {
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

interface ElectronSaveFileResult {
  success: boolean
  canceled?: boolean
  filePath?: string
}

interface Window {
  electronAPI?: {
    getAppContext: () => Promise<ElectronAppContext>
    getVersion: () => Promise<string>
    exportLog: () => Promise<ElectronExportLogResult>
    logRenderer: (payload: {
      level?: 'info' | 'warn' | 'error'
      source?: string
      message?: string
      data?: unknown
    }) => Promise<{ success: boolean }>
    saveTextFile: (
      defaultFileName: string,
      content: string,
      filters?: Array<{ name: string; extensions: string[] }>
    ) => Promise<ElectronSaveFileResult>
    saveBinaryFile: (
      defaultFileName: string,
      bytes: number[],
      filters?: Array<{ name: string; extensions: string[] }>
    ) => Promise<ElectronSaveFileResult>
    onThemeChange: (callback: (theme: 'dark' | 'light') => void) => () => void
    platform: string
    isElectron: true
  }
}
}

export {}

/**
 * IndexedDB数据库管理器
 * 负责数据库的初始化和连接管理
 */

import { openDB, IDBPDatabase } from "idb";

// 为避免与 idb v8 的 DBSchema 类型定义不兼容导致的构建错误，
// 这里不对数据库实例应用泛型 Schema，保持运行时行为不变。

/**
 * 数据库配置常量
 */
const DB_CONFIG = {
  /** 数据库名称 */
  NAME: "ScheduleManagementDB",
  /** 数据库版本 */
  VERSION: 3,
} as const;

/**
 * IndexedDB管理器类
 * 提供数据库连接和基础操作方法
 */
export class IndexedDBManager {
  private db: IDBPDatabase | null = null;

  /**
   * 获取数据库实例
   * 如果数据库未连接，则先进行连接
   */
  async getDB(): Promise<IDBPDatabase> {
    if (!this.db) {
      this.db = await this.connect();
    }
    return this.db;
  }

  /**
   * 连接数据库
   * 创建对象存储和索引
   */
  private async connect(): Promise<IDBPDatabase> {
    return openDB(DB_CONFIG.NAME, DB_CONFIG.VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // 版本2：推倒重来，删除旧对象存储
        if (oldVersion < 2) {
          const STORE_NAMES = [
            "people",
            "shifts",
            "schedules",
            "extraRestConfigs",
          ] as const;
          STORE_NAMES.forEach((name) => {
            if (db.objectStoreNames.contains(name)) {
              db.deleteObjectStore(name);
            }
          });
        }

        // 人员表
        if (!db.objectStoreNames.contains("people")) {
          const peopleStore = db.createObjectStore("people", { keyPath: "id" });
          peopleStore.createIndex("by-name", "name");
          peopleStore.createIndex("by-color", "color");
        }

        // 班次表
        if (!db.objectStoreNames.contains("shifts")) {
          const shiftsStore = db.createObjectStore("shifts", { keyPath: "id" });
          shiftsStore.createIndex("by-name", "name");
          shiftsStore.createIndex("by-isRest", "isRest");
          shiftsStore.createIndex("by-order", "order");
        }

        // 排班记录表
        if (!db.objectStoreNames.contains("schedules")) {
          const schedulesStore = db.createObjectStore("schedules", {
            keyPath: "id",
          });
          schedulesStore.createIndex("by-personId", "personId");
          schedulesStore.createIndex("by-shiftId", "shiftId");
          schedulesStore.createIndex("by-date", "date");
          schedulesStore.createIndex("by-month", "month");
          schedulesStore.createIndex("by-personId-month", ["personId", "month"]);
          schedulesStore.createIndex("by-personId-date", ["personId", "date"], {
            unique: true,
          });
        } else if (oldVersion < 3) {
          const schedulesStore = transaction.objectStore("schedules");
          if (!schedulesStore.indexNames.contains("by-personId-month")) {
            schedulesStore.createIndex("by-personId-month", ["personId", "month"]);
          }
        }

        // 额外休息配置表
        if (!db.objectStoreNames.contains("extraRestConfigs")) {
          const configsStore = db.createObjectStore("extraRestConfigs", {
            keyPath: "id",
          });
          configsStore.createIndex("by-year", "year");
          configsStore.createIndex("by-month", "month");
          configsStore.createIndex("by-year-month", ["year", "month"], {
            unique: true,
          });
        }
      },
    });
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 删除数据库
   * 谨慎使用，会清除所有数据
   */
  async deleteDatabase(): Promise<void> {
    await this.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_CONFIG.NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * 全局数据库管理器实例
 */
export const dbManager = new IndexedDBManager();

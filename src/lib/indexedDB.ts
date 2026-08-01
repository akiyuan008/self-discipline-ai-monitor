/**
 * 轻量 IndexedDB 封装 — 用于持久化大规模学习数据
 * 支持版本控制和自动迁移
 */

const DB_NAME = 'cyber-survival-db'
const DB_VERSION = 1

// 对象仓库定义
const STORES = {
  gaokaoProfile: 'gaokao-profile',   // 高考档案
  errorQuestions: 'error-questions', // 错题记录
  chatHistory: 'chat-history',       // 聊天历史（备份）
  milestones: 'milestones'           // 备考里程碑
} as const

let dbInstance: IDBDatabase | null = null

/** 打开/创建数据库 */
export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      // 创建对象仓库
      if (!db.objectStoreNames.contains(STORES.gaokaoProfile)) {
        db.createObjectStore(STORES.gaokaoProfile, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.errorQuestions)) {
        const store = db.createObjectStore(STORES.errorQuestions, { keyPath: 'id' })
        store.createIndex('subject', 'subject', { unique: false })
        store.createIndex('tag', 'tag', { unique: false })
        store.createIndex('ts', 'ts', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.chatHistory)) {
        db.createObjectStore(STORES.chatHistory, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.milestones)) {
        const store = db.createObjectStore(STORES.milestones, { keyPath: 'id' })
        store.createIndex('ts', 'ts', { unique: false })
      }
    }

    req.onsuccess = () => {
      dbInstance = req.result
      resolve(dbInstance)
    }
    req.onerror = () => reject(req.error)
  })
}

/** 通用：在指定 store 上执行事务 */
async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = fn(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** 写入单条数据（put = 有则更新，无则新增） */
export async function dbPut<T>(storeName: string, data: T): Promise<void> {
  await tx(storeName, 'readwrite', (store) => store.put(data as any))
}

/** 批量写入 */
export async function dbBulkPut<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    for (const item of items) {
      store.put(item as any)
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

/** 按 key 获取单条 */
export async function dbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return tx<T | undefined>(storeName, 'readonly', (store) => store.get(key))
}

/** 获取全部数据 */
export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  return tx<T[]>(storeName, 'readonly', (store) => store.getAll() as IDBRequest<T[]>)
}

/** 按 key 删除 */
export async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  await tx(storeName, 'readwrite', (store) => store.delete(key))
}

/** 清空 store */
export async function dbClear(storeName: string): Promise<void> {
  await tx(storeName, 'readwrite', (store) => store.clear())
}

/** 按索引查询 */
export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(value)
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

export { STORES }

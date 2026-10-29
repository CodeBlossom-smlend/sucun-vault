import { randomUUID } from 'node:crypto'
import { removeExpired, validateRecord } from '../shared/records'
import type { CopyField, RecordInput, RecordItem, RecordSummary } from '../shared/types'
import { createVault, openVault, openVaultWithKey, saveVault } from './vault'

export type SessionDependencies = {
  verifySystem: () => Promise<boolean>
  canQuickUnlock: () => Promise<boolean>
  readQuickKey: () => Promise<Buffer | null>
  writeQuickKey: (key: Buffer) => Promise<void>
  clearQuickKey: () => Promise<void>
}

export function createSession(file: string, dependencies: SessionDependencies) {
  let key: Buffer | null = null
  let records: RecordItem[] = []
  let pending: Promise<void> = Promise.resolve()
  let locked = true
  let generation = 0

  function requireKey(): Buffer {
    if (locked || !key) throw new Error('保险库已锁定')
    return key
  }

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work)
    pending = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  async function rememberQuickKey(unlockedKey: Buffer, unlockGeneration: number): Promise<void> {
    const copy = Buffer.from(unlockedKey)
    try {
      if ((await dependencies.canQuickUnlock()) && !locked && generation === unlockGeneration) {
        await dependencies.writeQuickKey(copy)
      }
    } catch {
      /* Master password remains available. */
    } finally {
      copy.fill(0)
    }
  }

  return {
    isUnlocked: () => !locked && key !== null,
    whenIdle: () => pending,

    async initialize(password: string) {
      const attemptGeneration = generation
      await pending
      const opened = await createVault(file, password)
      if (generation !== attemptGeneration) {
        opened.key.fill(0)
        return
      }
      key = opened.key
      records = opened.records
      locked = false
      generation++
      await rememberQuickKey(opened.key, generation)
    },

    async unlockWithPassword(password: string) {
      const attemptGeneration = generation
      await pending
      const opened = await openVault(file, password)
      if (generation !== attemptGeneration) {
        opened.key.fill(0)
        return false
      }
      key = opened.key
      records = opened.records
      locked = false
      generation++
      const unlockGeneration = generation
      await rememberQuickKey(opened.key, unlockGeneration)
      return !locked && generation === unlockGeneration
    },

    async unlockWithSystem() {
      const attemptGeneration = generation
      if (!(await dependencies.canQuickUnlock())) return false
      if (!(await dependencies.verifySystem())) return false
      if (generation !== attemptGeneration) return false
      await pending
      try {
        const quickKey = await dependencies.readQuickKey()
        if (!quickKey) return false
        const opened = await openVaultWithKey(file, quickKey)
        if (generation !== attemptGeneration) {
          quickKey.fill(0)
          return false
        }
        key = opened.key
        records = opened.records
        locked = false
        generation++
        return true
      } catch {
        await dependencies.clearQuickKey().catch(() => undefined)
        return false
      }
    },

    lock() {
      locked = true
      const keyToClear = key
      const lockGeneration = ++generation
      void pending.then(() => {
        keyToClear?.fill(0)
        if (generation === lockGeneration) {
          key = null
          records = []
        }
      })
    },

    list(): RecordSummary[] {
      requireKey()
      return records.map((record) => {
        switch (record.type) {
          case 'api':
            return {
              id: record.id,
              type: record.type,
              title: record.title,
              createdAt: record.createdAt
            }
          case 'account':
            return {
              id: record.id,
              type: record.type,
              title: record.title,
              account: record.account,
              createdAt: record.createdAt
            }
          case 'todo':
            return { ...record }
        }
      })
    },

    secret(id: string, field: CopyField): string {
      requireKey()
      const record = records.find((item) => item.id === id)
      if (!record) throw new Error('记录不存在')
      if (record.type === 'api' && field === 'key') return record.key
      if (record.type === 'account' && field === 'account') return record.account
      if (record.type === 'account' && field === 'password') return record.password
      throw new Error('此记录没有该字段')
    },

    add(input: RecordInput, now = new Date()) {
      return enqueue(async () => {
        const activeKey = requireKey()
        const valid = validateRecord(input, now)
        const item = {
          ...valid,
          id: randomUUID(),
          createdAt: now.toISOString(),
          ...(valid.type === 'todo' ? { completed: false } : {})
        } as RecordItem
        const next = [item, ...records]
        await saveVault(file, activeKey, next)
        records = next
        return item
      })
    },

    remove(id: string) {
      return enqueue(async () => {
        const activeKey = requireKey()
        const next = records.filter((item) => item.id !== id)
        if (next.length === records.length) throw new Error('记录不存在')
        await saveVault(file, activeKey, next)
        records = next
      })
    },

    setTodoCompleted(id: string, completed: boolean) {
      return enqueue(async () => {
        const activeKey = requireKey()
        const record = records.find((item) => item.id === id)
        if (!record || record.type !== 'todo') throw new Error('待办事项不存在')
        const next = records.map((item) => (item.id === id ? { ...record, completed } : item))
        await saveVault(file, activeKey, next)
        records = next
      })
    },

    purgeExpired(now = new Date()) {
      return enqueue(async () => {
        const activeKey = requireKey()
        const next = removeExpired(records, now)
        const removed = records.length - next.length
        if (removed) {
          await saveVault(file, activeKey, next)
          records = next
        }
        return removed
      })
    }
  }
}

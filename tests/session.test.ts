import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSession } from '../src/main/session'
import { createVault, openVault } from '../src/main/vault'

const dirs: string[] = []

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'sucun-session-'))
  dirs.push(dir)
  const file = join(dir, 'vault.enc')
  let quickKey: Buffer | null = null
  let verified = true
  let available = true
  let quickWrites = 0
  const session = createSession(file, {
    verifySystem: async () => verified,
    canQuickUnlock: async () => available,
    readQuickKey: async () => (quickKey ? Buffer.from(quickKey) : null),
    writeQuickKey: async (key) => {
      quickKey = Buffer.from(key)
      quickWrites++
    },
    clearQuickKey: async () => {
      quickKey = null
    }
  })
  return {
    file,
    session,
    setVerified: (value: boolean) => {
      verified = value
    },
    setAvailable: (value: boolean) => {
      available = value
    },
    quickWrites: () => quickWrites
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('vault session', () => {
  it('stays locked when system verification is canceled', async () => {
    const { session, setVerified } = await setup()
    await session.initialize('master password')
    session.lock()
    setVerified(false)
    expect(await session.unlockWithSystem()).toBe(false)
    expect(session.isUnlocked()).toBe(false)
    expect(() => session.list()).toThrow('锁定')
  })

  it('does not keep a quick key when system authentication is unavailable', async () => {
    const { session, setAvailable, quickWrites } = await setup()
    setAvailable(false)
    await session.initialize('master password')
    expect(quickWrites()).toBe(0)
    session.lock()
    expect(await session.unlockWithSystem()).toBe(false)
  })

  it('unlocks with system verification and never returns secret fields in the list', async () => {
    const { session } = await setup()
    await session.initialize('master password')
    const added = await session.add({
      type: 'account',
      title: '邮箱',
      account: 'hello@example.com',
      password: 'secret'
    })
    session.lock()
    expect(await session.unlockWithSystem()).toBe(true)
    expect(session.list()).toEqual([
      {
        id: added.id,
        type: 'account',
        title: '邮箱',
        account: 'hello@example.com',
        createdAt: added.createdAt
      }
    ])
    expect(session.secret(added.id, 'password')).toBe('secret')
    expect(() => session.secret(added.id, 'key')).toThrow()
  })

  it('persists concurrent writes without dropping records', async () => {
    const { file, session } = await setup()
    await session.initialize('master password')
    await Promise.all([
      session.add({ type: 'api', title: '服务 A', key: 'a' }),
      session.add({ type: 'api', title: '服务 B', key: 'b' })
    ])
    expect(
      (await openVault(file, 'master password')).records.map((item) => item.title).sort()
    ).toEqual(['服务 A', '服务 B'])
  })

  it('finishes an in-flight save before clearing the key on lock', async () => {
    const { file, session } = await setup()
    await session.initialize('master password')
    const saving = session.add({ type: 'api', title: '正在保存', key: 'secret' })
    await Promise.resolve()
    session.lock()
    await saving
    expect(session.isUnlocked()).toBe(false)
    expect((await openVault(file, 'master password')).records.map((item) => item.title)).toEqual([
      '正在保存'
    ])
  })

  it('does not reopen the session if the window was locked during password verification', async () => {
    const { session } = await setup()
    await session.initialize('master password')
    session.lock()
    const unlocking = session.unlockWithPassword('master password')
    session.lock()
    expect(await unlocking).toBe(false)
    expect(session.isUnlocked()).toBe(false)
  })

  it('does not reopen the session if the window was locked during system verification', async () => {
    const { session } = await setup()
    await session.initialize('master password')
    session.lock()
    const unlocking = session.unlockWithSystem()
    session.lock()
    expect(await unlocking).toBe(false)
    expect(session.isUnlocked()).toBe(false)
  })

  it('does not report success when locked while preparing quick unlock', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sucun-session-'))
    dirs.push(dir)
    const file = join(dir, 'vault.enc')
    await createVault(file, 'master password')
    let entered!: () => void
    let release!: (value: boolean) => void
    const reachedQuickUnlock = new Promise<void>((resolve) => {
      entered = resolve
    })
    const quickUnlockReady = new Promise<boolean>((resolve) => {
      release = resolve
    })
    const session = createSession(file, {
      verifySystem: async () => true,
      canQuickUnlock: async () => {
        entered()
        return quickUnlockReady
      },
      readQuickKey: async () => null,
      writeQuickKey: async () => undefined,
      clearQuickKey: async () => undefined
    })
    const unlocking = session.unlockWithPassword('master password')
    await reachedQuickUnlock
    session.lock()
    release(true)
    expect(await unlocking).toBe(false)
    expect(session.isUnlocked()).toBe(false)
  })

  it('deletes an expired todo from the encrypted file', async () => {
    const { file, session } = await setup()
    await session.initialize('master password')
    await session.add(
      { type: 'todo', title: '报告', dueDate: '2026-10-29' },
      new Date(2026, 9, 29, 12)
    )
    expect(await session.purgeExpired(new Date(2026, 9, 29, 23, 59))).toBe(0)
    expect(await session.purgeExpired(new Date(2026, 9, 30, 0))).toBe(1)
    expect((await openVault(file, 'master password')).records).toEqual([])
  })
})

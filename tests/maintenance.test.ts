import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { purgeExpiredFile } from '../src/main/maintenance'
import { createVault, openVault, saveVault } from '../src/main/vault'

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

it('removes expired todos from the encrypted file while the UI stays locked', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sucun-maintenance-'))
  dirs.push(dir)
  const file = join(dir, 'vault.enc')
  const { key } = await createVault(file, 'master password')
  await saveVault(file, key, [
    {
      id: 'old',
      type: 'todo',
      title: '昨天',
      description: '',
      dueDate: '2026-10-29',
      completed: false,
      createdAt: '2026-10-29T00:00:00.000Z'
    }
  ])
  expect(await purgeExpiredFile(file, key, new Date(2026, 9, 30, 0))).toBe(1)
  expect((await openVault(file, 'master password')).records).toEqual([])
})

import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVault, exportBackup, importBackup, openVault, saveVault } from '../src/main/vault'
import type { RecordItem } from '../src/shared/types'

const dirs: string[] = []

async function paths() {
  const dir = await mkdtemp(join(tmpdir(), 'sucun-test-'))
  dirs.push(dir)
  return {
    file: join(dir, 'vault.enc'),
    backup: join(dir, 'backup.enc'),
    restored: join(dir, 'restored.enc')
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('encrypted vault', () => {
  const record: RecordItem = {
    id: 'one',
    type: 'account',
    title: '工作邮箱',
    account: 'hello@example.com',
    password: 'a-secret-value',
    createdAt: '2026-10-29T00:00:00.000Z'
  }

  it('persists records encrypted and opens with the master password', async () => {
    const { file } = await paths()
    const { key } = await createVault(file, 'correct horse battery staple')
    await saveVault(file, key, [record])
    const raw = await readFile(file, 'utf8')
    expect(raw).not.toContain(record.password)
    expect(raw).not.toContain(record.account)
    const reopened = await openVault(file, 'correct horse battery staple')
    expect(reopened.records).toEqual([record])
    expect(reopened.key.equals(key)).toBe(true)
  })

  it('rejects a wrong master password', async () => {
    const { file } = await paths()
    await createVault(file, 'right password')
    await expect(openVault(file, 'wrong password')).rejects.toThrow(/密码|损坏/)
  })

  it('rejects modified ciphertext without returning records', async () => {
    const { file } = await paths()
    await createVault(file, 'right password')
    const envelope = JSON.parse(await readFile(file, 'utf8'))
    envelope.ciphertext = Buffer.from('modified').toString('base64')
    await writeFile(file, JSON.stringify(envelope))
    await expect(openVault(file, 'right password')).rejects.toThrow(/密码|损坏/)
  })

  it('restores a backup on another path with the master password', async () => {
    const { file, backup, restored } = await paths()
    const { key } = await createVault(file, 'recovery password')
    await saveVault(file, key, [record])
    await exportBackup(file, backup)
    await importBackup(backup, 'recovery password', restored)
    expect((await openVault(restored, 'recovery password')).records).toEqual([record])
  })

  it('does not replace the current vault with an invalid backup', async () => {
    const { file, backup } = await paths()
    const { key } = await createVault(file, 'current password')
    await saveVault(file, key, [record])
    const before = await readFile(file)
    await writeFile(backup, 'not a vault')
    await expect(importBackup(backup, 'current password', file)).rejects.toThrow()
    expect(await readFile(file)).toEqual(before)
  })
})

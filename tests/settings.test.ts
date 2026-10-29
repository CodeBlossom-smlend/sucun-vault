import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadSettings, saveSettings, validateSettings } from '../src/main/settings'

const dirs: string[] = []
async function file() {
  const dir = await mkdtemp(join(tmpdir(), 'sucun-settings-'))
  dirs.push(dir)
  return join(dir, 'settings.json')
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

it('uses defaults for missing or damaged settings and saves valid changes', async () => {
  const path = await file()
  expect(await loadSettings(path)).toEqual({
    shortcut: 'CommandOrControl+Shift+P',
    launchAtLogin: false
  })
  await writeFile(path, '{broken')
  expect(await loadSettings(path)).toEqual({
    shortcut: 'CommandOrControl+Shift+P',
    launchAtLogin: false
  })
  await saveSettings(path, { shortcut: 'CommandOrControl+Alt+P', launchAtLogin: true })
  expect(await loadSettings(path)).toEqual({
    shortcut: 'CommandOrControl+Alt+P',
    launchAtLogin: true
  })
})

it('rejects an invalid startup value before applying settings', () => {
  expect(() =>
    validateSettings({ shortcut: 'CommandOrControl+P', launchAtLogin: 'yes' as unknown as boolean })
  ).toThrow('开机启动')
})

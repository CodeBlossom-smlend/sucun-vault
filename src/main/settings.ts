import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppSettings } from '../shared/types'
import { validateShortcut } from './shortcut'

export const DEFAULT_SETTINGS: AppSettings = {
  shortcut: 'CommandOrControl+Shift+P',
  launchAtLogin: false
}

export function validateSettings(settings: AppSettings): void {
  if (!settings || typeof settings !== 'object') throw new Error('设置格式无效')
  validateShortcut(settings.shortcut)
  if (typeof settings.launchAtLogin !== 'boolean') throw new Error('开机启动设置无效')
}

export async function loadSettings(path: string): Promise<AppSettings> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS }
    const value = parsed as Partial<AppSettings>
    validateShortcut(value.shortcut || '')
    if (typeof value.launchAtLogin !== 'boolean') return { ...DEFAULT_SETTINGS }
    return { shortcut: value.shortcut!, launchAtLogin: value.launchAtLogin }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(path: string, settings: AppSettings): Promise<void> {
  validateSettings(settings)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(settings), { mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

import { app, safeStorage, systemPreferences, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isWindowsHelloAvailable, verifyWindowsHello } from './windowsHello'
import type { SessionDependencies } from './session'

export function createSystemAuth(
  quickKeyFile: string,
  getWindow: () => BrowserWindow | null
): SessionDependencies & { available: () => Promise<boolean> } {
  async function available() {
    if (process.platform === 'darwin') return systemPreferences.canPromptTouchID()
    if (process.platform === 'win32') return isWindowsHelloAvailable()
    return false
  }
  return {
    available,
    canQuickUnlock: available,
    async verifySystem() {
      if (process.platform === 'darwin') {
        if (!systemPreferences.canPromptTouchID()) return false
        try {
          await systemPreferences.promptTouchID('解锁速存')
          return true
        } catch {
          return false
        }
      }
      if (process.platform === 'win32') {
        const window = getWindow()
        return window ? verifyWindowsHello(window) : false
      }
      return false
    },
    async readQuickKey() {
      try {
        if (!(await safeStorage.isAsyncEncryptionAvailable())) return null
        const encrypted = await readFile(quickKeyFile)
        const { result } = await safeStorage.decryptStringAsync(encrypted)
        const key = Buffer.from(result, 'base64')
        return key.length === 32 ? key : null
      } catch {
        return null
      }
    },
    async writeQuickKey(key) {
      if (!(await available())) throw new Error('系统身份验证不可用')
      if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('系统加密不可用')
      const encrypted = await safeStorage.encryptStringAsync(key.toString('base64'))
      await mkdir(dirname(quickKeyFile), { recursive: true })
      const temporary = `${quickKeyFile}.${randomUUID()}.tmp`
      try {
        await writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' })
        await rename(temporary, quickKeyFile)
      } finally {
        await rm(temporary, { force: true })
      }
    },
    async clearQuickKey() {
      await rm(quickKeyFile, { force: true })
    }
  }
}

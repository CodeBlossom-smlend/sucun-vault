import { app, clipboard, dialog, ipcMain, powerMonitor } from 'electron'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppSettings, CopyField, RecordInput } from '../shared/types'
import { copyWithAutoClear } from './clipboard'
import { createDesktop } from './desktop'
import { purgeExpiredFile } from './maintenance'
import { createSession } from './session'
import { loadSettings, saveSettings, validateSettings } from './settings'
import { createSystemAuth } from './systemAuth'
import { exportBackup, importBackup } from './vault'

app.setName('速存')
if (!app.requestSingleInstanceLock()) app.quit()

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

app
  .whenReady()
  .then(async () => {
    const userData = app.getPath('userData')
    const vaultFile = join(userData, 'vault.enc')
    const quickKeyFile = join(userData, 'quick-key.bin')
    const settingsFile = join(userData, 'settings.json')
    let settings = await loadSettings(settingsFile)
    let session: ReturnType<typeof createSession>
    let systemAuth: ReturnType<typeof createSystemAuth>

    async function purgeExpired() {
      if (!(await exists(vaultFile))) return
      if (session.isUnlocked()) {
        await session.purgeExpired()
        return
      }
      await session.whenIdle()
      const quickKey = await systemAuth.readQuickKey()
      if (!quickKey) return
      try {
        await purgeExpiredFile(vaultFile, quickKey)
      } finally {
        quickKey.fill(0)
      }
    }

    const desktop = createDesktop({
      shortcut: settings.shortcut,
      onHide: () => {
        session?.lock()
        desktop.window.webContents.send('vault:changed')
      },
      onShow: () => {
        void purgeExpired()
          .catch(() => undefined)
          .finally(() => desktop.window.webContents.send('vault:changed'))
      }
    })
    systemAuth = createSystemAuth(quickKeyFile, () => desktop.window)
    session = createSession(vaultFile, systemAuth)

    function notify() {
      desktop.window.webContents.send('vault:changed')
    }
    function handle(channel: string, work: (...args: any[]) => unknown) {
      ipcMain.handle(channel, (event, ...args) => {
        if (event.sender !== desktop.window.webContents) throw new Error('未授权的窗口')
        return work(...args)
      })
    }

    handle('vault:status', async () => ({
      initialized: await exists(vaultFile),
      unlocked: session.isUnlocked(),
      systemUnlockAvailable: (await exists(quickKeyFile)) && (await systemAuth.available()),
      platform: process.platform === 'darwin' ? 'darwin' : 'win32'
    }))

    handle('vault:initialize', async (password: string) => {
      if (typeof password !== 'string' || password.length < 12)
        throw new Error('主密码至少需要 12 个字符')
      await session.initialize(password)
      notify()
    })

    handle('vault:unlock-password', async (password: string) => {
      const result = await session.unlockWithPassword(password)
      if (result) await session.purgeExpired()
      notify()
      return result
    })

    handle('vault:unlock-system', async () => {
      desktop.setIgnoreBlur(true)
      try {
        const unlocked = await session.unlockWithSystem()
        if (unlocked) await session.purgeExpired()
        notify()
        return unlocked
      } finally {
        desktop.setIgnoreBlur(false)
      }
    })

    handle('vault:lock', () => {
      session.lock()
      notify()
    })
    handle('vault:list', async () => {
      await session.purgeExpired()
      return session.list()
    })
    handle('vault:add', async (input: RecordInput) => {
      await session.add(input)
      notify()
    })
    handle('vault:remove', async (id: string) => {
      await session.remove(id)
      notify()
    })
    handle('vault:complete', async (id: string, completed: boolean) => {
      if (typeof completed !== 'boolean') throw new Error('完成状态无效')
      await session.setTodoCompleted(id, completed)
      notify()
    })
    handle('vault:copy', async (id: string, field: CopyField) => {
      await copyWithAutoClear(session.secret(id, field), clipboard)
    })

    handle('vault:settings', () => settings)
    handle('vault:update-settings', async (updated: AppSettings) => {
      validateSettings(updated)
      if (updated.shortcut !== settings.shortcut) desktop.changeShortcut(updated.shortcut)
      try {
        app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin })
        await saveSettings(settingsFile, updated)
        settings = updated
        return settings
      } catch (error) {
        if (updated.shortcut !== settings.shortcut) desktop.changeShortcut(settings.shortcut)
        throw error
      }
    })

    handle('vault:export', async () => {
      if (!session.isUnlocked()) throw new Error('请先解锁')
      desktop.setIgnoreBlur(true)
      try {
        const choice = await dialog.showSaveDialog(desktop.window, {
          title: '导出加密备份',
          defaultPath: '速存备份.sucun',
          filters: [{ name: '速存加密备份', extensions: ['sucun'] }]
        })
        if (choice.canceled || !choice.filePath) return false
        await exportBackup(vaultFile, choice.filePath)
        return true
      } finally {
        desktop.setIgnoreBlur(false)
      }
    })

    handle('vault:import', async (password: string) => {
      if (typeof password !== 'string' || !password) throw new Error('请输入备份的主密码')
      desktop.setIgnoreBlur(true)
      try {
        const choice = await dialog.showOpenDialog(desktop.window, {
          title: '导入加密备份',
          properties: ['openFile'],
          filters: [{ name: '速存加密备份', extensions: ['sucun'] }]
        })
        if (choice.canceled || !choice.filePaths[0]) return false
        await importBackup(choice.filePaths[0], password, vaultFile)
        session.lock()
        await systemAuth.clearQuickKey()
        await session.unlockWithPassword(password)
        await session.purgeExpired()
        notify()
        return true
      } finally {
        desktop.setIgnoreBlur(false)
      }
    })

    powerMonitor.on('lock-screen', () => desktop.hide())
    powerMonitor.on('resume', () => {
      void purgeExpired()
        .then(notify)
        .catch(() => undefined)
    })

    function scheduleNextMidnight() {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      setTimeout(
        () => {
          void purgeExpired()
            .then(notify)
            .catch(() => undefined)
            .finally(scheduleNextMidnight)
        },
        next.getTime() - now.getTime() + 100
      )
    }
    scheduleNextMidnight()
    void purgeExpired().catch(() => undefined)

    app.on('second-instance', () => desktop.show())
  })
  .catch((error) => {
    dialog.showErrorBox('速存启动失败', error instanceof Error ? error.message : '未知错误')
    app.quit()
  })

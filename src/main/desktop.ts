import { app, BrowserWindow, globalShortcut, Menu, nativeImage, screen, Tray } from 'electron'
import { join } from 'node:path'
import { createShortcutController } from './shortcut'

type DesktopOptions = {
  shortcut: string
  onHide: () => void
  onShow: () => void
}

export function createDesktop(options: DesktopOptions) {
  const window = new BrowserWindow({
    width: 490,
    height: 690,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(app.getAppPath(), 'dist/index.html'))

  let ignoreBlur = false
  let quitting = false

  function hide() {
    if (!window.isVisible()) return
    window.hide()
    options.onHide()
  }

  function show() {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { x, y, width, height } = display.workArea
    window.setPosition(Math.round(x + (width - 490) / 2), Math.round(y + (height - 690) / 2))
    window.show()
    window.focus()
    options.onShow()
  }

  window.on('blur', () => {
    if (!ignoreBlur) hide()
  })
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    hide()
  })

  const iconPath = join(
    app.getAppPath(),
    'assets',
    process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  )
  const icon = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip('速存')
  tray.on('click', () => (window.isVisible() ? hide() : show()))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开速存', click: show },
      {
        label: '锁定',
        click: () => {
          hide()
          options.onHide()
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )

  const controller = createShortcutController(
    {
      register: (shortcut) =>
        globalShortcut.register(shortcut, () => (window.isVisible() ? hide() : show())),
      unregister: (shortcut) => globalShortcut.unregister(shortcut)
    },
    options.shortcut
  )
  const shortcutRegistered = globalShortcut.register(options.shortcut, () =>
    window.isVisible() ? hide() : show()
  )

  app.on('before-quit', () => {
    quitting = true
    globalShortcut.unregisterAll()
  })
  if (process.platform === 'darwin') app.dock?.hide()

  return {
    window,
    tray,
    show,
    hide,
    shortcutRegistered,
    changeShortcut: controller.change,
    setIgnoreBlur(value: boolean) {
      ignoreBlur = value
    }
  }
}

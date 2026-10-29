import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, Download, LockKeyhole, Upload } from 'lucide-react'
import type { AppSettings } from '../../shared/types'

type Props = {
  platform: 'darwin' | 'win32'
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onBack: () => void
  onExport: () => void
  onImport: (password: string) => void
  onLock: () => void
  busy?: boolean
}

export function SettingsScreen({
  platform,
  settings,
  onSave,
  onBack,
  onExport,
  onImport,
  onLock,
  busy = false
}: Props) {
  const [shortcut, setShortcut] = useState(settings.shortcut)
  const [launchAtLogin, setLaunchAtLogin] = useState(settings.launchAtLogin)
  const [backupPassword, setBackupPassword] = useState('')

  function captureShortcut(event: KeyboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const primary = platform === 'darwin' ? event.metaKey : event.ctrlKey
    if (!primary) return
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
    if (!/^(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4]))$/.test(key)) return
    const modifiers = ['CommandOrControl']
    if (event.shiftKey) modifiers.push('Shift')
    if (event.altKey) modifiers.push('Alt')
    setShortcut([...modifiers, key].join('+'))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave({ shortcut, launchAtLogin })
  }

  return (
    <section className="settings-screen">
      <div className="subview-heading">
        <button className="icon-button" type="button" aria-label="返回列表" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2>设置</h2>
        <span className="heading-spacer" />
      </div>
      <div className="settings-scroll">
        <form onSubmit={submit} className="settings-section">
          <h3>打开方式</h3>
          <label className="field-label">
            唤起快捷键
            <input
              value={shortcut}
              onKeyDown={captureShortcut}
              readOnly
              aria-describedby="shortcut-tip"
            />
          </label>
          <p className="form-hint" id="shortcut-tip">
            点击输入框，然后按下新的组合键。
            {platform === 'darwin' ? '请包含 Command。' : '请包含 Ctrl。'}
          </p>
          <label className="switch-row">
            <span>开机自动启动</span>
            <input
              type="checkbox"
              checked={launchAtLogin}
              onChange={(event) => setLaunchAtLogin(event.target.checked)}
            />
          </label>
          <button className="primary-button settings-save" type="submit" disabled={busy}>
            保存设置
          </button>
        </form>

        <div className="settings-section">
          <h3>加密备份</h3>
          <p className="form-hint">备份文件仍由主密码加密，可以在另一台电脑恢复。</p>
          <button className="settings-row-button" type="button" onClick={onExport} disabled={busy}>
            <Download size={18} /> 导出加密备份
          </button>
          <label className="field-label backup-password">
            备份的主密码
            <input
              type="password"
              value={backupPassword}
              onChange={(event) => setBackupPassword(event.target.value)}
              autoComplete="off"
              placeholder="导入时输入"
            />
          </label>
          <button
            className="settings-row-button"
            type="button"
            onClick={() => onImport(backupPassword)}
            disabled={busy || !backupPassword}
          >
            <Upload size={18} /> 导入备份
          </button>
        </div>

        <div className="settings-section last">
          <button className="settings-row-button" type="button" onClick={onLock}>
            <LockKeyhole size={18} /> 立即锁定
          </button>
        </div>
      </div>
    </section>
  )
}

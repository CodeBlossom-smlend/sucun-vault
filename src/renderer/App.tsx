import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react'
import type {
  RecordInput,
  RecordSummary,
  VaultStatus,
  AppSettings,
  CopyField
} from '../shared/types'
import { RecordCard } from './components/RecordCard'
import { SaveForm } from './components/SaveForm'
import { SettingsScreen } from './components/SettingsScreen'

type View = 'list' | 'new' | 'settings'

function message(error: unknown): string {
  if (!(error instanceof Error)) return '操作失败，请重试'
  const value = error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  return value || '操作失败，请重试'
}

function LockScreen({
  status,
  onInitialize,
  onPassword,
  onSystem,
  busy
}: {
  status: VaultStatus
  onInitialize: (password: string) => void
  onPassword: (password: string) => void
  onSystem: () => void
  busy: boolean
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(!status.systemUnlockAvailable)
  const [localError, setLocalError] = useState('')
  const isSetup = !status.initialized

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')
    if (isSetup) {
      if (password.length < 12) {
        setLocalError('主密码至少需要 12 个字符')
        return
      }
      if (password !== confirm) {
        setLocalError('两次输入的主密码不一致')
        return
      }
      onInitialize(password)
    } else onPassword(password)
  }

  return (
    <section className="lock-screen">
      <div className="brand lock-brand">
        <span className="brand-icon">
          <LockKeyhole size={21} />
        </span>
        <span>速存</span>
      </div>
      <div className="lock-center">
        <div className="fingerprint-ring">
          {isSetup ? (
            <ShieldCheck size={64} strokeWidth={1.7} />
          ) : (
            <Fingerprint size={74} strokeWidth={1.6} />
          )}
        </div>
        <h1>{isSetup ? '设置主密码' : '解锁速存'}</h1>
        <p>
          {isSetup
            ? '主密码用于加密本地数据，并在换电脑后恢复备份。'
            : '验证身份后查看已保存的内容'}
        </p>
        {!isSetup && status.systemUnlockAvailable && (
          <button
            className="primary-button unlock-button"
            type="button"
            onClick={onSystem}
            disabled={busy}
          >
            <Fingerprint size={20} />{' '}
            {status.platform === 'darwin' ? '使用 Touch ID 解锁' : '使用 Windows Hello 解锁'}
          </button>
        )}
        {!isSetup && status.systemUnlockAvailable && !showPassword && (
          <button className="text-button" type="button" onClick={() => setShowPassword(true)}>
            使用主密码
          </button>
        )}
        {(isSetup || showPassword) && (
          <form className="unlock-form" onSubmit={submit} autoComplete="off">
            <label className="field-label">
              主密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSetup ? 'new-password' : 'off'}
                autoFocus
                placeholder="输入主密码"
                required
              />
            </label>
            {isSetup && (
              <label className="field-label">
                确认主密码
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  placeholder="再次输入主密码"
                  required
                />
              </label>
            )}
            {localError && <p className="inline-error">{localError}</p>}
            <button className="primary-button unlock-button" type="submit" disabled={busy}>
              {isSetup ? '创建保险库' : '使用主密码解锁'}
            </button>
          </form>
        )}
        {!isSetup && status.systemUnlockAvailable && showPassword && (
          <button className="text-button" type="button" onClick={() => setShowPassword(false)}>
            返回系统验证
          </button>
        )}
        <p className="lock-note">
          {status.platform === 'darwin' ? '支持 Mac Touch ID' : '支持 Windows Hello'} · 仅本机保存
        </p>
      </div>
      <div className="lock-footer">快捷键可在设置中修改</div>
    </section>
  )
}

export function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [view, setView] = useState<View>('list')
  const [query, setQuery] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    const nextStatus = await window.vault.status()
    setStatus(nextStatus)
    if (nextStatus.unlocked) setRecords(await window.vault.list())
    else {
      setRecords([])
      setView('list')
    }
  }, [])

  useEffect(() => {
    void refresh().catch((error) => setError(message(error)))
    return window.vault.onStateChanged(() => {
      void refresh().catch((error) => setError(message(error)))
    })
  }, [refresh])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return records
    return records.filter((record) => {
      const values = [record.title]
      if (record.type === 'account') values.push(record.account)
      if (record.type === 'todo') values.push(record.description)
      return values.some((value) => value.toLocaleLowerCase().includes(needle))
    })
  }, [records, query])

  async function act(work: () => Promise<unknown>, success?: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
      await refresh()
      if (success) setNotice(success)
      return true
    } catch (caught) {
      setError(message(caught))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function openSettings() {
    setError('')
    try {
      setSettings(await window.vault.getSettings())
      setView('settings')
    } catch (caught) {
      setError(message(caught))
    }
  }

  function save(input: RecordInput) {
    void act(() => window.vault.add(input), '已保存').then((ok) => {
      if (ok) setView('list')
    })
  }

  function remove(id: string) {
    if (!window.confirm('确定删除这条记录吗？')) return
    void act(() => window.vault.remove(id), '已删除')
  }

  function copy(id: string, field: CopyField) {
    void act(() => window.vault.copy(id, field), '已复制，30 秒后自动清空剪贴板')
  }

  if (!status)
    return (
      <main className="app-window loading">
        <span className="brand-icon">
          <LockKeyhole size={22} />
        </span>
        <p>正在打开速存…</p>
      </main>
    )

  return (
    <main className="app-window">
      {!status.unlocked ? (
        <LockScreen
          status={status}
          busy={busy}
          onInitialize={(password) => {
            void act(() => window.vault.initialize(password))
          }}
          onPassword={(password) => {
            void act(async () => {
              if (!(await window.vault.unlockWithPassword(password))) throw new Error('解锁已取消')
            })
          }}
          onSystem={() => {
            void act(async () => {
              if (!(await window.vault.unlockWithSystem()))
                throw new Error('系统验证未完成，请使用主密码')
            })
          }}
        />
      ) : view === 'new' ? (
        <SaveForm onSave={save} onCancel={() => setView('list')} busy={busy} />
      ) : view === 'settings' && settings ? (
        <SettingsScreen
          platform={status.platform}
          settings={settings}
          busy={busy}
          onBack={() => setView('list')}
          onSave={(updated) => {
            void act(async () => {
              setSettings(await window.vault.updateSettings(updated))
            }, '设置已保存')
          }}
          onExport={() => {
            void act(() => window.vault.exportBackup(), '加密备份已导出')
          }}
          onImport={(password) => {
            void act(() => window.vault.importBackup(password), '备份已导入')
          }}
          onLock={() => {
            void act(() => window.vault.lock())
          }}
        />
      ) : (
        <>
          <header className="topbar">
            <div className="brand">
              <span className="brand-icon">
                <LockKeyhole size={19} />
              </span>
              <span>速存</span>
            </div>
            <div className="topbar-actions">
              <button
                className="icon-button"
                aria-label="打开设置"
                type="button"
                onClick={() => void openSettings()}
              >
                <Settings size={19} />
              </button>
              <button
                className="primary-button add-button"
                aria-label="保存新内容"
                type="button"
                onClick={() => setView('new')}
              >
                <Plus size={18} /> 保存
              </button>
            </div>
          </header>
          <div className="search-wrap">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、账号或待办内容"
              aria-label="搜索记录"
            />
            {query && (
              <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="record-scroll" data-testid="record-scroll-region">
            {filtered.length ? (
              filtered.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onCopy={copy}
                  onRemove={remove}
                  onToggleTodo={(id, completed) => {
                    void act(() => window.vault.setTodoCompleted(id, completed))
                  }}
                />
              ))
            ) : (
              <div className="empty-state">
                <KeyRound size={34} />
                <h3>{query ? '没有找到记录' : '还没有保存内容'}</h3>
                <p>{query ? '换个关键词试试' : '点击右上角“保存”添加第一条记录'}</p>
              </div>
            )}
          </div>
          <footer className="main-footer">
            {status.platform === 'darwin' ? '⌘' : 'Ctrl'} 快捷打开 · 仅本机保存
          </footer>
        </>
      )}
      {error && (
        <div className="toast error" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="关闭错误" onClick={() => setError('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast success" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  )
}

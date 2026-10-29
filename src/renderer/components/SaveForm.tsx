import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'
import type { RecordInput } from '../../shared/types'

type Kind = RecordInput['type']
type Props = {
  onSave: (input: RecordInput) => void
  onCancel: () => void
  busy?: boolean
}

function todayLocal() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function SaveForm({ onSave, onCancel, busy = false }: Props) {
  const [kind, setKind] = useState<Kind>('api')
  const [title, setTitle] = useState('')
  const [key, setKey] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(todayLocal())
  const [revealed, setRevealed] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (kind === 'api') onSave({ type: 'api', title, key })
    else if (kind === 'account') onSave({ type: 'account', title, account, password })
    else onSave({ type: 'todo', title, description, dueDate })
  }

  return (
    <section className="form-screen">
      <div className="subview-heading">
        <button className="icon-button" type="button" aria-label="取消新增" onClick={onCancel}>
          <X size={20} />
        </button>
        <h2>保存新内容</h2>
        <span className="heading-spacer" />
      </div>
      <div className="segmented" role="group" aria-label="数据类型">
        {(
          [
            ['api', 'API 密钥'],
            ['account', '账号密码'],
            ['todo', '待办事项']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            className={kind === value ? 'active' : ''}
            onClick={() => {
              setKind(value)
              setRevealed(false)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <form className="save-form" onSubmit={submit} autoComplete="off">
        <label className="field-label">
          标题
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={kind === 'todo' ? '例如：提交项目周报' : '例如：工作邮箱'}
            required
            autoFocus
          />
        </label>
        {kind === 'api' && (
          <label className="field-label">
            密钥
            <span className="input-with-action">
              <input
                type={revealed ? 'text' : 'password'}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                autoComplete="off"
                placeholder="粘贴 API 密钥"
                required
              />
              <button
                type="button"
                aria-label={revealed ? '隐藏密钥' : '显示密钥'}
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        )}
        {kind === 'account' && (
          <>
            <label className="field-label">
              账号
              <input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="邮箱或用户名"
                required
              />
            </label>
            <label className="field-label">
              密码
              <span className="input-with-action">
                <input
                  type={revealed ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                  placeholder="输入密码"
                  required
                />
                <button
                  type="button"
                  aria-label={revealed ? '隐藏密码' : '显示密码'}
                  onClick={() => setRevealed((value) => !value)}
                >
                  {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          </>
        )}
        {kind === 'todo' && (
          <>
            <label className="field-label">
              说明（可选）
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="补充说明"
                rows={3}
              />
            </label>
            <label className="field-label">
              到期日期
              <input
                type="date"
                value={dueDate}
                min={todayLocal()}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </label>
            <p className="form-hint">所选日期结束后，这条待办会自动删除。</p>
          </>
        )}
        <div className="form-actions">
          <button className="primary-button" type="submit" aria-label="确认保存" disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            取消
          </button>
        </div>
      </form>
    </section>
  )
}

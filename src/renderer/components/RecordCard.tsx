import { useState } from 'react'
import { Check, Clipboard, MoreHorizontal, Trash2 } from 'lucide-react'
import type { CopyField, RecordSummary } from '../../shared/types'

type Props = {
  record: RecordSummary
  onCopy: (id: string, field: CopyField) => void
  onRemove: (id: string) => void
  onToggleTodo: (id: string, completed: boolean) => void
}

export function RecordCard({ record, onCopy, onRemove, onToggleTodo }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const badge =
    record.type === 'api' ? 'API 密钥' : record.type === 'account' ? '账号密码' : '待办事项'

  return (
    <article className="record-card">
      <div className="record-heading">
        <div className="record-heading-text">
          <h3>{record.title}</h3>
          <span className="type-badge">{badge}</span>
        </div>
        <div className="record-menu-wrap">
          <button
            className="icon-button quiet"
            type="button"
            aria-label={`更多操作：${record.title}`}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="record-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onRemove(record.id)
                }}
              >
                <Trash2 size={15} /> 删除记录
              </button>
            </div>
          )}
        </div>
      </div>

      {record.type === 'api' && (
        <div className="record-body single">
          <span className="secret-placeholder">••••••••••••</span>
          <button
            className="copy-button"
            type="button"
            aria-label="复制密钥"
            onClick={() => onCopy(record.id, 'key')}
          >
            <Clipboard size={14} /> 复制
          </button>
        </div>
      )}

      {record.type === 'account' && (
        <div className="record-body stacked">
          <div className="record-value-row">
            <span className="value-label">账号</span>
            <span className="value-text" title={record.account}>
              {record.account}
            </span>
            <button
              className="copy-button"
              type="button"
              aria-label="复制账号"
              onClick={() => onCopy(record.id, 'account')}
            >
              <Clipboard size={14} /> 复制
            </button>
          </div>
          <div className="record-value-row">
            <span className="value-label">密码</span>
            <span className="value-text secret-placeholder">••••••••••••</span>
            <button
              className="copy-button"
              type="button"
              aria-label="复制密码"
              onClick={() => onCopy(record.id, 'password')}
            >
              <Clipboard size={14} /> 复制
            </button>
          </div>
        </div>
      )}

      {record.type === 'todo' && (
        <div className="todo-body">
          <label className="todo-check">
            <input
              type="checkbox"
              checked={record.completed}
              onChange={(event) => onToggleTodo(record.id, event.target.checked)}
            />
            <span className="todo-box">{record.completed && <Check size={14} />}</span>
            <span className={record.completed ? 'todo-text done' : 'todo-text'}>
              {record.description || record.title}
            </span>
          </label>
          <time dateTime={record.dueDate}>{record.dueDate.replaceAll('-', '/')}</time>
        </div>
      )}
    </article>
  )
}

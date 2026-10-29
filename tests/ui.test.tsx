// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecordCard } from '../src/renderer/components/RecordCard'
import { SaveForm } from '../src/renderer/components/SaveForm'
import type { RecordSummary } from '../src/shared/types'

afterEach(cleanup)

describe('record cards', () => {
  const account: RecordSummary = {
    id: 'mail',
    type: 'account',
    title: '工作邮箱',
    account: 'hello@example.com',
    createdAt: '2026-10-29T00:00:00.000Z'
  }

  it('provides separate copy actions for account and password', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(
      <RecordCard record={account} onCopy={onCopy} onRemove={vi.fn()} onToggleTodo={vi.fn()} />
    )
    await user.click(screen.getByRole('button', { name: '复制账号' }))
    await user.click(screen.getByRole('button', { name: '复制密码' }))
    expect(onCopy.mock.calls).toEqual([
      ['mail', 'account'],
      ['mail', 'password']
    ])
    expect(screen.getByText('••••••••••••')).toBeTruthy()
  })

  it('provides one key copy action without showing the real key', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(
      <RecordCard
        record={{ id: 'api', type: 'api', title: '工作密钥', createdAt: account.createdAt }}
        onCopy={onCopy}
        onRemove={vi.fn()}
        onToggleTodo={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: '复制密钥' }))
    expect(onCopy).toHaveBeenCalledWith('api', 'key')
  })
})

describe('save form', () => {
  it('shows the required account fields and submits their values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<SaveForm onSave={onSave} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '账号密码' }))
    await user.type(screen.getByLabelText('标题'), '工作邮箱')
    await user.type(screen.getByLabelText('账号'), 'hello@example.com')
    await user.type(screen.getByLabelText('密码'), 'secret')
    await user.click(screen.getByRole('button', { name: '确认保存' }))
    expect(onSave).toHaveBeenCalledWith({
      type: 'account',
      title: '工作邮箱',
      account: 'hello@example.com',
      password: 'secret'
    })
  })

  it('shows a due date for todos', async () => {
    const user = userEvent.setup()
    render(<SaveForm onSave={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '待办事项' }))
    expect(screen.getByLabelText('到期日期')).toBeTruthy()
  })
})

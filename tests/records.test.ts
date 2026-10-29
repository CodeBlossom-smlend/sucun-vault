import { describe, expect, it } from 'vitest'
import { removeExpired, searchRecords, validateRecord } from '../src/shared/records'
import type { RecordItem } from '../src/shared/types'

describe('record validation', () => {
  it('requires a title and an API key', () => {
    expect(() => validateRecord({ type: 'api', title: ' ', key: 'abc' })).toThrow('标题')
    expect(() => validateRecord({ type: 'api', title: '服务', key: ' ' })).toThrow('密钥')
    expect(validateRecord({ type: 'api', title: ' 服务 ', key: ' abc ' })).toEqual({
      type: 'api',
      title: '服务',
      key: ' abc '
    })
  })

  it('requires both account and password for an account record', () => {
    expect(() =>
      validateRecord({ type: 'account', title: '邮箱', account: '', password: 'pw' })
    ).toThrow('账号')
    expect(() =>
      validateRecord({ type: 'account', title: '邮箱', account: 'a@b', password: '' })
    ).toThrow('密码')
  })

  it('rejects invalid or past due dates', () => {
    const today = new Date(2026, 9, 29, 12)
    expect(() =>
      validateRecord({ type: 'todo', title: '报告', dueDate: '2026-02-30' }, today)
    ).toThrow('日期')
    expect(() =>
      validateRecord({ type: 'todo', title: '报告', dueDate: '2026-10-28' }, today)
    ).toThrow('日期')
    expect(
      validateRecord(
        { type: 'todo', title: ' 报告 ', description: ' 可选 ', dueDate: '2026-10-29' },
        today
      )
    ).toEqual({
      type: 'todo',
      title: '报告',
      description: '可选',
      dueDate: '2026-10-29'
    })
  })
})

describe('record queries', () => {
  const records: RecordItem[] = [
    {
      id: 'a',
      type: 'api',
      title: '工作密钥',
      key: 'secret-needle',
      createdAt: '2026-10-29T00:00:00.000Z'
    },
    {
      id: 'b',
      type: 'account',
      title: '工作邮箱',
      account: 'hello@example.com',
      password: 'hidden-needle',
      createdAt: '2026-10-29T00:00:00.000Z'
    },
    {
      id: 'c',
      type: 'todo',
      title: '提交周报',
      description: '今天完成',
      dueDate: '2026-10-29',
      completed: false,
      createdAt: '2026-10-29T00:00:00.000Z'
    }
  ]

  it('searches title, account and todo description without matching secrets', () => {
    expect(searchRecords(records, '邮箱').map((item) => item.id)).toEqual(['b'])
    expect(searchRecords(records, 'hello@').map((item) => item.id)).toEqual(['b'])
    expect(searchRecords(records, '今天').map((item) => item.id)).toEqual(['c'])
    expect(searchRecords(records, 'needle')).toEqual([])
  })

  it('keeps a todo through its due date and removes it at the next local midnight', () => {
    expect(removeExpired(records, new Date(2026, 9, 29, 23, 59)).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c'
    ])
    expect(removeExpired(records, new Date(2026, 9, 30, 0, 0)).map((item) => item.id)).toEqual([
      'a',
      'b'
    ])
  })
})

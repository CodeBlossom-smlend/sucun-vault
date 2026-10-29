import type { RecordInput, RecordItem } from './types'

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`请输入${label}`)
  return value
}

export function parseLocalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请选择有效日期')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('请选择有效日期')
  }
  return date
}

export function validateRecord(input: RecordInput, now = new Date()): RecordInput {
  if (!input || typeof input !== 'object') throw new Error('记录格式无效')
  const title = nonEmpty(input.title, '标题').trim()
  switch (input.type) {
    case 'api':
      return { type: 'api', title, key: nonEmpty(input.key, '密钥') }
    case 'account':
      return {
        type: 'account',
        title,
        account: nonEmpty(input.account, '账号').trim(),
        password: nonEmpty(input.password, '密码')
      }
    case 'todo': {
      const due = parseLocalDate(input.dueDate)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      if (due < today) throw new Error('日期不能早于今天')
      return {
        type: 'todo',
        title,
        description: (input.description || '').trim(),
        dueDate: input.dueDate
      }
    }
    default:
      throw new Error('不支持的数据类型')
  }
}

export function removeExpired(records: RecordItem[], now = new Date()): RecordItem[] {
  return records.filter((record) => {
    if (record.type !== 'todo') return true
    const due = parseLocalDate(record.dueDate)
    const nextMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
    return now < nextMidnight
  })
}

export function searchRecords(records: RecordItem[], query: string): RecordItem[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return records
  return records.filter((record) => {
    const fields = [record.title]
    if (record.type === 'account') fields.push(record.account)
    if (record.type === 'todo') fields.push(record.description)
    return fields.some((value) => value.toLocaleLowerCase().includes(needle))
  })
}

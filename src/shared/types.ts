export type ApiRecord = {
  id: string
  type: 'api'
  title: string
  key: string
  createdAt: string
}

export type AccountRecord = {
  id: string
  type: 'account'
  title: string
  account: string
  password: string
  createdAt: string
}

export type TodoRecord = {
  id: string
  type: 'todo'
  title: string
  description: string
  dueDate: string
  completed: boolean
  createdAt: string
}

export type RecordItem = ApiRecord | AccountRecord | TodoRecord

export type RecordSummary =
  | Pick<ApiRecord, 'id' | 'type' | 'title' | 'createdAt'>
  | Pick<AccountRecord, 'id' | 'type' | 'title' | 'account' | 'createdAt'>
  | Pick<
      TodoRecord,
      'id' | 'type' | 'title' | 'description' | 'dueDate' | 'completed' | 'createdAt'
    >

export type RecordInput =
  | Pick<ApiRecord, 'type' | 'title' | 'key'>
  | Pick<AccountRecord, 'type' | 'title' | 'account' | 'password'>
  | (Pick<TodoRecord, 'type' | 'title' | 'dueDate'> & Partial<Pick<TodoRecord, 'description'>>)

export type CopyField = 'key' | 'account' | 'password'

export type VaultStatus = {
  initialized: boolean
  unlocked: boolean
  systemUnlockAvailable: boolean
  platform: 'darwin' | 'win32'
}

export type AppSettings = {
  shortcut: string
  launchAtLogin: boolean
}

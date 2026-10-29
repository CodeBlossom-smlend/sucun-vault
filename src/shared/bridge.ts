import type { AppSettings, CopyField, RecordInput, RecordSummary, VaultStatus } from './types'

export interface VaultBridge {
  onStateChanged(callback: () => void): () => void
  status(): Promise<VaultStatus>
  initialize(password: string): Promise<void>
  unlockWithPassword(password: string): Promise<boolean>
  unlockWithSystem(): Promise<boolean>
  lock(): Promise<void>
  list(): Promise<RecordSummary[]>
  add(input: RecordInput): Promise<void>
  remove(id: string): Promise<void>
  setTodoCompleted(id: string, completed: boolean): Promise<void>
  copy(id: string, field: CopyField): Promise<void>
  getSettings(): Promise<AppSettings>
  updateSettings(settings: AppSettings): Promise<AppSettings>
  exportBackup(): Promise<boolean>
  importBackup(password: string): Promise<boolean>
}

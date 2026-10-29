import { contextBridge, ipcRenderer } from 'electron'
import type { VaultBridge } from '../shared/bridge'

const bridge: VaultBridge = {
  onStateChanged(callback) {
    const listener = () => callback()
    ipcRenderer.on('vault:changed', listener)
    return () => ipcRenderer.removeListener('vault:changed', listener)
  },
  status: () => ipcRenderer.invoke('vault:status'),
  initialize: (password) => ipcRenderer.invoke('vault:initialize', password),
  unlockWithPassword: (password) => ipcRenderer.invoke('vault:unlock-password', password),
  unlockWithSystem: () => ipcRenderer.invoke('vault:unlock-system'),
  lock: () => ipcRenderer.invoke('vault:lock'),
  list: () => ipcRenderer.invoke('vault:list'),
  add: (input) => ipcRenderer.invoke('vault:add', input),
  remove: (id) => ipcRenderer.invoke('vault:remove', id),
  setTodoCompleted: (id, completed) => ipcRenderer.invoke('vault:complete', id, completed),
  copy: (id, field) => ipcRenderer.invoke('vault:copy', id, field),
  getSettings: () => ipcRenderer.invoke('vault:settings'),
  updateSettings: (settings) => ipcRenderer.invoke('vault:update-settings', settings),
  exportBackup: () => ipcRenderer.invoke('vault:export'),
  importBackup: (password) => ipcRenderer.invoke('vault:import', password)
}

contextBridge.exposeInMainWorld('vault', bridge)

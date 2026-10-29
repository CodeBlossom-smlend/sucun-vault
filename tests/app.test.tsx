// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/renderer/App'
import type { VaultBridge } from '../src/shared/bridge'

afterEach(cleanup)

function attachBridge(overrides: Partial<VaultBridge> = {}) {
  const bridge: VaultBridge = {
    onStateChanged: () => () => undefined,
    status: async () => ({
      initialized: true,
      unlocked: true,
      systemUnlockAvailable: true,
      platform: 'darwin'
    }),
    initialize: async () => undefined,
    unlockWithPassword: async () => true,
    unlockWithSystem: async () => true,
    lock: async () => undefined,
    list: async () => [],
    add: async () => undefined,
    remove: async () => undefined,
    setTodoCompleted: async () => undefined,
    copy: async () => undefined,
    getSettings: async () => ({ shortcut: 'CommandOrControl+Shift+P', launchAtLogin: false }),
    updateSettings: async (settings) => settings,
    exportBackup: async () => true,
    importBackup: async () => true,
    ...overrides
  }
  Object.defineProperty(window, 'vault', { configurable: true, value: bridge })
  return bridge
}

it('shows master-password setup on a new device', async () => {
  attachBridge({
    status: async () => ({
      initialized: false,
      unlocked: false,
      systemUnlockAvailable: false,
      platform: 'darwin'
    })
  })
  render(<App />)
  expect(await screen.findByText('设置主密码')).toBeTruthy()
  expect(screen.getByLabelText('确认主密码')).toBeTruthy()
})

it('shows system unlock and master-password fallback when locked', async () => {
  attachBridge({
    status: async () => ({
      initialized: true,
      unlocked: false,
      systemUnlockAvailable: true,
      platform: 'darwin'
    })
  })
  render(<App />)
  expect(await screen.findByRole('button', { name: '使用 Touch ID 解锁' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '使用主密码' })).toBeTruthy()
})

it('reports a canceled password unlock without showing records', async () => {
  const user = userEvent.setup()
  attachBridge({
    status: async () => ({
      initialized: true,
      unlocked: false,
      systemUnlockAvailable: false,
      platform: 'darwin'
    }),
    unlockWithPassword: async () => false
  })
  render(<App />)
  await user.type(await screen.findByLabelText('主密码'), 'test password')
  await user.click(screen.getByRole('button', { name: '使用主密码解锁' }))
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    expect.stringContaining('解锁已取消')
  )
})

it('filters a scrollable list while keeping the save action available', async () => {
  const user = userEvent.setup()
  attachBridge({
    list: async () => [
      { id: 'a', type: 'api', title: '服务 A', createdAt: '2026-10-29T00:00:00.000Z' },
      { id: 'b', type: 'api', title: '服务 B', createdAt: '2026-10-29T00:00:00.000Z' }
    ]
  })
  render(<App />)
  expect(await screen.findByText('服务 A')).toBeTruthy()
  expect(screen.getByTestId('record-scroll-region')).toBeTruthy()
  await user.type(screen.getByPlaceholderText('搜索标题、账号或待办内容'), '服务 B')
  expect(screen.queryByText('服务 A')).toBeNull()
  expect(screen.getByText('服务 B')).toBeTruthy()
  expect(screen.getByRole('button', { name: '保存新内容' })).toBeTruthy()
})

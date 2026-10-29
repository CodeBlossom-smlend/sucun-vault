// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '../src/renderer/components/SettingsScreen'

afterEach(cleanup)

it('captures a new shortcut and saves the startup preference', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(
    <SettingsScreen
      platform="darwin"
      settings={{ shortcut: 'CommandOrControl+Shift+P', launchAtLogin: false }}
      onSave={onSave}
      onBack={vi.fn()}
      onExport={vi.fn()}
      onImport={vi.fn()}
      onLock={vi.fn()}
    />
  )
  const shortcut = screen.getByLabelText('唤起快捷键')
  await user.click(shortcut)
  await user.keyboard('{Meta>}{Alt>}k{/Alt}{/Meta}')
  await user.click(screen.getByLabelText('开机自动启动'))
  await user.click(screen.getByRole('button', { name: '保存设置' }))
  expect(onSave).toHaveBeenCalledWith({ shortcut: 'CommandOrControl+Alt+K', launchAtLogin: true })
})

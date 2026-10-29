import { describe, expect, it } from 'vitest'
import { createShortcutController, validateShortcut } from '../src/main/shortcut'

describe('global shortcut settings', () => {
  it('requires a modifier and a key', () => {
    expect(() => validateShortcut('P')).toThrow('快捷键')
    expect(() => validateShortcut('CommandOrControl+P-invalid')).toThrow('快捷键')
    expect(() => validateShortcut('CommandOrControl+Shift+P')).not.toThrow()
  })

  it('keeps the previous shortcut when a new shortcut is occupied', () => {
    const registered = new Set<string>(['CommandOrControl+Shift+P'])
    const controller = createShortcutController(
      {
        register: (shortcut) => {
          if (shortcut === 'CommandOrControl+P') return false
          registered.add(shortcut)
          return true
        },
        unregister: (shortcut) => {
          registered.delete(shortcut)
        }
      },
      'CommandOrControl+Shift+P'
    )

    expect(() => controller.change('CommandOrControl+P')).toThrow('占用')
    expect(controller.current()).toBe('CommandOrControl+Shift+P')
    expect(registered.has('CommandOrControl+Shift+P')).toBe(true)
  })

  it('registers the new shortcut before releasing the old one', () => {
    const actions: string[] = []
    const controller = createShortcutController(
      {
        register: (shortcut) => {
          actions.push(`register:${shortcut}`)
          return true
        },
        unregister: (shortcut) => {
          actions.push(`unregister:${shortcut}`)
        }
      },
      'CommandOrControl+Shift+P'
    )
    controller.change('CommandOrControl+Alt+P')
    expect(actions).toEqual([
      'register:CommandOrControl+Alt+P',
      'unregister:CommandOrControl+Shift+P'
    ])
  })
})

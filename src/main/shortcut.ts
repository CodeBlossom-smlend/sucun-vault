export type ShortcutAdapter = {
  register: (shortcut: string) => boolean
  unregister: (shortcut: string) => void
}

const MODIFIERS = new Set([
  'CommandOrControl',
  'Command',
  'Control',
  'Ctrl',
  'Alt',
  'Option',
  'Shift',
  'Super',
  'Meta'
])

export function validateShortcut(shortcut: string): void {
  if (typeof shortcut !== 'string') throw new Error('请输入有效快捷键')
  const parts = shortcut.split('+')
  if (parts.length < 2 || parts.some((part) => !part.trim()))
    throw new Error('请输入包含修饰键的快捷键')
  if (!parts.slice(0, -1).every((part) => MODIFIERS.has(part))) throw new Error('快捷键格式无效')
  if (MODIFIERS.has(parts.at(-1)!)) throw new Error('快捷键需要普通按键')
  if (!/^(?:[A-Za-z0-9]|F(?:[1-9]|1\d|2[0-4]))$/.test(parts.at(-1)!))
    throw new Error('快捷键按键无效')
}

export function createShortcutController(adapter: ShortcutAdapter, initial: string) {
  let shortcut = initial
  return {
    current: () => shortcut,
    change(candidate: string) {
      validateShortcut(candidate)
      if (candidate === shortcut) return
      if (!adapter.register(candidate)) throw new Error('快捷键已被占用，请换一个组合')
      adapter.unregister(shortcut)
      shortcut = candidate
    }
  }
}

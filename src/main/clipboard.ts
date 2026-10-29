export type ClipboardAdapter = {
  readText: () => Promise<string>
  writeText: (text: string) => Promise<void>
  clear: () => void | Promise<void>
}

export async function copyWithAutoClear(value: string, clipboard: ClipboardAdapter): Promise<void> {
  await clipboard.writeText(value)
  setTimeout(() => {
    void (async () => {
      if ((await clipboard.readText()) === value) await clipboard.clear()
    })().catch(() => undefined)
  }, 30_000)
}

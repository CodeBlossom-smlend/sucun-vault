import { describe, expect, it, vi } from 'vitest'
import { copyWithAutoClear } from '../src/main/clipboard'

describe('secret clipboard', () => {
  it('clears its own copied value after 30 seconds', async () => {
    vi.useFakeTimers()
    let value = ''
    await copyWithAutoClear('secret', {
      readText: async () => value,
      writeText: async (text) => {
        value = text
      },
      clear: async () => {
        value = ''
      }
    })
    expect(value).toBe('secret')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(value).toBe('')
    vi.useRealTimers()
  })

  it('preserves something the user copied afterward', async () => {
    vi.useFakeTimers()
    let value = ''
    await copyWithAutoClear('secret', {
      readText: async () => value,
      writeText: async (text) => {
        value = text
      },
      clear: async () => {
        value = ''
      }
    })
    value = 'new copy'
    await vi.advanceTimersByTimeAsync(30_000)
    expect(value).toBe('new copy')
    vi.useRealTimers()
  })
})

import type { VaultBridge } from '../shared/bridge'

declare global {
  interface Window {
    vault: VaultBridge
  }
}

export {}

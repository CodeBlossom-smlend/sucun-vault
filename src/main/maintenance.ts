import { removeExpired } from '../shared/records'
import { openVaultWithKey, saveVault } from './vault'

export async function purgeExpiredFile(
  path: string,
  key: Buffer,
  now = new Date()
): Promise<number> {
  const opened = await openVaultWithKey(path, key)
  const next = removeExpired(opened.records, now)
  const removed = opened.records.length - next.length
  if (removed) await saveVault(path, key, next)
  return removed
}

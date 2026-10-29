import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { RecordItem } from '../shared/types'

const FILE_VERSION = 1
const KDF_COST = 1 << 15
const KDF_BLOCK_SIZE = 8
const KDF_PARALLELIZATION = 1

type Envelope = {
  version: 1
  kdf: { name: 'scrypt'; salt: string; N: number; r: number; p: number }
  iv: string
  tag: string
  ciphertext: string
}

export type OpenVault = { key: Buffer; records: RecordItem[] }

function metadata(envelope: Envelope): Buffer {
  return Buffer.from(JSON.stringify({ version: envelope.version, kdf: envelope.kdf }))
}

function decodeEnvelope(raw: string): Envelope {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('密码错误或保险库文件损坏')
  }
  if (!value || typeof value !== 'object') throw new Error('密码错误或保险库文件损坏')
  const e = value as Partial<Envelope>
  if (
    e.version !== FILE_VERSION ||
    e.kdf?.name !== 'scrypt' ||
    e.kdf.N !== KDF_COST ||
    e.kdf.r !== KDF_BLOCK_SIZE ||
    e.kdf.p !== KDF_PARALLELIZATION ||
    typeof e.kdf.salt !== 'string' ||
    typeof e.iv !== 'string' ||
    typeof e.tag !== 'string' ||
    typeof e.ciphertext !== 'string'
  )
    throw new Error('密码错误或保险库文件损坏')
  return e as Envelope
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  if (!password) return Promise.reject(new Error('请输入主密码'))
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      32,
      {
        N: KDF_COST,
        r: KDF_BLOCK_SIZE,
        p: KDF_PARALLELIZATION,
        maxmem: 64 * 1024 * 1024
      },
      (error, key) => (error ? reject(error) : resolve(key))
    )
  })
}

function encrypt(envelope: Envelope, key: Buffer, records: RecordItem[]): Envelope {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(metadata(envelope))
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ records }), 'utf8'),
    cipher.final()
  ])
  return {
    ...envelope,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  }
}

function decrypt(envelope: Envelope, key: Buffer): RecordItem[] {
  try {
    if (key.length !== 32) throw new Error('invalid key')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'))
    decipher.setAAD(metadata(envelope))
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final()
    ])
    const parsed: unknown = JSON.parse(plaintext.toString('utf8'))
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { records?: unknown }).records)
    ) {
      throw new Error('invalid records')
    }
    const records = (parsed as { records: unknown[] }).records
    if (!records.every(isRecordItem)) throw new Error('invalid records')
    return records
  } catch {
    throw new Error('密码错误或保险库文件损坏')
  }
}

function isRecordItem(value: unknown): value is RecordItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<RecordItem>
  if (
    typeof item.id !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.createdAt !== 'string'
  )
    return false
  if (item.type === 'api') return typeof item.key === 'string'
  if (item.type === 'account')
    return typeof item.account === 'string' && typeof item.password === 'string'
  if (item.type === 'todo')
    return (
      typeof item.description === 'string' &&
      typeof item.dueDate === 'string' &&
      typeof item.completed === 'boolean'
    )
  return false
}

async function atomicWrite(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, data, { mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}

export async function createVault(path: string, password: string): Promise<OpenVault> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  const envelope: Envelope = {
    version: 1,
    kdf: {
      name: 'scrypt',
      salt: salt.toString('base64'),
      N: KDF_COST,
      r: KDF_BLOCK_SIZE,
      p: KDF_PARALLELIZATION
    },
    iv: '',
    tag: '',
    ciphertext: ''
  }
  try {
    await readFile(path)
    throw new Error('保险库已存在')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await atomicWrite(path, JSON.stringify(encrypt(envelope, key, [])))
  return { key, records: [] }
}

export async function openVault(path: string, password: string): Promise<OpenVault> {
  const envelope = decodeEnvelope(await readFile(path, 'utf8'))
  const key = await deriveKey(password, Buffer.from(envelope.kdf.salt, 'base64'))
  return { key, records: decrypt(envelope, key) }
}

export async function openVaultWithKey(path: string, key: Buffer): Promise<OpenVault> {
  const envelope = decodeEnvelope(await readFile(path, 'utf8'))
  return { key, records: decrypt(envelope, key) }
}

export async function saveVault(path: string, key: Buffer, records: RecordItem[]): Promise<void> {
  const envelope = decodeEnvelope(await readFile(path, 'utf8'))
  await atomicWrite(path, JSON.stringify(encrypt(envelope, key, records)))
}

export async function exportBackup(path: string, destination: string): Promise<void> {
  const raw = await readFile(path)
  decodeEnvelope(raw.toString('utf8'))
  await mkdir(dirname(destination), { recursive: true })
  await copyFile(path, destination)
}

export async function importBackup(
  source: string,
  password: string,
  destination: string
): Promise<void> {
  const raw = await readFile(source)
  const envelope = decodeEnvelope(raw.toString('utf8'))
  const key = await deriveKey(password, Buffer.from(envelope.kdf.salt, 'base64'))
  decrypt(envelope, key)
  await atomicWrite(destination, raw)
}

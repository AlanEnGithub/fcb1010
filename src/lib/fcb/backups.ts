/** Backups nombrados del estado del editor (localStorage). */

import { DUMP_SIZE, isFcbDump } from './pack'

const STORAGE_KEY = 'fcb1010-uno-backups-v1'

export interface BackupMeta {
  id: string
  name: string
  createdAt: string
  note?: string
}

export interface Backup extends BackupMeta {
  /** Dump SysEx en base64 */
  dumpB64: string
  names: string[]
}

function loadAll(): Backup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Backup[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(backups: Backup[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backups))
}

export function listBackups(): BackupMeta[] {
  return loadAll().map(({ id, name, createdAt, note }) => ({
    id,
    name,
    createdAt,
    note,
  }))
}

export function createBackup(
  name: string,
  dump: Uint8Array,
  names: string[],
  note?: string,
): BackupMeta {
  if (!isFcbDump(dump)) {
    throw new Error('Dump inválido para backup')
  }
  const backup: Backup = {
    id: crypto.randomUUID(),
    name: name.trim() || `Backup ${new Date().toLocaleString('es-AR')}`,
    createdAt: new Date().toISOString(),
    note,
    dumpB64: bytesToB64(dump),
    names: names.slice(0, 100),
  }
  const all = loadAll()
  all.unshift(backup)
  saveAll(all)
  return { id: backup.id, name: backup.name, createdAt: backup.createdAt, note: backup.note }
}

export function getBackup(id: string): { dump: Uint8Array; names: string[]; meta: BackupMeta } | null {
  const found = loadAll().find((b) => b.id === id)
  if (!found) return null
  const dump = b64ToBytes(found.dumpB64)
  if (dump.length !== DUMP_SIZE || !isFcbDump(dump)) return null
  return {
    dump,
    names: found.names,
    meta: {
      id: found.id,
      name: found.name,
      createdAt: found.createdAt,
      note: found.note,
    },
  }
}

export function deleteBackup(id: string): void {
  saveAll(loadAll().filter((b) => b.id !== id))
}

export function renameBackup(id: string, name: string): void {
  const all = loadAll()
  const item = all.find((b) => b.id === id)
  if (!item) return
  item.name = name.trim() || item.name
  saveAll(all)
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

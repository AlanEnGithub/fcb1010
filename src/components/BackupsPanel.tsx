import { useState } from 'react'
import {
  createBackup,
  deleteBackup,
  getBackup,
  listBackups,
  renameBackup,
  type BackupMeta,
} from '../lib/fcb/backups'

interface Props {
  getDump: () => Uint8Array
  names: string[]
  onRestore: (dump: Uint8Array, names: string[], label: string) => void
  onStatus: (msg: string) => void
}

export function BackupsPanel({ getDump, names, onRestore, onStatus }: Props) {
  const [items, setItems] = useState<BackupMeta[]>(() => listBackups())
  const [name, setName] = useState('')

  const refresh = () => setItems(listBackups())

  const save = () => {
    try {
      const meta = createBackup(name || `Backup ${new Date().toLocaleString('es-AR')}`, getDump(), names)
      setName('')
      refresh()
      onStatus(`Backup guardado: ${meta.name}`)
    } catch (err) {
      onStatus(err instanceof Error ? err.message : String(err))
    }
  }

  const restore = (id: string) => {
    const packed = getBackup(id)
    if (!packed) {
      onStatus('No se pudo leer el backup.')
      return
    }
    if (!window.confirm(`¿Restaurar «${packed.meta.name}»? Se reemplaza el setup actual en el editor.`)) {
      return
    }
    onRestore(packed.dump, packed.names, packed.meta.name)
  }

  const remove = (id: string, label: string) => {
    if (!window.confirm(`¿Borrar backup «${label}»?`)) return
    deleteBackup(id)
    refresh()
    onStatus(`Backup borrado: ${label}`)
  }

  const rename = (id: string, current: string) => {
    const next = window.prompt('Nuevo nombre', current)
    if (!next) return
    renameBackup(id, next)
    refresh()
  }

  return (
    <div className="panel">
      <h2>Backups</h2>
      <p className="hint">
        Instantáneas locales del setup actual (en este navegador). Podés tener varias y
        restaurarlas cuando quieras.
      </p>
      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nombre del backup"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            flex: 1,
            minWidth: '10rem',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 7,
            padding: '0.4rem 0.55rem',
          }}
        />
        <button type="button" className="btn primary" onClick={save}>
          Guardar backup
        </button>
      </div>
      <ul className="backup-list">
        {items.length === 0 ? (
          <li className="hint">Todavía no hay backups.</li>
        ) : (
          items.map((b) => (
            <li key={b.id}>
              <div>
                <strong>{b.name}</strong>
                <div className="hint mono">
                  {new Date(b.createdAt).toLocaleString('es-AR', {
                    timeZone: 'America/Buenos_Aires',
                  })}{' '}
                  (Buenos Aires)
                </div>
              </div>
              <div className="toolbar">
                <button type="button" className="btn" onClick={() => restore(b.id)}>
                  Restaurar
                </button>
                <button type="button" className="btn" onClick={() => rename(b.id, b.name)}>
                  Renombrar
                </button>
                <button type="button" className="btn" onClick={() => remove(b.id, b.name)}>
                  Borrar
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

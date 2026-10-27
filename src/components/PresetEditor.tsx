import type { FcbPreset } from '../lib/fcb/model'
import type { CcMode, TriState, UnoPresetExtra } from '../lib/fcb/uno'

interface Props {
  index: number
  name: string
  preset: FcbPreset
  uno: UnoPresetExtra
  stompboxMode: boolean
  onName: (name: string) => void
  onChange: (preset: FcbPreset, uno: UnoPresetExtra) => void
}

const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: 'unchanged', label: 'Sin cambio' },
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
]

const MODE_OPTIONS: { value: CcMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'momentary', label: 'Momentary' },
]

export function PresetEditor({
  index,
  name,
  preset,
  uno,
  stompboxMode,
  onName,
  onChange,
}: Props) {
  const setPreset = (next: FcbPreset) => onChange(next, uno)
  const setUno = (next: UnoPresetExtra) => onChange(preset, next)

  return (
    <div className="editor-sections">
      <div className="field">
        <label htmlFor="preset-name">Nombre (solo editor)</label>
        <input
          id="preset-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          maxLength={40}
        />
      </div>
      <p className="hint mono">
        Preset físico {String(index).padStart(2, '0')} · banco {Math.floor(index / 10)} · pedal{' '}
        {(index % 10) + 1}
      </p>

      <h3>Program changes</h3>
      <div className="slot-grid">
        {preset.pc.map((slot, i) => (
          <div className="slot" key={`pc${i}`}>
            <header>
              <strong>PC{i + 1}</strong>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={slot.enabled}
                  onChange={(e) => {
                    const pc = preset.pc.map((s, j) =>
                      j === i ? { ...s, enabled: e.target.checked } : s,
                    ) as FcbPreset['pc']
                    setPreset({ ...preset, pc })
                  }}
                />
                Activo
              </label>
            </header>
            <div className="field">
              <label>Programa (1–128)</label>
              <input
                type="number"
                min={1}
                max={128}
                value={slot.program + 1}
                disabled={!slot.enabled}
                onChange={(e) => {
                  const program = Math.min(127, Math.max(0, Number(e.target.value) - 1))
                  const pc = preset.pc.map((s, j) =>
                    j === i ? { ...s, program } : s,
                  ) as FcbPreset['pc']
                  setPreset({ ...preset, pc })
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <h3>Control changes</h3>
      <div className="slot-grid">
        {(['cc1', 'cc2'] as const).map((key) => {
          const slot = preset[key]
          const altKey = key === 'cc1' ? 'cc1Alt' : 'cc2Alt'
          const modeKey = key === 'cc1' ? 'cc1Mode' : 'cc2Mode'
          return (
            <div className="slot" key={key}>
              <header>
                <strong>{key.toUpperCase()}</strong>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: { ...slot, enabled: e.target.checked },
                      })
                    }
                  />
                  Activo
                </label>
              </header>
              <div className="row-2">
                <div className="field">
                  <label>CC #</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={slot.controller}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: {
                          ...slot,
                          controller: clamp7(Number(e.target.value)),
                        },
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Valor</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={slot.value}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: { ...slot, value: clamp7(Number(e.target.value)) },
                      })
                    }
                  />
                </div>
              </div>
              <div className="row-2">
                <div className="field">
                  <label>Modo UnO</label>
                  <select
                    value={uno[modeKey]}
                    onChange={(e) =>
                      setUno({ ...uno, [modeKey]: e.target.value as CcMode })
                    }
                  >
                    {MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Valor alt.</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={uno[altKey]}
                    onChange={(e) =>
                      setUno({ ...uno, [altKey]: clamp7(Number(e.target.value)) })
                    }
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <h3>Expression / Note / Relés</h3>
      <div className="slot-grid">
        {(['expA', 'expB'] as const).map((key) => {
          const slot = preset[key]
          const triKey = key
          return (
            <div className="slot" key={key}>
              <header>
                <strong>{key === 'expA' ? 'Expresión A' : 'Expresión B'}</strong>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: { ...slot, enabled: e.target.checked },
                      })
                    }
                  />
                  Activo
                </label>
              </header>
              <div className="field">
                <label>Comportamiento UnO</label>
                <select
                  value={uno[triKey]}
                  onChange={(e) =>
                    setUno({ ...uno, [triKey]: e.target.value as TriState })
                  }
                >
                  {TRI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-2">
                <div className="field">
                  <label>CC #</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={slot.controller}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: {
                          ...slot,
                          controller: clamp7(Number(e.target.value)),
                        },
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Min</label>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={slot.min}
                    disabled={!slot.enabled}
                    onChange={(e) =>
                      setPreset({
                        ...preset,
                        [key]: { ...slot, min: clamp7(Number(e.target.value)) },
                      })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Max</label>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={slot.max}
                  disabled={!slot.enabled}
                  onChange={(e) =>
                    setPreset({
                      ...preset,
                      [key]: { ...slot, max: clamp7(Number(e.target.value)) },
                    })
                  }
                />
              </div>
            </div>
          )
        })}

        <div className="slot">
          <header>
            <strong>Note</strong>
            <label className="toggle">
              <input
                type="checkbox"
                checked={preset.note.enabled}
                onChange={(e) =>
                  setPreset({
                    ...preset,
                    note: { ...preset.note, enabled: e.target.checked },
                  })
                }
              />
              Activo
            </label>
          </header>
          <div className="field">
            <label>Nota (0–127)</label>
            <input
              type="number"
              min={0}
              max={127}
              value={preset.note.value}
              disabled={!preset.note.enabled}
              onChange={(e) =>
                setPreset({
                  ...preset,
                  note: { ...preset.note, value: clamp7(Number(e.target.value)) },
                })
              }
            />
          </div>
        </div>

        <div className="slot">
          <header>
            <strong>Relés</strong>
          </header>
          {(['switch1', 'switch2'] as const).map((key, i) => (
            <div className="field" key={key}>
              <label>Switch {i + 1}</label>
              <select
                value={uno[key]}
                onChange={(e) => {
                  const tri = e.target.value as TriState
                  setUno({ ...uno, [key]: tri })
                  if (tri !== 'unchanged') {
                    setPreset({ ...preset, [key]: tri === 'on' })
                  }
                }}
              >
                {TRI_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {stompboxMode && (
        <>
          <h3>Enlace a stompboxes</h3>
          <p className="hint">
            Al elegir este preset, cada stomp global puede quedar igual, apagarse o
            encenderse.
          </p>
          <div className="slot-grid">
            {uno.stompLinks.map((link, i) => (
              <div className="slot" key={`stomp-${i}`}>
                <header>
                  <strong>Stomp {i + 1}</strong>
                </header>
                <select
                  value={link}
                  onChange={(e) => {
                    const stompLinks = [...uno.stompLinks] as UnoPresetExtra['stompLinks']
                    stompLinks[i] = e.target.value as TriState
                    setUno({ ...uno, stompLinks })
                  }}
                >
                  {TRI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function clamp7(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(127, Math.max(0, Math.trunc(n)))
}

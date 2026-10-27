import type { FcbGlobal, MidiFunction } from '../lib/fcb/model'
import { MIDI_FUNCTIONS } from '../lib/fcb/model'
import type { UnoGlobal } from '../lib/fcb/uno'

const LABELS: Record<MidiFunction, string> = {
  pc1: 'PC1',
  pc2: 'PC2',
  pc3: 'PC3',
  pc4: 'PC4',
  pc5: 'PC5',
  cc1: 'CC1',
  cc2: 'CC2',
  expA: 'Exp A',
  expB: 'Exp B',
  note: 'Note',
}

interface Props {
  global: FcbGlobal
  uno: UnoGlobal
  onChange: (global: FcbGlobal, uno: UnoGlobal) => void
}

export function GlobalEditor({ global, uno, onChange }: Props) {
  const setG = (patch: Partial<FcbGlobal>) => onChange({ ...global, ...patch }, uno)
  const setU = (patch: Partial<UnoGlobal>) => onChange(global, { ...uno, ...patch })

  return (
    <div className="editor-sections">
      <div className="callout">
        <strong>¿Stompbox por preset o por banco?</strong>
        <p>
          No. En firmware <strong>UnO 1.x</strong> el stompbox mode es un switch{' '}
          <em>global</em> de toda la pedalera: o está ON (5 stomps fijos + 19×5
          presets) o OFF (10×10 clásico). No se puede mezclar “este banco con
          stomps / este otro sin”. Eso sí existe en <strong>UnO2 / LG-FCB</strong>,
          no en UnO clásico.
        </p>
        <p>
          Direct Select y Stompbox son excluyentes en UnO.
        </p>
      </div>

      <div className="panel" style={{ padding: 0, border: 'none', background: 'transparent' }}>
        <h3>Modo de operación</h3>
        <div className="switch-row">
          <div>
            <strong>Stompbox mode</strong>
            <p>5 pedales fijos como efectos; 19 bancos de 5 presets.</p>
          </div>
          <input
            type="checkbox"
            checked={uno.stompboxMode}
            onChange={(e) =>
              onChange(
                { ...global, directSelect: e.target.checked ? false : global.directSelect },
                { ...uno, stompboxMode: e.target.checked },
              )
            }
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Stomps en fila superior</strong>
            <p>On = pedales 6–10; off = pedales 1–5.</p>
          </div>
          <input
            type="checkbox"
            checked={uno.stompboxUpperRow}
            disabled={!uno.stompboxMode}
            onChange={(e) => setU({ stompboxUpperRow: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Direct Select</strong>
            <p>Dos pulsaciones (banco+preset) para ir a 00–99.</p>
          </div>
          <input
            type="checkbox"
            checked={global.directSelect}
            disabled={uno.stompboxMode}
            onChange={(e) => setG({ directSelect: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Running Status</strong>
            <p>Omite status MIDI repetidos (útil en expresión).</p>
          </div>
          <input
            type="checkbox"
            checked={global.runningStatus}
            onChange={(e) => setG({ runningStatus: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>MIDI Merge</strong>
            <p>Reenvía MIDI IN hacia MIDI OUT.</p>
          </div>
          <input
            type="checkbox"
            checked={global.midiMerge}
            onChange={(e) => setG({ midiMerge: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Bloquear PC repetidos</strong>
            <p>UnO: no reenvía el mismo PC si no cambió.</p>
          </div>
          <input
            type="checkbox"
            checked={uno.blockRepeatingPc}
            onChange={(e) => setU({ blockRepeatingPc: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Tap Tempo</strong>
            <p>Habilita el cálculo de taptempo por preset.</p>
          </div>
          <input
            type="checkbox"
            checked={uno.tapTempoEnabled}
            onChange={(e) => setU({ tapTempoEnabled: e.target.checked })}
          />
        </div>
      </div>

      <h3>Canales MIDI (globales)</h3>
      <div className="slot-grid">
        {MIDI_FUNCTIONS.map((fn) => (
          <div className="field" key={fn}>
            <label htmlFor={`ch-${fn}`}>{LABELS[fn]}</label>
            <select
              id={`ch-${fn}`}
              value={global.channels[fn]}
              onChange={(e) =>
                setG({
                  channels: {
                    ...global.channels,
                    [fn]: Number(e.target.value),
                  },
                })
              }
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  Canal {i + 1}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <h3>Relés globales</h3>
      <div className="slot-grid">
        <div className="switch-row">
          <div>
            <strong>Switch 1 latched</strong>
            <p>Off = momentary.</p>
          </div>
          <input
            type="checkbox"
            checked={uno.switch1Latched}
            onChange={(e) => setU({ switch1Latched: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Switch 2 latched</strong>
          </div>
          <input
            type="checkbox"
            checked={uno.switch2Latched}
            onChange={(e) => setU({ switch2Latched: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Invertir switch 1</strong>
          </div>
          <input
            type="checkbox"
            checked={uno.switch1Invert}
            onChange={(e) => setU({ switch1Invert: e.target.checked })}
          />
        </div>
        <div className="switch-row">
          <div>
            <strong>Invertir switch 2</strong>
          </div>
          <input
            type="checkbox"
            checked={uno.switch2Invert}
            onChange={(e) => setU({ switch2Invert: e.target.checked })}
          />
        </div>
        <div className="field">
          <label>Velocidad Note On global</label>
          <input
            type="number"
            min={0}
            max={127}
            value={uno.noteVelocity}
            onChange={(e) =>
              setU({
                noteVelocity: Math.min(127, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </div>
      </div>

      <h3>Calibración expresión</h3>
      <div className="slot-grid">
        {(
          [
            ['Exp A min', 'expACalibrationMin'],
            ['Exp A max', 'expACalibrationMax'],
            ['Exp B min', 'expBCalibrationMin'],
            ['Exp B max', 'expBCalibrationMax'],
          ] as const
        ).map(([label, key]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              type="number"
              min={0}
              max={127}
              value={global[key]}
              onChange={(e) =>
                setG({
                  [key]: Math.min(127, Math.max(0, Number(e.target.value) || 0)),
                } as Partial<FcbGlobal>)
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

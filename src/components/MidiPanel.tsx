import type { FirmwareInfo } from '../lib/fcb/pack'

interface Props {
  supported: boolean
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
  inputId: string
  outputId: string
  firmware: FirmwareInfo | null
  useChunked: boolean
  onInputId: (id: string) => void
  onOutputId: (id: string) => void
  onRefresh: () => void
  onDetect: () => void
  onChunked: (v: boolean) => void
}

export function MidiPanel(props: Props) {
  return (
    <div className="panel">
      <h2>MIDI</h2>
      {!props.supported ? (
        <p className="hint">
          Web MIDI no está disponible. Abrí esta app en Chrome o Edge con HTTPS o localhost.
        </p>
      ) : (
        <div className="ports">
          <div className="field">
            <label htmlFor="midi-in">Entrada (desde la pedalera)</label>
            <select
              id="midi-in"
              value={props.inputId}
              onChange={(e) => props.onInputId(e.target.value)}
            >
              <option value="">— seleccionar —</option>
              {props.inputs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="midi-out">Salida (hacia la pedalera)</label>
            <select
              id="midi-out"
              value={props.outputId}
              onChange={(e) => props.onOutputId(e.target.value)}
            >
              <option value="">— seleccionar —</option>
              {props.outputs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar">
            <button type="button" className="btn" onClick={props.onRefresh}>
              Actualizar puertos
            </button>
            <button
              type="button"
              className="btn"
              onClick={props.onDetect}
              disabled={!props.inputId || !props.outputId}
            >
              Detectar firmware
            </button>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={props.useChunked}
              onChange={(e) => props.onChunked(e.target.checked)}
            />
            SysEx en chunks (UnO ≥ 1.0.3, interfaces inestables)
          </label>
          {props.firmware ? (
            <span className="badge ok">
              {props.firmware.firmware} {props.firmware.version}
            </span>
          ) : (
            <span className="badge">Firmware no detectado</span>
          )}
        </div>
      )}
    </div>
  )
}

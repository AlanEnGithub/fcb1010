import { useEffect, useMemo, useRef, useState } from 'react'
import { GlobalEditor } from './components/GlobalEditor'
import { MidiPanel } from './components/MidiPanel'
import { PresetBoard } from './components/PresetBoard'
import { PresetEditor } from './components/PresetEditor'
import { buildBankViews } from './lib/fcb/layout'
import {
  createInitialState,
  exportDump,
  loadDumpIntoState,
  readGlobals,
  readPreset,
  resetDefaults,
  writeGlobals,
  writePreset,
  type EditorState,
} from './lib/fcb/store'
import { unpackDump } from './lib/fcb/pack'
import {
  detectFirmware,
  downloadSyx,
  listPorts,
  receiveDump,
  requestMidiAccess,
  readSyxFile,
  sendDump,
} from './lib/midi/webMidi'

type Tab = 'presets' | 'global'

export default function App() {
  const [state, setState] = useState<EditorState>(() => createInitialState())
  const [tab, setTab] = useState<Tab>('presets')
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [inputId, setInputId] = useState('')
  const [outputId, setOutputId] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const supported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess

  const refreshPorts = (midi: MIDIAccess) => {
    const ports = listPorts(midi)
    setInputs(ports.inputs)
    setOutputs(ports.outputs)
  }

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    requestMidiAccess()
      .then((midi) => {
        if (cancelled) return
        setAccess(midi)
        refreshPorts(midi)
        midi.onstatechange = () => refreshPorts(midi)
        setState((s) => ({ ...s, status: 'Web MIDI listo — elegí puertos IN/OUT.' }))
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setState((s) => ({ ...s, status: `Error MIDI: ${message}` }))
      })
    return () => {
      cancelled = true
    }
  }, [supported])

  const input = inputs.find((p) => p.id === inputId) ?? null
  const output = outputs.find((p) => p.id === outputId) ?? null

  const { global, uno } = readGlobals(state)
  const banks = useMemo(() => buildBankViews(uno), [uno])
  const { preset, uno: unoExtra } = readPreset(state, state.selectedPreset)

  const setStatus = (status: string) => setState((s) => ({ ...s, status }))

  const onDetect = async () => {
    if (!input || !output) return
    setBusy(true)
    try {
      const firmware = await detectFirmware(input, output)
      if (!firmware) {
        setState((s) => ({
          ...s,
          firmware: null,
          status: 'Sin respuesta de versión. Revisá cables IN↔OUT.',
        }))
      } else {
        setState((s) => ({
          ...s,
          firmware,
          useChunked: firmware.isUno103OrLater ? s.useChunked : false,
          status: `Detectado ${firmware.firmware} ${firmware.version}`,
        }))
      }
    } finally {
      setBusy(false)
    }
  }

  const onReceive = async () => {
    if (!input) {
      setStatus('Elegí un puerto de entrada MIDI.')
      return
    }
    setBusy(true)
    setStatus(
      output
        ? 'Solicitando dump…'
        : 'Esperando dump manual (config global → pedal 6)…',
    )
    try {
      const dump = await receiveDump(input, output, { request: !!output })
      setState((s) => loadDumpIntoState(s, dump))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus(message)
    } finally {
      setBusy(false)
    }
  }

  const onSend = async () => {
    if (!output) {
      setStatus('Elegí un puerto de salida MIDI.')
      return
    }
    if (
      !window.confirm(
        '¿Enviar el setup completo a la FCB1010? Esto sobrescribe la memoria de la pedalera.',
      )
    ) {
      return
    }
    setBusy(true)
    setStatus('Enviando dump…')
    try {
      const dump = exportDump(state)
      const memory = unpackDump(dump)
      await sendDump(output, memory, {
        deviceId: state.deviceId,
        chunked: state.useChunked,
      })
      // Verificación opcional
      if (input) {
        setStatus('Verificando (re-lectura)…')
        const verify = await receiveDump(input, output, { request: true, timeoutMs: 20000 })
        const same =
          verify.length === dump.length && verify.every((b, i) => b === dump[i])
        setState((s) => ({
          ...s,
          dirty: !same,
          status: same
            ? 'Dump enviado y verificado OK.'
            : 'Enviado, pero la verificación difiere — revisá la interfaz MIDI.',
        }))
      } else {
        setState((s) => ({
          ...s,
          dirty: false,
          status: 'Dump enviado (sin verificación: no hay MIDI IN).',
        }))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus(message)
    } finally {
      setBusy(false)
    }
  }

  const onExport = () => {
    const dump = exportDump(state)
    downloadSyx(dump, 'fcb1010-uno.syx')
    setStatus('Archivo .syx exportado.')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const dump = await readSyxFile(file)
      setState((s) => loadDumpIntoState(s, dump))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus(message)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>FCB1010 UnO Editor</h1>
          <p>Editor modular web para Behringer FCB1010 con firmware UnO</p>
        </div>
        <div className="toolbar">
          {state.dirty && <span className="badge warn">Sin guardar en pedal</span>}
          <button type="button" className="btn" onClick={() => setState(resetDefaults())}>
            Nuevo
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Importar .syx
          </button>
          <button type="button" className="btn" onClick={onExport}>
            Exportar .syx
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onReceive}>
            Recibir dump
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !output}
            onClick={onSend}
          >
            Enviar a pedal
          </button>
          <input
            ref={fileRef}
            className="hidden-input"
            type="file"
            accept=".syx,.SYX"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>
      </header>

      <div className="status" role="status">
        {busy ? '… ' : ''}
        {state.status}
      </div>

      <div className="grid-main">
        <MidiPanel
          supported={supported}
          inputs={inputs}
          outputs={outputs}
          inputId={inputId}
          outputId={outputId}
          firmware={state.firmware}
          useChunked={state.useChunked}
          onInputId={setInputId}
          onOutputId={setOutputId}
          onRefresh={() => access && refreshPorts(access)}
          onDetect={onDetect}
          onChunked={(useChunked) => setState((s) => ({ ...s, useChunked }))}
        />

        <div className="panel">
          <div className="tabs">
            <button
              type="button"
              className={`tab${tab === 'presets' ? ' active' : ''}`}
              onClick={() => setTab('presets')}
            >
              Presets
            </button>
            <button
              type="button"
              className={`tab${tab === 'global' ? ' active' : ''}`}
              onClick={() => setTab('global')}
            >
              Global / UnO
            </button>
          </div>

          {tab === 'presets' ? (
            <>
              <PresetBoard
                banks={banks}
                selectedBank={Math.min(state.selectedBank, banks.length - 1)}
                selectedPreset={state.selectedPreset}
                names={state.names}
                onSelectBank={(selectedBank) => setState((s) => ({ ...s, selectedBank }))}
                onSelectPreset={(selectedPreset) =>
                  setState((s) => ({ ...s, selectedPreset }))
                }
              />
              <PresetEditor
                index={state.selectedPreset}
                name={state.names[state.selectedPreset] ?? ''}
                preset={preset}
                uno={unoExtra}
                stompboxMode={uno.stompboxMode}
                onName={(name) =>
                  setState((s) => {
                    const names = [...s.names]
                    names[s.selectedPreset] = name
                    return { ...s, names }
                  })
                }
                onChange={(nextPreset, nextUno) =>
                  setState((s) => writePreset(s, s.selectedPreset, nextPreset, nextUno))
                }
              />
            </>
          ) : (
            <GlobalEditor
              global={global}
              uno={uno}
              onChange={(g, u) => setState((s) => writeGlobals(s, g, u))}
            />
          )}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityLog, type ActivityItem } from './components/ActivityLog'
import { BackupsPanel } from './components/BackupsPanel'
import { GlobalEditor } from './components/GlobalEditor'
import { MidiPanel } from './components/MidiPanel'
import { PedalboardVisual } from './components/PedalboardVisual'
import { PresetEditor } from './components/PresetEditor'
import { getPreset } from './lib/fcb/model'
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
import { decodeMidiMessage, guessPedalFromEvent } from './lib/midi/decodeLive'
import {
  detectFirmware,
  downloadSyx,
  listPorts,
  receiveDump,
  requestMidiAccess,
  readSyxFile,
  sendDump,
} from './lib/midi/webMidi'

type Tab = 'presets' | 'global' | 'backups'

export default function App() {
  const [state, setState] = useState<EditorState>(() => createInitialState())
  const [tab, setTab] = useState<Tab>('presets')
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<MIDIInput[]>([])
  const [outputs, setOutputs] = useState<MIDIOutput[]>([])
  const [inputId, setInputId] = useState('')
  const [outputId, setOutputId] = useState('')
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [livePedal, setLivePedal] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const liveTimer = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const supported = typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess

  const pushActivity = (text: string, event?: ActivityItem['event']) => {
    const item: ActivityItem = {
      id: crypto.randomUUID(),
      at: new Date().toLocaleTimeString('es-AR', { hour12: false }),
      text,
      event,
    }
    setActivity((prev) => [item, ...prev].slice(0, 40))
  }

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

  // Escuchar MIDI IN en vivo → actividad + resaltar pedal
  useEffect(() => {
    const input = inputs.find((p) => p.id === inputId)
    if (!input) return

    const onMessage = (event: MIDIMessageEvent) => {
      if (!event.data || event.data.length === 0) return
      // Ignorar mientras recibimos dumps grandes (manejados por receiveDump)
      const data = new Uint8Array(event.data)
      if (data[0] === 0xf0 && data.length > 64) return

      const decoded = decodeMidiMessage(data)
      if (!decoded) return

      const s = stateRef.current
      const bank = s.selectedBank
      const lookup = (presetIndex: number) => {
        const p = getPreset(s.memory, presetIndex)
        return {
          pc1: p.pc[0].enabled ? p.pc[0].program : -1,
          cc1: p.cc1.enabled ? p.cc1.controller : undefined,
          cc2: p.cc2.enabled ? p.cc2.controller : undefined,
        }
      }
      const pedal = guessPedalFromEvent(decoded, bank, lookup)
      if (pedal) {
        setLivePedal(pedal)
        if (liveTimer.current) window.clearTimeout(liveTimer.current)
        liveTimer.current = window.setTimeout(() => setLivePedal(null), 600)
        const presetIndex = bank * 10 + (pedal - 1)
        setState((prev) => ({
          ...prev,
          selectedBank: bank,
          selectedPreset: presetIndex,
          status: `MIDI en vivo → pedal ${pedal} (preset ${String(presetIndex).padStart(2, '0')})`,
        }))
        setTab('presets')
        pushActivity(`Pedal ${pedal} / preset ${String(presetIndex).padStart(2, '0')}`, decoded)
      } else {
        pushActivity('', decoded)
      }
    }

    input.addEventListener('midimessage', onMessage)
    return () => {
      input.removeEventListener('midimessage', onMessage)
      if (liveTimer.current) window.clearTimeout(liveTimer.current)
    }
  }, [inputId, inputs])

  const input = inputs.find((p) => p.id === inputId) ?? null
  const output = outputs.find((p) => p.id === outputId) ?? null

  const { global, uno } = readGlobals(state)
  const bankCount = uno.stompboxMode ? 19 : 10
  const selectedBank = Math.min(state.selectedBank, bankCount - 1)
  const selectedPedal = (state.selectedPreset % 10) + 1
  const { preset, uno: unoExtra } = readPreset(state, state.selectedPreset)

  const selectedLabel = useMemo(() => {
    const name = state.names[state.selectedPreset] ?? ''
    return `Banco ${String(selectedBank).padStart(2, '0')} · Pedal ${selectedPedal} · Preset ${String(state.selectedPreset).padStart(2, '0')} (${name})`
  }, [state.names, state.selectedPreset, selectedBank, selectedPedal])

  const presetIndexForPedal = (pedal: number) => {
    if (uno.stompboxMode) {
      const isStomp = uno.stompboxUpperRow ? pedal >= 6 : pedal <= 5
      if (isStomp) {
        // Stomps canónicos en banco 0
        return pedal - 1
      }
      // Mapear pedal de preset al índice físico del banco actual (0–18)
      // Layout simplificado: bancos 0–9 usan pedales libres del banco físico
      const freePedals = uno.stompboxUpperRow ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]
      const slot = freePedals.indexOf(pedal)
      if (slot < 0) return selectedBank * 10 + (pedal - 1)
      if (selectedBank < 10) {
        return uno.stompboxUpperRow
          ? selectedBank * 10 + slot
          : selectedBank * 10 + 5 + slot
      }
      const b = selectedBank - 10
      return uno.stompboxUpperRow ? b * 10 + 5 + slot : b * 10 + slot
    }
    return selectedBank * 10 + (pedal - 1)
  }

  const selectPedal = (pedal: number) => {
    const selectedPreset = presetIndexForPedal(pedal)
    setState((s) => ({
      ...s,
      selectedPreset,
      selectedBank,
      status: `Seleccionado pedal ${pedal} → preset ${String(selectedPreset).padStart(2, '0')}`,
    }))
    setTab('presets')
    pushActivity(`Click UI · pedal ${pedal} · preset ${String(selectedPreset).padStart(2, '0')}`)
  }

  const changeBank = (delta: number) => {
    setState((s) => {
      const max = (readGlobals(s).uno.stompboxMode ? 19 : 10) - 1
      const nextBank = Math.min(max, Math.max(0, s.selectedBank + delta))
      const pedal = (s.selectedPreset % 10) + 1
      // Recalcular preset del mismo pedal en el nuevo banco
      const nextPreset = nextBank * 10 + (pedal - 1)
      return {
        ...s,
        selectedBank: nextBank,
        selectedPreset: Math.min(99, nextPreset),
        status: `Banco ${String(nextBank).padStart(2, '0')}`,
      }
    })
  }

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
        pushActivity(`Firmware ${firmware.firmware} ${firmware.version}`)
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
      pushActivity('Dump recibido desde la pedalera')
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
        pushActivity(same ? 'Envío verificado OK' : 'Envío con diff en verificación')
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
    pushActivity('Exportado .syx')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const dump = await readSyxFile(file)
      setState((s) => loadDumpIntoState(s, dump))
      pushActivity(`Importado ${file.name}`)
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
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState(resetDefaults())
              pushActivity('Nuevo setup de fábrica')
            }}
          >
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
        <div className="side-stack">
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
          <ActivityLog items={activity} selectedLabel={selectedLabel} />
        </div>

        <div className="panel">
          <div className="tabs">
            <button
              type="button"
              className={`tab${tab === 'presets' ? ' active' : ''}`}
              onClick={() => setTab('presets')}
            >
              Pedalera / Presets
            </button>
            <button
              type="button"
              className={`tab${tab === 'global' ? ' active' : ''}`}
              onClick={() => setTab('global')}
            >
              Global / UnO
            </button>
            <button
              type="button"
              className={`tab${tab === 'backups' ? ' active' : ''}`}
              onClick={() => setTab('backups')}
            >
              Backups
            </button>
          </div>

          {tab === 'presets' && (
            <>
              <div className="bank-tabs" role="tablist" aria-label="Bancos">
                {Array.from({ length: bankCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`bank-tab${i === selectedBank ? ' active' : ''}`}
                    onClick={() => {
                      setState((s) => {
                        const pedal = (s.selectedPreset % 10) + 1
                        return {
                          ...s,
                          selectedBank: i,
                          selectedPreset: Math.min(99, i * 10 + (pedal - 1)),
                          status: `Banco ${String(i).padStart(2, '0')}`,
                        }
                      })
                    }}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>

              <PedalboardVisual
                bank={selectedBank}
                selectedPedal={selectedPedal}
                livePedal={livePedal}
                stompboxMode={uno.stompboxMode}
                stompboxUpperRow={uno.stompboxUpperRow}
                names={state.names}
                presetIndexForPedal={presetIndexForPedal}
                onSelectPedal={selectPedal}
                onBankUp={() => changeBank(1)}
                onBankDown={() => changeBank(-1)}
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
                onChange={(nextPreset, nextUno) => {
                  setState((s) => {
                    const next = writePreset(s, s.selectedPreset, nextPreset, nextUno)
                    return next
                  })
                  pushActivity(`Editado preset ${String(state.selectedPreset).padStart(2, '0')}`)
                }}
              />
            </>
          )}

          {tab === 'global' && (
            <GlobalEditor
              global={global}
              uno={uno}
              onChange={(g, u) => {
                setState((s) => writeGlobals(s, g, u))
                pushActivity(
                  u.stompboxMode
                    ? 'Stompbox ON (global UnO)'
                    : g.directSelect
                      ? 'Direct Select ON'
                      : 'Config global actualizada',
                )
              }}
            />
          )}

          {tab === 'backups' && (
            <BackupsPanel
              getDump={() => exportDump(state)}
              names={state.names}
              onStatus={setStatus}
              onRestore={(dump, names, label) => {
                setState((s) => {
                  const loaded = loadDumpIntoState(s, dump)
                  return {
                    ...loaded,
                    names: names.length === 100 ? names : loaded.names,
                    status: `Backup restaurado: ${label}`,
                  }
                })
                setTab('presets')
                pushActivity(`Restaurado backup «${label}»`)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

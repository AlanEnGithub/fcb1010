import {
  dumpRequestMessage,
  isFcbDump,
  packChunkedDump,
  packDump,
  parseVersionResponse,
  type FirmwareInfo,
  unpackDump,
  versionRequestMessage,
} from '../fcb/pack'

export type MidiStatus =
  | { kind: 'unsupported' }
  | { kind: 'pending' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

export interface MidiPorts {
  inputs: MIDIInput[]
  outputs: MIDIOutput[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function requestMidiAccess(): Promise<MIDIAccess> {
  if (!navigator.requestMIDIAccess) {
    throw new Error('Web MIDI no está disponible en este navegador (usá Chrome/Edge).')
  }
  return navigator.requestMIDIAccess({ sysex: true })
}

export function listPorts(access: MIDIAccess): MidiPorts {
  return {
    inputs: [...access.inputs.values()],
    outputs: [...access.outputs.values()],
  }
}

export async function detectFirmware(
  input: MIDIInput,
  output: MIDIOutput,
  timeoutMs = 5000,
): Promise<FirmwareInfo | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)

    const onMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data) return
      const info = parseVersionResponse(data)
      if (info) {
        cleanup()
        resolve(info)
      }
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      input.removeEventListener('midimessage', onMessage)
    }

    input.addEventListener('midimessage', onMessage)
    output.send(versionRequestMessage())
  })
}

export async function receiveDump(
  input: MIDIInput,
  output: MIDIOutput | null,
  opts: { request?: boolean; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  const timeoutMs = opts.timeoutMs ?? 30000
  return new Promise((resolve, reject) => {
    const chunks: number[] = []
    let started = false

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Tiempo agotado esperando el dump SysEx.'))
    }, timeoutMs)

    const onMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 2) return
      if (data[0] !== 0xf0) return
      chunks.push(...data)
      started = true
      if (data[data.length - 1] === 0xf7 && chunks.length >= 2352) {
        // Puede llegar como un solo mensaje o concatenado
        const buf = new Uint8Array(chunks)
        // Buscar un dump completo alineado
        for (let i = 0; i <= buf.length - 2352; i++) {
          const slice = buf.subarray(i, i + 2352)
          if (isFcbDump(slice)) {
            cleanup()
            resolve(slice.slice())
            return
          }
        }
      }
      if (started && isFcbDump(data)) {
        cleanup()
        resolve(new Uint8Array(data))
      }
    }

    const cleanup = () => {
      window.clearTimeout(timer)
      input.removeEventListener('midimessage', onMessage)
    }

    input.addEventListener('midimessage', onMessage)
    if (opts.request !== false && output) {
      output.send(dumpRequestMessage())
    }
  })
}

export async function sendDump(
  output: MIDIOutput,
  memory: Uint8Array,
  opts: { deviceId?: number; chunked?: boolean; gapMs?: number } = {},
): Promise<void> {
  const deviceId = opts.deviceId ?? 0x01
  if (opts.chunked) {
    const chunks = packChunkedDump(memory, deviceId)
    for (const chunk of chunks) {
      output.send(chunk)
      await sleep(opts.gapMs ?? 40)
    }
    return
  }
  output.send([...packDump(memory, deviceId)])
}

export function memoryFromDump(dump: Uint8Array): Uint8Array {
  return unpackDump(dump)
}

export function dumpFromMemory(memory: Uint8Array, deviceId = 0x01): Uint8Array {
  return packDump(memory, deviceId)
}

export function downloadSyx(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function readSyxFile(file: File): Promise<Uint8Array> {
  const buf = new Uint8Array(await file.arrayBuffer())
  if (!isFcbDump(buf)) {
    throw new Error('El archivo no es un dump FCB1010 válido (2352 bytes SysEx).')
  }
  return buf
}

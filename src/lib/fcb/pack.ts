/** Formato SysEx FCB1010 / UnO: empaquetado 7-bit del dump de 2352 bytes. */

export const DUMP_SIZE = 2352
export const MEMORY_SIZE = 2051
export const HEADER = [0xf0, 0x00, 0x20, 0x32, 0x01, 0x0c, 0x0f] as const

const DATA_START = HEADER.length
const DATA_END = DUMP_SIZE - 1
const RUN = 8

function commandMessage(fn: number, deviceId = 0x01): number[] {
  const message = [...HEADER, 0xf7]
  message[4] = deviceId & 0x7f
  message[6] = fn & 0x7f
  return message
}

/** Solicitud de dump completo (función 0x4F). Nunca enviar 0x0F vacío. */
export function dumpRequestMessage(deviceId = 0x01): number[] {
  return commandMessage(0x4f, deviceId)
}

/** Solicitud de versión de firmware (función 0x40). */
export function versionRequestMessage(deviceId = 0x01): number[] {
  return commandMessage(0x40, deviceId)
}

/** Solicitud de chunk n (0-15) del protocolo fragmentado UnO ≥1.0.3. */
export function chunkRequestMessage(chunk: number, deviceId = 0x01): number[] {
  return commandMessage(0x50 + (chunk & 0x0f), deviceId)
}

export interface FirmwareInfo {
  firmware: 'UnO' | 'Behringer'
  version: string
  isUno103OrLater: boolean
  raw: number[]
}

const UNO_VERSIONS = [
  '1.0.0',
  '1.0.1',
  '1.0.2a',
  '1.0.2b',
  '1.0.2c',
  '1.0.2d',
  '1.0.2e',
  '1.0.2f',
  '1.0.3',
  '1.0.4',
]

const BEHRINGER_VERSIONS: Record<number, string> = {
  5: '1.0',
  13: '2.1',
  14: '2.2',
  18: '2.3.12',
  27: '2.4.1B',
  28: '2.4.1C',
  29: '2.4.1D',
  30: '2.5',
}

export function parseVersionResponse(
  data: readonly number[] | Uint8Array,
): FirmwareInfo | null {
  if (data.length !== 9 || data[8] !== 0xf7) return null
  for (let i = 0; i < 6; i++) {
    if (i !== 4 && data[i] !== HEADER[i]) return null
  }
  const code = data[6]
  const fam = data[7]
  const raw = [...data]
  const uno = (version: string): FirmwareInfo => ({
    firmware: 'UnO',
    version,
    isUno103OrLater: version === '1.0.3' || version === '1.0.4',
    raw,
  })
  switch (fam) {
    case 0x0f:
    case 0x1f:
      return uno(code === 3 ? '1.0.3' : '1.0.2f')
    case 0x0e:
      return uno(UNO_VERSIONS[code] ?? '1.0.2')
    case 0x1e:
      return uno(UNO_VERSIONS[code + 5] ?? '1.0.2')
    case 0x0d:
      return {
        firmware: 'Behringer',
        version: BEHRINGER_VERSIONS[code] ?? `2.x (código ${code})`,
        isUno103OrLater: false,
        raw,
      }
    default:
      return null
  }
}

export function isFcbDump(data: readonly number[] | Uint8Array): boolean {
  if (data.length !== DUMP_SIZE) return false
  if (data[DUMP_SIZE - 1] !== 0xf7) return false
  return HEADER.every((byte, i) => (i === 4 ? true : data[i] === byte))
}

/** ¿Es un mensaje de chunk UnO (160 bytes de payload + cabecera)? */
export function isChunkDump(data: readonly number[] | Uint8Array): boolean {
  if (data.length < 10 || data[0] !== 0xf0 || data[data.length - 1] !== 0xf7) {
    return false
  }
  if (data[1] !== 0x00 || data[2] !== 0x20 || data[3] !== 0x32) return false
  if (data[5] !== 0x0c) return false
  const fn = data[6]
  return fn === 0x10 || (fn >= 0x50 && fn <= 0x5f)
}

export function unpackDump(dump: readonly number[] | Uint8Array): Uint8Array {
  if (!isFcbDump(dump)) {
    throw new Error(`No es un patchdump FCB1010 (${dump.length} bytes)`)
  }
  const memory = new Uint8Array(MEMORY_SIZE)
  let out = 0
  for (let runStart = DATA_START; runStart < DATA_END; runStart += RUN) {
    const msbByte = dump[runStart + RUN - 1]
    for (let i = 0; i < RUN - 1; i++) {
      const msb = (msbByte >> i) & 1
      memory[out++] = (dump[runStart + i] & 0x7f) | (msb << 7)
    }
  }
  return memory
}

export function packDump(memory: Uint8Array, deviceId = 0x01): Uint8Array {
  if (memory.length !== MEMORY_SIZE) {
    throw new Error(`La memoria interna debe tener ${MEMORY_SIZE} bytes`)
  }
  const dump = new Uint8Array(DUMP_SIZE)
  dump.set(HEADER)
  dump[4] = deviceId & 0x7f
  let inIndex = 0
  for (let runStart = DATA_START; runStart < DATA_END; runStart += RUN) {
    let msbByte = 0
    for (let i = 0; i < RUN - 1; i++) {
      const byte = memory[inIndex++]
      dump[runStart + i] = byte & 0x7f
      msbByte |= ((byte >> 7) & 1) << i
    }
    dump[runStart + RUN - 1] = msbByte
  }
  dump[DUMP_SIZE - 1] = 0xf7
  return dump
}

/** Parte un dump completo en 16 mensajes de ~160 bytes (protocolo UnO 1.0.3+). */
export function packChunkedDump(memory: Uint8Array, deviceId = 0x01): number[][] {
  const full = packDump(memory, deviceId)
  const payload = full.slice(DATA_START, DATA_END)
  const chunks: number[][] = []
  const chunkPayload = 160
  for (let i = 0; i < 16; i++) {
    const start = i * chunkPayload
    const slice = payload.slice(start, start + chunkPayload)
    chunks.push([0xf0, 0x00, 0x20, 0x32, deviceId & 0x7f, 0x0c, 0x10, ...slice, 0xf7])
  }
  return chunks
}

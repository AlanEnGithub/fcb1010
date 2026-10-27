/**
 * Extensiones UnO sobre la imagen de memoria.
 *
 * El área 1600–2015 no está documentada públicamente por Ripwerx. Este editor
 * usa un overlay propio con marcador "UNO1" en 2008–2011. Si el marcador no
 * está presente, se preservan los bytes crudos y la UI usa valores por defecto
 * sin pisar el dump (salvo al guardar overlays nuevos).
 *
 * En firmware UnO el modo stompbox es GLOBAL (no por banco). La UI modular
 * reorganiza la vista en 19 bancos × 5 presets + 5 stomps cuando está activo.
 */

import {
  GLOBAL_CHANNELS,
  PRESET_COUNT,
  PRESET_END,
  UNO_EXT_END,
  UNO_EXT_START,
} from './model'

export type TriState = 'unchanged' | 'off' | 'on'
export type CcMode = 'normal' | 'toggle' | 'momentary'

export interface UnoPresetExtra {
  cc1Alt: number
  cc2Alt: number
  cc1Mode: CcMode
  cc2Mode: CcMode
  switch1: TriState
  switch2: TriState
  expA: TriState
  expB: TriState
  /** Enlace a cada stomp global al seleccionar este preset. */
  stompLinks: [TriState, TriState, TriState, TriState, TriState]
}

export interface UnoGlobal {
  stompboxMode: boolean
  /** true = fila superior (pedales 6–10); false = inferior (1–5) */
  stompboxUpperRow: boolean
  blockRepeatingPc: boolean
  /** En UnO, LED apagado = taptempo activo (lógica invertida del pedal). */
  tapTempoEnabled: boolean
  switch1Latched: boolean
  switch2Latched: boolean
  switch1Invert: boolean
  switch2Invert: boolean
  noteVelocity: number
}

const SLOT = 4
const OVERLAY_MAGIC = [0x55, 0x4e, 0x4f, 0x31] // UNO1
const OVERLAY_AT = 2008
const GLOBAL_AT = 2000

const TRI: TriState[] = ['unchanged', 'off', 'on']
const MODE: CcMode[] = ['normal', 'toggle', 'momentary']

function encodeTri(state: TriState): number {
  return Math.max(0, TRI.indexOf(state))
}

function decodeTri(bits: number): TriState {
  return TRI[bits & 0x03] ?? 'unchanged'
}

function encodeMode(mode: CcMode): number {
  return Math.max(0, MODE.indexOf(mode))
}

function decodeMode(bits: number): CcMode {
  return MODE[bits & 0x03] ?? 'normal'
}

export function createDefaultUnoGlobal(): UnoGlobal {
  return {
    stompboxMode: false,
    stompboxUpperRow: true,
    blockRepeatingPc: false,
    tapTempoEnabled: true,
    switch1Latched: true,
    switch2Latched: true,
    switch1Invert: false,
    switch2Invert: false,
    noteVelocity: 100,
  }
}

export function createDefaultUnoExtra(): UnoPresetExtra {
  return {
    cc1Alt: 0,
    cc2Alt: 0,
    cc1Mode: 'normal',
    cc2Mode: 'normal',
    switch1: 'unchanged',
    switch2: 'unchanged',
    expA: 'on',
    expB: 'on',
    stompLinks: ['unchanged', 'unchanged', 'unchanged', 'unchanged', 'unchanged'],
  }
}

export function hasUnoOverlay(memory: Uint8Array): boolean {
  return OVERLAY_MAGIC.every((b, i) => memory[OVERLAY_AT + i] === b)
}

export function ensureUnoOverlay(memory: Uint8Array): void {
  if (hasUnoOverlay(memory)) return
  // No pisar dumps UnO reales desconocidos: solo inicializar si el área
  // parece fábrica (todo 0xFF / 0x7F) o vacía.
  const slice = memory.subarray(UNO_EXT_START, UNO_EXT_END)
  const factoryLike = slice.every((b) => b === 0xff || b === 0x7f)
  if (!factoryLike) {
    // Marcar overlay sin borrar bytes existentes; solo escribir globals + magic
    // en la cola si están libres.
    const tailFree = memory
      .subarray(GLOBAL_AT, GLOBAL_CHANNELS)
      .every((b) => b === 0xff || b === 0x7f)
    if (!tailFree) return
  } else {
    memory.fill(0x00, UNO_EXT_START, UNO_EXT_END)
  }
  setUnoGlobal(memory, createDefaultUnoGlobal())
  for (let i = 0; i < PRESET_COUNT; i++) {
    setUnoPresetExtra(memory, i, createDefaultUnoExtra())
  }
  OVERLAY_MAGIC.forEach((b, i) => {
    memory[OVERLAY_AT + i] = b
  })
}

export function getUnoGlobal(memory: Uint8Array): UnoGlobal {
  if (!hasUnoOverlay(memory)) return createDefaultUnoGlobal()
  const f = memory[GLOBAL_AT]
  return {
    stompboxMode: (f & 0x01) !== 0,
    stompboxUpperRow: (f & 0x02) !== 0,
    blockRepeatingPc: (f & 0x04) !== 0,
    tapTempoEnabled: (f & 0x08) === 0,
    switch1Latched: (f & 0x10) !== 0,
    switch2Latched: (f & 0x20) !== 0,
    switch1Invert: (f & 0x40) !== 0,
    switch2Invert: (f & 0x80) !== 0,
    noteVelocity: memory[GLOBAL_AT + 1] & 0x7f,
  }
}

export function setUnoGlobal(memory: Uint8Array, global: UnoGlobal): void {
  let f = 0
  if (global.stompboxMode) f |= 0x01
  if (global.stompboxUpperRow) f |= 0x02
  if (global.blockRepeatingPc) f |= 0x04
  if (!global.tapTempoEnabled) f |= 0x08
  if (global.switch1Latched) f |= 0x10
  if (global.switch2Latched) f |= 0x20
  if (global.switch1Invert) f |= 0x40
  if (global.switch2Invert) f |= 0x80
  memory[GLOBAL_AT] = f
  memory[GLOBAL_AT + 1] = global.noteVelocity & 0x7f
  OVERLAY_MAGIC.forEach((b, i) => {
    memory[OVERLAY_AT + i] = b
  })
}

export function getUnoPresetExtra(memory: Uint8Array, index: number): UnoPresetExtra {
  if (!hasUnoOverlay(memory)) return createDefaultUnoExtra()
  const base = PRESET_END + index * SLOT
  const flags = memory[base + 2]
  const links = memory[base + 3]
  const stompLinks = [0, 1, 2, 3, 4].map((i) =>
    decodeTri((links >> (i * 2)) & 0x03),
  ) as UnoPresetExtra['stompLinks']
  // bits altos de flags: exp A/B tri-state en nibble alto de byte 2 via unused?
  // Usamos bits 4-7 de flags para switch modes; exp en bits altos de links no caben.
  // switch1: bits 4-5, switch2: bits 6-7 de flags
  // cc modes: bits 0-1 y 2-3
  // expA/expB se guardan empaquetados en GLOBAL_AT+2..3 por preset? No — usamos
  // los bits restantes del byte links no usados (solo 10 bits de 5 stomps).
  // Empaquetamos expA/expB en memory[GLOBAL_AT+2] area? Mejor: reutilizar
  // MSB de ExpA/B min en preset stock (preservados por model.ts).
  const p = index * 16
  const expA = msbToTri(memory[p + 10], memory[p + 11])
  const expB = msbToTri(memory[p + 13], memory[p + 14])
  return {
    cc1Alt: memory[base] & 0x7f,
    cc2Alt: memory[base + 1] & 0x7f,
    cc1Mode: decodeMode(flags & 0x03),
    cc2Mode: decodeMode((flags >> 2) & 0x03),
    switch1: decodeTri((flags >> 4) & 0x03),
    switch2: decodeTri((flags >> 6) & 0x03),
    expA,
    expB,
    stompLinks,
  }
}

function msbToTri(minByte: number, maxByte: number): TriState {
  const a = (minByte & 0x80) !== 0
  const b = (maxByte & 0x80) !== 0
  if (!a && !b) return 'unchanged'
  if (a && !b) return 'off'
  return 'on'
}

function triToMsb(state: TriState): [boolean, boolean] {
  switch (state) {
    case 'unchanged':
      return [false, false]
    case 'off':
      return [true, false]
    case 'on':
      return [true, true]
  }
}

export function setUnoPresetExtra(
  memory: Uint8Array,
  index: number,
  extra: UnoPresetExtra,
): void {
  const base = PRESET_END + index * SLOT
  memory[base] = extra.cc1Alt & 0x7f
  memory[base + 1] = extra.cc2Alt & 0x7f
  let flags = 0
  flags |= encodeMode(extra.cc1Mode) & 0x03
  flags |= (encodeMode(extra.cc2Mode) & 0x03) << 2
  flags |= (encodeTri(extra.switch1) & 0x03) << 4
  flags |= (encodeTri(extra.switch2) & 0x03) << 6
  memory[base + 2] = flags
  let links = 0
  extra.stompLinks.forEach((s, i) => {
    links |= (encodeTri(s) & 0x03) << (i * 2)
  })
  memory[base + 3] = links & 0xff
  const p = index * 16
  const [a0, a1] = triToMsb(extra.expA)
  const [b0, b1] = triToMsb(extra.expB)
  memory[p + 10] = (memory[p + 10] & 0x7f) | (a0 ? 0x80 : 0)
  memory[p + 11] = (memory[p + 11] & 0x7f) | (a1 ? 0x80 : 0)
  memory[p + 13] = (memory[p + 13] & 0x7f) | (b0 ? 0x80 : 0)
  memory[p + 14] = (memory[p + 14] & 0x7f) | (b1 ? 0x80 : 0)
  OVERLAY_MAGIC.forEach((b, i) => {
    memory[OVERLAY_AT + i] = b
  })
}

/** Índices de preset que actúan como stomps globales (fila fija). */
export function stompPresetIndices(upperRow: boolean): number[] {
  // En UnO, los 5 stomps son pedales 1-5 o 6-10 de cada banco físico,
  // pero el contenido MIDI vive en presets específicos. Usamos la convención
  // ControlCenter: stomps = presets 0-4 (fila baja) o 5-9 (fila alta) del
  // banco 0 como plantilla global — y la misma pedaleada en todos los bancos
  // comparte el estado LED. Para edición, mapeamos a índices 0–4 / 5–9 y
  // copiamos a todos los bancos al guardar si hace falta.
  return upperRow ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4]
}

/**
 * Vista modular UnO: con stompbox ON → 19 bancos de 5 presets + 5 stomps.
 * Los índices lógicos 0..94 son presets "normales"; 95..99 son stomps.
 */
export function logicalToPhysical(
  logicalIndex: number,
  stompboxMode: boolean,
  upperRow: boolean,
): number {
  if (!stompboxMode) return logicalIndex
  if (logicalIndex >= 95) {
    const stomp = logicalIndex - 95
    return stompPresetIndices(upperRow)[stomp]
  }
  // 19 bancos × 5: mapear a los 95 slots no-stomp del layout 10×10
  const bank = Math.floor(logicalIndex / 5)
  const ped = logicalIndex % 5
  if (upperRow) {
    // stomps arriba (5-9): presets usan pedales 1-5 → índices bank*10 + ped
    return bank * 10 + ped
  }
  // stomps abajo (0-4): presets usan pedales 6-10
  return bank * 10 + 5 + ped
}

export function physicalToLogical(
  physicalIndex: number,
  stompboxMode: boolean,
  upperRow: boolean,
): number | null {
  if (!stompboxMode) return physicalIndex
  const ped = physicalIndex % 10
  const bank = Math.floor(physicalIndex / 10)
  const stomps = stompPresetIndices(upperRow)
  const stompPos = stomps.indexOf(ped)
  if (stompPos >= 0) {
    // Solo editar stomps del banco 0 como canónicos
    if (bank !== 0) return null
    return 95 + stompPos
  }
  if (upperRow) {
    if (ped > 4) return null
    return bank * 5 + ped
  }
  if (ped < 5) return null
  return bank * 5 + (ped - 5)
}

export function syncStompsAcrossBanks(memory: Uint8Array, upperRow: boolean): void {
  const sources = stompPresetIndices(upperRow)
  for (let bank = 1; bank < 10; bank++) {
    for (let i = 0; i < 5; i++) {
      const src = sources[i]
      const dst = bank * 10 + (src % 10)
      memory.copyWithin(dst * 16, src * 16, src * 16 + 16)
      // Extra UnO
      if (hasUnoOverlay(memory)) {
        const srcBase = PRESET_END + src * SLOT
        const dstBase = PRESET_END + dst * SLOT
        memory.copyWithin(dstBase, srcBase, srcBase + SLOT)
      }
    }
  }
}

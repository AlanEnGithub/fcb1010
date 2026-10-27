import { createDefaultMemory, getGlobal, getPreset, setGlobal, setPreset, type FcbGlobal, type FcbPreset } from './model'
import {
  createDefaultUnoExtra,
  createDefaultUnoGlobal,
  ensureUnoOverlay,
  getUnoGlobal,
  getUnoPresetExtra,
  hasUnoOverlay,
  setUnoGlobal,
  setUnoPresetExtra,
  syncStompsAcrossBanks,
  type UnoGlobal,
  type UnoPresetExtra,
} from './uno'
import { dumpFromMemory, memoryFromDump } from '../midi/webMidi'
import type { FirmwareInfo } from './pack'

export interface EditorState {
  memory: Uint8Array
  deviceId: number
  selectedBank: number
  selectedPreset: number
  dirty: boolean
  names: string[]
  firmware: FirmwareInfo | null
  status: string
  useChunked: boolean
}

export function createInitialState(): EditorState {
  const memory = createDefaultMemory()
  ensureUnoOverlay(memory)
  return {
    memory,
    deviceId: 0x01,
    selectedBank: 0,
    selectedPreset: 0,
    dirty: false,
    names: Array.from({ length: 100 }, (_, i) => `Preset ${String(i).padStart(2, '0')}`),
    firmware: null,
    status: 'Listo — creá, importá o recibí un dump.',
    useChunked: false,
  }
}

export function loadDumpIntoState(state: EditorState, dump: Uint8Array): EditorState {
  const memory = memoryFromDump(dump)
  const deviceId = dump[4] & 0x7f
  if (!hasUnoOverlay(memory)) {
    // No destruir extensión desconocida; overlay solo si fábrica
    ensureUnoOverlay(memory)
  }
  return {
    ...state,
    memory,
    deviceId,
    dirty: false,
    status: 'Dump cargado.',
  }
}

export function exportDump(state: EditorState): Uint8Array {
  const memory = new Uint8Array(state.memory)
  const uno = getUnoGlobal(memory)
  if (uno.stompboxMode) {
    syncStompsAcrossBanks(memory, uno.stompboxUpperRow)
  }
  return dumpFromMemory(memory, state.deviceId)
}

export function readPreset(state: EditorState, index: number): {
  preset: FcbPreset
  uno: UnoPresetExtra
} {
  return {
    preset: getPreset(state.memory, index),
    uno: getUnoPresetExtra(state.memory, index),
  }
}

export function writePreset(
  state: EditorState,
  index: number,
  preset: FcbPreset,
  uno: UnoPresetExtra,
): EditorState {
  const memory = new Uint8Array(state.memory)
  setPreset(memory, index, preset)
  setUnoPresetExtra(memory, index, uno)
  return { ...state, memory, dirty: true, status: `Preset ${index} actualizado.` }
}

export function readGlobals(state: EditorState): { global: FcbGlobal; uno: UnoGlobal } {
  return {
    global: getGlobal(state.memory),
    uno: getUnoGlobal(state.memory),
  }
}

export function writeGlobals(
  state: EditorState,
  global: FcbGlobal,
  uno: UnoGlobal,
): EditorState {
  const memory = new Uint8Array(state.memory)
  // Direct Select y Stompbox son mutuamente excluyentes en UnO
  if (uno.stompboxMode && global.directSelect) {
    global = { ...global, directSelect: false }
  }
  setGlobal(memory, global)
  setUnoGlobal(memory, uno)
  return {
    ...state,
    memory,
    dirty: true,
    status: 'Configuración global actualizada.',
    useChunked: state.useChunked || (state.firmware?.isUno103OrLater ?? false),
  }
}

export function resetDefaults(): EditorState {
  const state = createInitialState()
  return { ...state, status: 'Setup de fábrica (con overlay UnO).', dirty: true }
}

export { createDefaultUnoExtra, createDefaultUnoGlobal }

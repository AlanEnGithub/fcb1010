/** Decodifica MIDI en vivo para resaltar pedales / mostrar actividad. */

export type LiveEvent =
  | { kind: 'pc'; channel: number; program: number; raw: string }
  | { kind: 'cc'; channel: number; controller: number; value: number; raw: string }
  | { kind: 'noteOn'; channel: number; note: number; velocity: number; raw: string }
  | { kind: 'noteOff'; channel: number; note: number; raw: string }
  | { kind: 'sysex'; length: number; raw: string }
  | { kind: 'other'; raw: string }

export function decodeMidiMessage(data: Uint8Array): LiveEvent | null {
  if (data.length === 0) return null
  const hex = [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ')
  if (data[0] === 0xf0) {
    return { kind: 'sysex', length: data.length, raw: hex }
  }
  const status = data[0] & 0xf0
  const channel = (data[0] & 0x0f) + 1
  switch (status) {
    case 0x90:
      if (data.length >= 3 && data[2] > 0) {
        return { kind: 'noteOn', channel, note: data[1], velocity: data[2], raw: hex }
      }
      return { kind: 'noteOff', channel, note: data[1] ?? 0, raw: hex }
    case 0x80:
      return { kind: 'noteOff', channel, note: data[1] ?? 0, raw: hex }
    case 0xc0:
      return { kind: 'pc', channel, program: data[1] ?? 0, raw: hex }
    case 0xb0:
      return {
        kind: 'cc',
        channel,
        controller: data[1] ?? 0,
        value: data[2] ?? 0,
        raw: hex,
      }
    default:
      return { kind: 'other', raw: hex }
  }
}

export function describeLiveEvent(ev: LiveEvent): string {
  switch (ev.kind) {
    case 'pc':
      return `PC ${ev.program + 1} · ch ${ev.channel}`
    case 'cc':
      return `CC ${ev.controller}=${ev.value} · ch ${ev.channel}`
    case 'noteOn':
      return `NoteOn ${ev.note} vel ${ev.velocity} · ch ${ev.channel}`
    case 'noteOff':
      return `NoteOff ${ev.note} · ch ${ev.channel}`
    case 'sysex':
      return `SysEx (${ev.length} bytes)`
    case 'other':
      return `MIDI ${ev.raw}`
  }
}

/**
 * Heurística: si llega un PC igual al número de preset del banco actual,
 * o un CC típico de stomp, sugerir pedal 1–10.
 */
export function guessPedalFromEvent(
  ev: LiveEvent,
  bank: number,
  memoryLookup?: (presetIndex: number) => { pc1: number; cc1?: number; cc2?: number },
): number | null {
  if (ev.kind === 'pc') {
    // Match preset cuyo PC1 habilitado == program en este banco
    for (let ped = 0; ped < 10; ped++) {
      const idx = bank * 10 + ped
      const info = memoryLookup?.(idx)
      if (info && info.pc1 === ev.program) return ped + 1
    }
    // Fallback: program % 10 como pedal
    return (ev.program % 10) + 1
  }
  if (ev.kind === 'cc' && memoryLookup) {
    for (let ped = 0; ped < 10; ped++) {
      const idx = bank * 10 + ped
      const info = memoryLookup(idx)
      if (info?.cc1 === ev.controller || info?.cc2 === ev.controller) return ped + 1
    }
  }
  if (ev.kind === 'noteOn' && memoryLookup) {
    for (let ped = 0; ped < 10; ped++) {
      const idx = bank * 10 + ped
      // note match would need note value — skip detailed for now
      void idx
    }
  }
  return null
}

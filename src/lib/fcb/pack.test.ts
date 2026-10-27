import { describe, expect, it } from 'vitest'
import { createDefaultMemory, getGlobal, getPreset, setPreset } from './model'
import { DUMP_SIZE, isFcbDump, packDump, unpackDump } from './pack'
import {
  createDefaultUnoExtra,
  ensureUnoOverlay,
  getUnoGlobal,
  getUnoPresetExtra,
  hasUnoOverlay,
  setUnoGlobal,
  setUnoPresetExtra,
} from './uno'

describe('pack/unpack', () => {
  it('round-trips default memory', () => {
    const memory = createDefaultMemory()
    const dump = packDump(memory)
    expect(dump.length).toBe(DUMP_SIZE)
    expect(isFcbDump(dump)).toBe(true)
    const again = unpackDump(dump)
    expect([...again]).toEqual([...memory])
  })

  it('preserves preset edits', () => {
    const memory = createDefaultMemory()
    const preset = getPreset(memory, 12)
    preset.pc[0] = { enabled: true, program: 42 }
    preset.cc1 = { enabled: true, controller: 7, value: 100 }
    preset.switch1 = true
    setPreset(memory, 12, preset)
    const round = unpackDump(packDump(memory))
    const got = getPreset(round, 12)
    expect(got.pc[0].program).toBe(42)
    expect(got.cc1.controller).toBe(7)
    expect(got.cc1.value).toBe(100)
    expect(got.switch1).toBe(true)
  })

  it('preserves global flags', () => {
    const memory = createDefaultMemory()
    const g = getGlobal(memory)
    expect(g.runningStatus).toBe(true)
    expect(g.directSelect).toBe(false)
  })
})

describe('uno overlay', () => {
  it('stores stompbox and alt CC', () => {
    const memory = createDefaultMemory()
    ensureUnoOverlay(memory)
    expect(hasUnoOverlay(memory)).toBe(true)
    setUnoGlobal(memory, {
      ...getUnoGlobal(memory),
      stompboxMode: true,
      stompboxUpperRow: false,
      noteVelocity: 90,
    })
    setUnoPresetExtra(memory, 3, {
      ...createDefaultUnoExtra(),
      cc1Alt: 0,
      cc2Alt: 127,
      cc1Mode: 'toggle',
      stompLinks: ['on', 'off', 'unchanged', 'unchanged', 'unchanged'],
    })
    const round = unpackDump(packDump(memory))
    const uno = getUnoGlobal(round)
    expect(uno.stompboxMode).toBe(true)
    expect(uno.stompboxUpperRow).toBe(false)
    expect(uno.noteVelocity).toBe(90)
    const extra = getUnoPresetExtra(round, 3)
    expect(extra.cc1Mode).toBe('toggle')
    expect(extra.cc2Alt).toBe(127)
    expect(extra.stompLinks[0]).toBe('on')
    expect(extra.stompLinks[1]).toBe('off')
  })
})

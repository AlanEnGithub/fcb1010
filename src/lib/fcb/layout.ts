import type { UnoGlobal } from './uno'

export interface PedalCell {
  physicalIndex: number
  label: string
  kind: 'preset' | 'stomp'
}

export interface BankView {
  label: string
  pedals: PedalCell[]
}

function mapStompBankPedal(logical: number, upperRow: boolean): number {
  const bank = Math.floor(logical / 5)
  const ped = logical % 5
  if (bank < 10) {
    return upperRow ? bank * 10 + ped : bank * 10 + 5 + ped
  }
  const b = bank - 10
  return upperRow ? b * 10 + 5 + ped : b * 10 + ped
}

/** Construye la vista de bancos según el modo UnO activo. */
export function buildBankViews(uno: UnoGlobal): BankView[] {
  if (!uno.stompboxMode) {
    return Array.from({ length: 10 }, (_, bank) => ({
      label: String(bank).padStart(2, '0'),
      pedals: Array.from({ length: 10 }, (_, ped) => ({
        physicalIndex: bank * 10 + ped,
        label: String(ped + 1),
        kind: 'preset' as const,
      })),
    }))
  }

  const views: BankView[] = []
  for (let bank = 0; bank < 19; bank++) {
    const presets: PedalCell[] = []
    for (let i = 0; i < 5; i++) {
      const logical = bank * 5 + i
      presets.push({
        physicalIndex: mapStompBankPedal(logical, uno.stompboxUpperRow),
        label: String(i + 1),
        kind: 'preset',
      })
    }
    const stompBase = uno.stompboxUpperRow ? 5 : 0
    const stomps: PedalCell[] = Array.from({ length: 5 }, (_, i) => ({
      physicalIndex: stompBase + i,
      label: `S${i + 1}`,
      kind: 'stomp' as const,
    }))

    // Orden visual: inferior 1–5, superior 6–10
    const pedals = uno.stompboxUpperRow
      ? [...presets, ...stomps]
      : [...stomps, ...presets]

    views.push({
      label: String(bank).padStart(2, '0'),
      pedals,
    })
  }
  return views
}

export function boardRows(view: BankView): [PedalCell[], PedalCell[]] {
  return [view.pedals.slice(5, 10), view.pedals.slice(0, 5)]
}

import { boardRows, type BankView } from '../lib/fcb/layout'

interface Props {
  banks: BankView[]
  selectedBank: number
  selectedPreset: number
  names: string[]
  onSelectBank: (bank: number) => void
  onSelectPreset: (index: number) => void
}

export function PresetBoard({
  banks,
  selectedBank,
  selectedPreset,
  names,
  onSelectBank,
  onSelectPreset,
}: Props) {
  const view = banks[selectedBank] ?? banks[0]
  if (!view) return null
  const [upper, lower] = boardRows(view)

  return (
    <div>
      <div className="bank-tabs" role="tablist" aria-label="Bancos">
        {banks.map((b, i) => (
          <button
            key={b.label}
            type="button"
            className={`bank-tab${i === selectedBank ? ' active' : ''}`}
            onClick={() => onSelectBank(i)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="pedal-board" aria-label={`Banco ${view.label}`}>
        <div className="pedal-row">
          {upper.map((cell) => (
            <PedalButton
              key={`${cell.kind}-${cell.physicalIndex}-${cell.label}`}
              cell={cell}
              selected={selectedPreset === cell.physicalIndex}
              name={names[cell.physicalIndex] ?? ''}
              onSelect={onSelectPreset}
            />
          ))}
        </div>
        <div className="pedal-row">
          {lower.map((cell) => (
            <PedalButton
              key={`${cell.kind}-${cell.physicalIndex}-${cell.label}`}
              cell={cell}
              selected={selectedPreset === cell.physicalIndex}
              name={names[cell.physicalIndex] ?? ''}
              onSelect={onSelectPreset}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PedalButton({
  cell,
  selected,
  name,
  onSelect,
}: {
  cell: BankView['pedals'][number]
  selected: boolean
  name: string
  onSelect: (index: number) => void
}) {
  return (
    <button
      type="button"
      className={`pedal${selected ? ' selected' : ''}${cell.kind === 'stomp' ? ' stomp' : ''}`}
      onClick={() => onSelect(cell.physicalIndex)}
    >
      <span className="num">{cell.label}</span>
      <span className="name">{name}</span>
    </button>
  )
}

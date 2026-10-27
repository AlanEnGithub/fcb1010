/**
 * Pedalera FCB1010 ilustrada (SVG) con hotspots clickeables.
 * Layout real: Exp A/B a la izquierda, display + UP/DOWN, filas 6–10 / 1–5.
 */

export interface PedalboardVisualProps {
  bank: number
  /** Pedal 1–10 seleccionado (UI), o null */
  selectedPedal: number | null
  /** Pedal 1–10 resaltado por MIDI en vivo */
  livePedal: number | null
  stompboxMode: boolean
  stompboxUpperRow: boolean
  names: string[]
  /** Índice físico 0–99 del preset bajo el pedal */
  presetIndexForPedal: (pedal: number) => number
  onSelectPedal: (pedal: number) => void
  onBankUp: () => void
  onBankDown: () => void
}

export function PedalboardVisual({
  bank,
  selectedPedal,
  livePedal,
  stompboxMode,
  stompboxUpperRow,
  names,
  presetIndexForPedal,
  onSelectPedal,
  onBankUp,
  onBankDown,
}: PedalboardVisualProps) {
  const isStomp = (pedal: number) => {
    if (!stompboxMode) return false
    if (stompboxUpperRow) return pedal >= 6
    return pedal <= 5
  }

  const foot = (pedal: number, cx: number, cy: number) => {
    const selected = selectedPedal === pedal
    const live = livePedal === pedal
    const stomp = isStomp(pedal)
    const idx = presetIndexForPedal(pedal)
    const name = names[idx] ?? ''
    return (
      <g
        key={pedal}
        className="hotspot"
        role="button"
        tabIndex={0}
        aria-label={`Pedal ${pedal}${stomp ? ' stomp' : ''} — ${name}`}
        aria-pressed={selected}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onSelectPedal(pedal)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectPedal(pedal)
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <ellipse
          cx={cx}
          cy={cy}
          rx={38}
          ry={28}
          className={[
            'fs-pad',
            selected ? 'is-selected' : '',
            live ? 'is-live' : '',
            stomp ? 'is-stomp' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" className="fs-num">
          {stomp ? `S${((pedal - 1) % 5) + 1}` : pedal}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fs-name">
          {truncate(name, 10)}
        </text>
      </g>
    )
  }

  return (
    <div className="board-visual">
      <svg
        viewBox="0 0 720 360"
        role="img"
        aria-label="Pedalera Behringer FCB1010 — clickeá un pedal para editarlo"
      >
        <defs>
          <linearGradient id="chassis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4550" />
            <stop offset="100%" stopColor="#1e262d" />
          </linearGradient>
          <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6a7580" />
            <stop offset="100%" stopColor="#3d4650" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Chassis */}
        <rect x="8" y="8" width="704" height="344" rx="18" fill="url(#chassis)" stroke="#0d1216" strokeWidth="3" />
        <rect x="20" y="20" width="680" height="320" rx="12" fill="none" stroke="#4a5864" strokeWidth="1" opacity="0.5" />

        {/* Expression pedals */}
        <g className="exp-group">
          <rect x="36" y="48" width="86" height="150" rx="10" fill="url(#metal)" stroke="#222" />
          <text x="79" y="210" textAnchor="middle" className="label">
            Exp A
          </text>
          <rect x="136" y="48" width="86" height="150" rx="10" fill="url(#metal)" stroke="#222" />
          <text x="179" y="210" textAnchor="middle" className="label">
            Exp B
          </text>
          {/* rocker caps */}
          <rect x="48" y="70" width="62" height="90" rx="6" fill="#2a323a" opacity="0.85" />
          <rect x="148" y="70" width="62" height="90" rx="6" fill="#2a323a" opacity="0.85" />
        </g>

        {/* Display + UP/DOWN */}
        <g>
          <rect x="260" y="40" width="120" height="56" rx="6" fill="#0a0e12" stroke="#e07a3a" strokeWidth="1.5" />
          <text x="320" y="76" textAnchor="middle" className="display-digits">
            {String(bank).padStart(2, '0')}
          </text>
          <text x="320" y="112" textAnchor="middle" className="label">
            BANK
          </text>

          <g
            className="hotspot"
            role="button"
            tabIndex={0}
            aria-label="Bank up"
            onClick={onBankUp}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBankUp()
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x="400" y="40" width="64" height="36" rx="8" className="nav-pad" />
            <text x="432" y="64" textAnchor="middle" className="fs-num">
              UP
            </text>
          </g>
          <g
            className="hotspot"
            role="button"
            tabIndex={0}
            aria-label="Bank down"
            onClick={onBankDown}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onBankDown()
            }}
            style={{ cursor: 'pointer' }}
          >
            <rect x="474" y="40" width="64" height="36" rx="8" className="nav-pad" />
            <text x="506" y="64" textAnchor="middle" className="fs-num">
              DN
            </text>
          </g>
        </g>

        {/* Brand */}
        <text x="600" y="58" textAnchor="middle" className="brand-mark">
          FCB1010
        </text>
        <text x="600" y="76" textAnchor="middle" className="label">
          {stompboxMode ? 'UnO · STOMP' : 'UnO'}
        </text>

        {/* Upper footswitches 6-10 */}
        {[6, 7, 8, 9, 10].map((pedal, i) => foot(pedal, 280 + i * 84, 190))}
        {/* Lower footswitches 1-5 */}
        {[1, 2, 3, 4, 5].map((pedal, i) => foot(pedal, 280 + i * 84, 280))}
      </svg>

      <p className="board-hint">
        Clickeá un pedal para editarlo. UP/DN cambian de banco. El anillo naranja = selección;
        el verde parpadea con MIDI en vivo desde la pedalera.
      </p>
    </div>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return `${s.slice(0, n - 1)}…`
}

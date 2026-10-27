import type { LiveEvent } from '../lib/midi/decodeLive'
import { describeLiveEvent } from '../lib/midi/decodeLive'

export interface ActivityItem {
  id: string
  at: string
  text: string
  event?: LiveEvent
}

interface Props {
  items: ActivityItem[]
  selectedLabel: string
}

export function ActivityLog({ items, selectedLabel }: Props) {
  return (
    <div className="panel activity-panel">
      <h2>Actividad</h2>
      <p className="selected-banner" aria-live="polite">
        Seleccionado: <strong>{selectedLabel}</strong>
      </p>
      <ul className="activity-list">
        {items.length === 0 ? (
          <li className="hint">Pisá un pedal en la FCB1010 o clickeá en la ilustración…</li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <span className="mono time">{item.at}</span>
              <span>
                {item.event ? describeLiveEvent(item.event) : null}
                {item.event && item.text ? ' · ' : null}
                {item.text || null}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

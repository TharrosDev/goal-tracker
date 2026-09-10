import { useEffect, useRef } from 'react'
import type { Period } from '@/domain/history'
import { fmtDateShort } from '@/domain/date'

/** A proportional landscape of the factual period fold. Empty time has zero height. */
export function TimeStrata({
  periods,
  selected,
  peak,
  onSelect,
}: {
  periods: Period[]
  selected: string | undefined
  peak: number
  onSelect: (key: string) => void
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const width = periods.length * 76
  const points = periods.map((p, i) => `${i * 76 + 38},${220 - (p.merit / peak) * 175}`).join(' ')
  useEffect(() => {
    const node = viewport.current
    const index = periods.findIndex((p) => p.key === selected)
    if (node && index >= 0) node.scrollLeft = Math.max(0, index * 76 - node.clientWidth / 2 + 38)
  }, [selected, periods])
  return (
    <div className="time-strata" ref={viewport}>
      <div className="time-strata__land" style={{ width }}>
        <svg width={width} height={260} viewBox={`0 0 ${width} 260`} aria-hidden="true">
          <polygon points={`0,220 ${points} ${width},220`} fill="var(--ground-raised)" />
          <polyline points={points} stroke="var(--accent)" strokeWidth={2} fill="none" />
          <line x1={0} x2={width} y1={220} y2={220} stroke="var(--rule-strong)" />
          {periods.map((p, i) => (
            <g key={p.key}>
              {p.key === selected && (
                <line
                  x1={i * 76 + 38}
                  x2={i * 76 + 38}
                  y1={20}
                  y2={240}
                  stroke="var(--ink)"
                  strokeDasharray="3 5"
                />
              )}
              {p.taken > 0 && (
                <>
                  <line
                    x1={i * 76 + 38}
                    x2={i * 76 + 38}
                    y1={220 - (p.merit / peak) * 175}
                    y2={200 - (p.merit / peak) * 175}
                    stroke="var(--accent)"
                    strokeWidth={3}
                  />
                  <circle
                    cx={i * 76 + 38}
                    cy={195 - (p.merit / peak) * 175}
                    r={5}
                    fill="var(--accent)"
                  />
                </>
              )}
            </g>
          ))}
        </svg>
        <ol className="time-strata__periods">
          {periods.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                aria-pressed={p.key === selected}
                onClick={() => onSelect(p.key)}
              >
                <span>{fmtDateShort(p.from)}</span>
                <span className="num">{p.merit}</span>
                <span className="sr-only">
                  merit, {p.dispatches} dispatches, {p.taken} taken
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

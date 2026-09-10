import { useNavigate } from 'react-router'
import type { GoalView } from '@/state/selectors'

export function CampaignIntel({ views }: { views: GoalView[] }) {
  const navigate = useNavigate()
  const dated = views.filter((v) => v.paceGap !== null)
  if (!dated.length) return null
  return (
    <section className="intelligence">
      <h2 className="h2">THE DISTANCE TO THE LINE</h2>
      <p className="lede">
        Left to right: expected progress. Height: actual progress. Above the diagonal is ahead of
        pace.
      </p>
      <svg
        viewBox="0 0 900 300"
        role="img"
        aria-label="Actual progress against expected progress for dated standards. Exact values follow."
      >
        <line x1={65} y1={255} x2={860} y2={30} stroke="var(--rule-strong)" />
        <path d="M65 30 V255 H860" stroke="var(--rule-strong)" fill="none" />
        {[0, 50, 100].map((n) => (
          <g key={n}>
            <text x={40} y={260 - n * 2.25} fill="var(--ink-dim)" fontSize={16} textAnchor="end">
              {n}
            </text>
            <text x={65 + n * 7.95} y={285} fill="var(--ink-dim)" fontSize={16} textAnchor="middle">
              {n}%
            </text>
          </g>
        ))}
        {dated.map((v) => {
          const x = 65 + Math.max(0, Math.min(1, v.fraction + (v.paceGap ?? 0))) * 795
          const y = 255 - v.fraction * 225
          return (
            <g key={v.goal.id}>
              <line
                x1={x}
                x2={x}
                y1={y}
                y2={255 - ((x - 65) / 795) * 225}
                stroke={v.behind ? 'var(--caution)' : 'var(--ok)'}
                strokeDasharray="3 4"
              />
              <circle
                cx={x}
                cy={y}
                r={v.goal.boss ? 9 : 5}
                fill="var(--ground)"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            </g>
          )
        })}
      </svg>
      <ul className="intelligence__roll">
        {dated.map((v) => (
          <li key={v.goal.id}>
            <button type="button" onClick={() => navigate(`/standard/${v.goal.id}`)}>
              <span>{v.goal.title}</span>
              <span className="num">
                {Math.round(v.fraction * 100)}% · {Math.round(Math.abs(v.paceGap ?? 0) * 100)}{' '}
                POINTS {(v.paceGap ?? 0) > 0 ? 'BEHIND' : 'AHEAD'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

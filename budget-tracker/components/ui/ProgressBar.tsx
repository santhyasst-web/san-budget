interface Props {
  actual: number
  budgeted: number
}

export function ProgressBar({ actual, budgeted }: Props) {
  const pct = budgeted > 0 ? Math.min((actual / budgeted) * 100, 100) : 0
  let color = '#30a46c'
  if (pct >= 100) color = '#e5484d'
  else if (pct >= 75) color = '#f97316'
  else if (pct >= 50) color = '#f59e0b'

  return (
    <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'var(--surface3)', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: color,
        borderRadius: 3, transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: pct >= 75 ? `0 0 6px ${color}80` : 'none',
      }} />
    </div>
  )
}

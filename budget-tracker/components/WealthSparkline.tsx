'use client'

import { useState } from 'react'

interface Props {
  values: number[]
  labels: string[]
}

export function WealthSparkline({ values, labels }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null)

  if (values.length < 2) return null

  const w = 200, h = 48
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const trend = values[values.length - 1] >= values[0]
  const color = trend ? '#30a46c' : '#e5484d'

  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 8) - 4,
    value: v,
    label: labels[i] ?? '',
  }))

  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={w} height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ overflow: 'visible', display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <polyline
          points={pts.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round"
        />
        {pts.map((pt, i) => (
          <g key={i}>
            {/* Larger invisible hit area */}
            <circle
              cx={pt.x} cy={pt.y} r={14}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => setTooltip(
                tooltip?.label === pt.label
                  ? null
                  : { x: pt.x, y: pt.y, label: pt.label, value: fmt(pt.value) }
              )}
              onMouseEnter={() => setTooltip({ x: pt.x, y: pt.y, label: pt.label, value: fmt(pt.value) })}
            />
            {/* Visible dot */}
            <circle
              cx={pt.x} cy={pt.y}
              r={i === pts.length - 1 ? 4 : 2.5}
              fill={color}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y - 36,
          transform: 'translateX(-50%)',
          background: 'var(--surface3)',
          border: '1px solid var(--border2)',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          <div style={{ color: 'var(--text3)', fontSize: 10, fontWeight: 600 }}>{tooltip.label}</div>
          <div style={{ color }}>{tooltip.value}</div>
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { formatCAD } from '@/lib/calculations/monthlySummary'
import type { Transaction } from '@/lib/supabase/types'

interface Props {
  monthId: string
  year: number
  month: number
  transactions: Transaction[]
}

function getWeekRanges(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const ranges: Array<{ start: number; end: number }> = []
  const firstWeekEnd = Math.min(7 - firstDow, daysInMonth)
  ranges.push({ start: 1, end: firstWeekEnd })
  let day = firstWeekEnd + 1
  while (day <= daysInMonth) {
    ranges.push({ start: day, end: Math.min(day + 6, daysInMonth) })
    day += 7
  }
  return ranges
}

function compute(year: number, month: number, transactions: Transaction[]) {
  const now = new Date()
  const ranges = getWeekRanges(year, month)
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayDay = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate()
  const range = ranges.find(r => todayDay >= r.start && todayDay <= r.end) ?? ranges[ranges.length - 1]
  const spent = transactions
    .filter(t => { const d = parseInt(t.date.split('-')[2], 10); return d >= range.start && d <= range.end })
    .reduce((s, t) => s + (t.is_shared ? (t.share_split === 'full' ? 0 : Number(t.amount) * 0.5) : Number(t.amount)), 0)
  return { spent, range }
}

export function WeeklyTile({ monthId, year, month, transactions }: Props) {
  const [result, setResult] = useState<{ spent: number; range: { start: number; end: number } } | null>(null)

  useEffect(() => {
    // Runs only on the client — correct local timezone guaranteed
    setResult(compute(year, month, transactions))
  }, [year, month, transactions])

  return (
    <Link href={`/dashboard/${monthId}/transactions`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'linear-gradient(135deg,#1a2e5a,#0d1a40)', border: '1px solid #60a5fa30', borderRadius: 18, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 4px 20px #60a5fa18' }}>
        <span style={{ fontSize: 28 }}>🗓️</span>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Weekly</div>
        <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>
          {result ? `${formatCAD(result.spent)} · ${result.range.start}–${result.range.end}` : '—'}
        </div>
      </div>
    </Link>
  )
}

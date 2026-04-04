'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { computeMonthlySummary, getVariableActualByCategory, formatCAD, getMonthName } from '@/lib/calculations/monthlySummary'
import type { Transaction, VariableBudget, FixedExpense, Investment } from '@/lib/supabase/types'
import Link from 'next/link'

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ segments, size = 180, thickness = 32, centerLabel, centerSub }: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}) {
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = 0
  const arcs = segments.map(seg => {
    const pct = total > 0 ? seg.value / total : 0
    const dash = pct * circumference
    const gap = circumference - dash
    const arc = { ...seg, dash, gap, offset }
    offset += dash
    return arc
  })

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth={thickness} />
      ) : (
        arcs.map((arc, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={thickness}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          />
        ))
      )}
      {/* Center text — counter-rotate */}
      {centerLabel && (
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fill: 'var(--text)', fontSize: 15, fontWeight: 800 }}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, fill: 'var(--text3)', fontSize: 10, fontWeight: 600 }}>
          {centerSub}
        </text>
      )}
    </svg>
  )
}

// ── Legend row ───────────────────────────────────────────────────────────────
function Legend({ items }: { items: { label: string; value: string; color: string; pct: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{item.value} · {item.pct}%</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '20px 2px 10px' }}>
      {title}
    </div>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', ...style }}>
      {children}
    </div>
  )
}

// ── Weekly bar chart ─────────────────────────────────────────────────────────
function WeeklyBars({ weekTotals, max }: { weekTotals: number[]; max: number }) {
  const colors = ['#7c6fcd', '#7c6fcd', '#7c6fcd', '#7c6fcd', '#7c6fcd']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
      {weekTotals.map((total, i) => {
        const pct = max > 0 ? (total / max) * 100 : 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>{formatCAD(total).replace('CA$', '$')}</div>
            <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: colors[i], borderRadius: '4px 4px 0 0', minHeight: total > 0 ? 4 : 2, opacity: total > 0 ? 1 : 0.2 }} />
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700 }}>W{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Budget vs actual horizontal bars ────────────────────────────────────────
function BudgetActualBar({ label, actual, budgeted, color }: { label: string; actual: number; budgeted: number; color: string }) {
  const pct = budgeted > 0 ? Math.min((actual / budgeted) * 100, 100) : 0
  const over = actual > budgeted
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
        <span style={{ fontSize: 11, color: over ? 'var(--red)' : 'var(--text3)' }}>
          {formatCAD(actual)} / {formatCAD(budgeted)}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ── Savings rate gauge ───────────────────────────────────────────────────────
function SavingsGauge({ pct }: { pct: number }) {
  const size = 140
  const r = 50
  const cx = 70
  const cy = 80
  const circumference = Math.PI * r // semicircle
  const filled = Math.min(pct / 100, 1) * circumference
  const target = 0.20 * circumference // 20% target marker

  return (
    <svg width={size} height={90} viewBox={`0 0 ${size} 90`}>
      {/* Track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="var(--surface3)" strokeWidth={14} strokeLinecap="round" />
      {/* Fill */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={pct >= 20 ? '#30a46c' : pct >= 10 ? '#f59e0b' : '#e5484d'}
        strokeWidth={14} strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
      {/* 20% target line */}
      <line
        x1={cx - r * Math.cos(Math.PI * 0.8)}
        y1={cy - r * Math.sin(Math.PI * 0.8)}
        x2={(cx - r * Math.cos(Math.PI * 0.8)) * 0.97 + cx * 0.03}
        y2={(cy - r * Math.sin(Math.PI * 0.8)) * 0.97 + cy * 0.03}
        stroke="#fff" strokeWidth={2}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text)" fontSize={22} fontWeight={800}>{pct.toFixed(1)}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text3)" fontSize={9} fontWeight={600}>SAVINGS RATE</text>
      <text x={cx - r - 4} y={cy + 16} textAnchor="middle" fill="var(--text3)" fontSize={8}>0%</text>
      <text x={cx + r + 4} y={cy + 16} textAnchor="middle" fill="var(--text3)" fontSize={8}>100%</text>
    </svg>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ChartsPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState<{ month: number; year: number; salary: number; rent_income: number; other_income: number } | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [variableBudgets, setVariableBudgets] = useState<VariableBudget[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('months').select('*').eq('id', monthId).single(),
      supabase.from('transactions').select('*').eq('month_id', monthId),
      supabase.from('variable_budget').select('*').eq('month_id', monthId),
      supabase.from('fixed_expenses').select('*').eq('month_id', monthId),
      supabase.from('investments').select('*').eq('month_id', monthId),
    ]).then(([{ data: m }, { data: txns }, { data: vb }, { data: fe }, { data: inv }]) => {
      setMonth(m)
      setTransactions(txns ?? [])
      setVariableBudgets(vb ?? [])
      setFixedExpenses(fe ?? [])
      setInvestments(inv ?? [])
      setLoading(false)
    })
  }, [monthId])

  if (loading || !month) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>Loading charts...</div>
      </div>
    )
  }

  const summary = computeMonthlySummary(
    Number(month.salary), Number(month.rent_income), Number(month.other_income ?? 0),
    fixedExpenses, variableBudgets, transactions, investments
  )
  const variableActuals = getVariableActualByCategory(transactions)
  const remaining = Math.max(0, summary.total_income - summary.total_actual)
  const savingsPct = summary.total_income > 0 ? (summary.total_investments_actual / summary.total_income) * 100 : 0

  // Income allocation donut segments
  const allocationSegments = [
    { label: 'Fixed', value: summary.total_fixed_actual, color: '#e5484d' },
    { label: 'Variable', value: summary.total_variable_actual, color: '#f97316' },
    { label: 'Investments', value: summary.total_investments_actual, color: '#30a46c' },
    { label: 'Remaining', value: remaining, color: '#7c6fcd' },
  ].filter(s => s.value > 0)

  // Variable spending donut
  const CATEGORY_COLORS: Record<string, string> = {
    'Grocery': '#30a46c', 'Outside Food': '#f97316', 'Skin Care': '#a78bfa',
    'Hair Care': '#60a5fa', 'Home Expense': '#f59e0b', 'Misc': '#94a3b8',
    'Business Expense': '#38bdf8', 'Uber': '#c084fc', 'Books': '#fb7185',
  }
  const variableSegments = variableBudgets.map(b => ({
    label: b.category,
    value: variableActuals[b.category] ?? 0,
    color: CATEGORY_COLORS[b.category] ?? '#94a3b8',
  })).filter(s => s.value > 0)

  // Weekly totals
  const weekTotals = [1, 2, 3, 4, 5].map(w =>
    transactions.filter(t => t.week_number === w && !t.is_shared).reduce((s, t) => s + Number(t.amount), 0)
  )
  const maxWeek = Math.max(...weekTotals, 1)

  const allocationTotal = allocationSegments.reduce((s, seg) => s + seg.value, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={`/dashboard/${monthId}`} style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Summary</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Charts</span>
          <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>{getMonthName(month.month)}</span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* ── Income Allocation Donut ── */}
        <SectionHeader title="INCOME ALLOCATION" />
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <DonutChart
              segments={allocationSegments.length > 0 ? allocationSegments : [{ label: 'No data', value: 1, color: 'var(--surface3)' }]}
              size={160} thickness={28}
              centerLabel={formatCAD(summary.total_income).replace('CA', '')}
              centerSub="INCOME"
            />
            <Legend items={allocationSegments.map(s => ({
              label: s.label,
              value: formatCAD(s.value),
              color: s.color,
              pct: allocationTotal > 0 ? ((s.value / allocationTotal) * 100).toFixed(1) : '0',
            }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              { label: 'Fixed', value: formatCAD(summary.total_fixed_actual), color: '#e5484d' },
              { label: 'Variable', value: formatCAD(summary.total_variable_actual), color: '#f97316' },
              { label: 'Invested', value: formatCAD(summary.total_investments_actual), color: '#30a46c' },
              { label: 'Remaining', value: formatCAD(remaining), color: '#7c6fcd' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Savings Rate Gauge ── */}
        <SectionHeader title="SAVINGS RATE" />
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <SavingsGauge pct={savingsPct} />
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            Target: <span style={{ color: '#fff', fontWeight: 600 }}>20%</span> · Invested {formatCAD(summary.total_investments_actual)} of {formatCAD(summary.total_income)} income
          </div>
          <div style={{ fontSize: 11, color: savingsPct >= 20 ? 'var(--green)' : 'var(--orange)', fontWeight: 700 }}>
            {savingsPct >= 20 ? '✓ On track' : `${(20 - savingsPct).toFixed(1)}% below target`}
          </div>
        </Card>

        {/* ── Variable Spending Donut ── */}
        {variableSegments.length > 0 && (
          <>
            <SectionHeader title="VARIABLE SPENDING BREAKDOWN" />
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <DonutChart
                  segments={variableSegments}
                  size={160} thickness={28}
                  centerLabel={formatCAD(summary.total_variable_actual).replace('CA', '')}
                  centerSub="VARIABLE"
                />
                <Legend items={variableSegments.map(s => ({
                  label: s.label,
                  value: formatCAD(s.value),
                  color: s.color,
                  pct: summary.total_variable_actual > 0 ? ((s.value / summary.total_variable_actual) * 100).toFixed(1) : '0',
                }))} />
              </div>
            </Card>
          </>
        )}

        {/* ── Weekly spending bar chart ── */}
        <SectionHeader title="WEEKLY SPENDING" />
        <Card>
          <WeeklyBars weekTotals={weekTotals} max={maxWeek} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Total: {formatCAD(weekTotals.reduce((s, w) => s + w, 0))}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Avg/week: {formatCAD(weekTotals.filter(w => w > 0).reduce((s, w, _, a) => s + w / a.length, 0))}</span>
          </div>
        </Card>

        {/* ── Budget vs Actual ── */}
        {variableBudgets.length > 0 && (
          <>
            <SectionHeader title="BUDGET VS ACTUAL" />
            <Card>
              {variableBudgets.map(b => {
                const actual = variableActuals[b.category] ?? 0
                const pct = Number(b.budgeted) > 0 ? (actual / Number(b.budgeted)) * 100 : 0
                const color = pct >= 100 ? '#e5484d' : pct >= 75 ? '#f97316' : '#30a46c'
                return (
                  <BudgetActualBar key={b.id} label={b.category} actual={actual} budgeted={Number(b.budgeted)} color={color} />
                )
              })}
            </Card>
          </>
        )}

        {/* ── Investment progress ── */}
        {investments.length > 0 && (
          <>
            <SectionHeader title="INVESTMENT PROGRESS" />
            <Card>
              {investments.map(inv => (
                <BudgetActualBar key={inv.id} label={inv.vehicle} actual={Number(inv.actual ?? 0)} budgeted={Number(inv.budgeted)} color="#30a46c" />
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Total invested</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{formatCAD(summary.total_investments_actual)}</span>
              </div>
            </Card>
          </>
        )}

      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

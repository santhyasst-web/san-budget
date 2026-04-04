import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { computeMonthlySummary, getVariableActualByCategory, getMonthName, formatCAD } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'

const CATEGORY_ICONS: Record<string, { icon: string; grad: string }> = {
  // Variable
  'Grocery':          { icon: '🛒', grad: 'linear-gradient(135deg,#1a4a2e,#0d2e1a)' },
  'Outside Food':     { icon: '🍜', grad: 'linear-gradient(135deg,#4a2e1a,#2e1a0d)' },
  'Skin Care':        { icon: '✨', grad: 'linear-gradient(135deg,#2e1a4a,#1a0d2e)' },
  'Hair Care':        { icon: '💇', grad: 'linear-gradient(135deg,#1a3a4a,#0d1e2e)' },
  'Home Expense':     { icon: '🏠', grad: 'linear-gradient(135deg,#4a3a1a,#2e240d)' },
  'Misc':             { icon: '📦', grad: 'linear-gradient(135deg,#2a2a4a,#1a1a2e)' },
  'Business Expense': { icon: '💼', grad: 'linear-gradient(135deg,#1a2a4a,#0d1a2e)' },
  'Uber':             { icon: '🚗', grad: 'linear-gradient(135deg,#3a1a4a,#200d2e)' },
  'Books':            { icon: '📚', grad: 'linear-gradient(135deg,#4a1a1a,#2e0d0d)' },
  // Fixed
  'Mortgage':         { icon: '🏡', grad: 'linear-gradient(135deg,#1a3a4a,#0d2030)' },
  'Utilities':        { icon: '⚡', grad: 'linear-gradient(135deg,#4a3a00,#2e2400)' },
  'Phone':            { icon: '📱', grad: 'linear-gradient(135deg,#1a2e4a,#0d1a2e)' },
  'Internet':         { icon: '🌐', grad: 'linear-gradient(135deg,#0d2a4a,#071a2e)' },
  'YouTube Premium':  { icon: '▶️', grad: 'linear-gradient(135deg,#4a0d0d,#2e0707)' },
  'IPTV':             { icon: '📺', grad: 'linear-gradient(135deg,#1a1a4a,#0d0d2e)' },
  'Property Tax':     { icon: '🏛️', grad: 'linear-gradient(135deg,#2e2a1a,#1e1a0d)' },
  'Home Insurance':   { icon: '🛡️', grad: 'linear-gradient(135deg,#1a3a2a,#0d2018)' },
  'Movati':           { icon: '💪', grad: 'linear-gradient(135deg,#3a1a2e,#200d1a)' },
  // Investments
  'Mortgage Accelerated': { icon: '🏠', grad: 'linear-gradient(135deg,#1a3a4a,#0d2030)' },
  'WealthSimple':         { icon: '📈', grad: 'linear-gradient(135deg,#1a4a2e,#0d2e1a)' },
  'Questrade TFSA':       { icon: '💹', grad: 'linear-gradient(135deg,#0d3a1a,#07200d)' },
  'Questrade RRSP':       { icon: '🏦', grad: 'linear-gradient(135deg,#1a2a4a,#0d1a30)' },
  'Scotia':               { icon: '🏧', grad: 'linear-gradient(135deg,#4a0d0d,#2e0707)' },
}

function IconBox({ category }: { category: string }) {
  const meta = CATEGORY_ICONS[category] ?? { icon: '•', grad: 'linear-gradient(135deg,#1e2a4a,#141d35)' }
  return (
    <div style={{
      width: 46, height: 46, borderRadius: 14, background: meta.grad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, flexShrink: 0,
    }}>{meta.icon}</div>
  )
}

export default async function MonthSummaryPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: month },
    { data: fixedExpenses },
    { data: variableBudgets },
    { data: transactions },
    { data: investments },
  ] = await Promise.all([
    supabase.from('months').select('*').eq('id', monthId).eq('user_id', user.id).single(),
    supabase.from('fixed_expenses').select('*').eq('month_id', monthId).order('category'),
    supabase.from('variable_budget').select('*').eq('month_id', monthId).order('category'),
    supabase.from('transactions').select('*').eq('month_id', monthId),
    supabase.from('investments').select('*').eq('month_id', monthId).order('vehicle'),
  ])

  if (!month) notFound()

  const summary = computeMonthlySummary(
    Number(month.salary), Number(month.rent_income), Number(month.other_income),
    fixedExpenses ?? [], variableBudgets ?? [], transactions ?? [], investments ?? []
  )
  const variableActuals = getVariableActualByCategory(transactions ?? [])
  const remainingPct = Math.max(0, 100 - summary.fundamentals_pct - summary.investments_pct)
  const totalSpentPct = summary.total_income > 0
    ? Math.min((summary.total_actual / summary.total_income) * 100, 100)
    : 0

  // Build alert banners for categories >75% spent
  const alerts: Array<{ msg: string; type: 'warn' | 'danger' }> = [];
  (variableBudgets ?? []).forEach(b => {
    const actual = variableActuals[b.category] ?? 0
    const pct = Number(b.budgeted) > 0 ? (actual / Number(b.budgeted)) * 100 : 0
    if (pct >= 100) {
      alerts.push({ msg: `⚡ ${b.category} budget exceeded! (${formatCAD(actual)} / ${formatCAD(Number(b.budgeted))})`, type: 'danger' })
    } else if (pct >= 75) {
      alerts.push({ msg: `⚠️  ${b.category} is ${pct.toFixed(0)}% spent — ${formatCAD(Number(b.budgeted) - actual)} left`, type: 'warn' })
    }
  })

  const now = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayName = days[now.getDay()]
  const weekNum = Math.ceil(now.getDate() / 7)
  const totalWeeks = 5

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>San Budget</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', textDecoration: 'none', fontSize: 16 }}>←</Link>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{getMonthName(month.month)} {month.year}</span>
            <Link href={`/settings?monthId=${monthId}`} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', textDecoration: 'none', fontSize: 18 }}>⚙️</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* Date hero card — matches habit tracker purple card */}
        <div style={{
          background: 'linear-gradient(135deg, #2d2f6b 0%, #1e2258 50%, #1a1d4a 100%)',
          border: '1px solid #3a3e7a', borderRadius: 18,
          padding: '18px 20px', marginBottom: 12, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ba3d4', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            {dayName} · TODAY
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 10 }}>
            {getMonthName(month.month)} {now.getDate()}, {now.getFullYear()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#9ba3d4', fontWeight: 600 }}>Week {weekNum} of {totalWeeks}</div>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(weekNum / totalWeeks) * 100}%`, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* Overall progress card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Monthly Spending</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: totalSpentPct >= 90 ? 'var(--red)' : totalSpentPct >= 70 ? 'var(--orange)' : 'var(--purple)' }}>
              {formatCAD(summary.total_actual)} — {totalSpentPct.toFixed(0)}%
            </span>
          </div>
          <ProgressBar actual={summary.total_actual} budgeted={summary.total_income} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, marginTop: 14 }}>
            {[
              { label: 'Income', value: formatCAD(summary.total_income), color: 'var(--text)' },
              { label: 'Spent', value: formatCAD(summary.total_actual), color: totalSpentPct >= 80 ? 'var(--orange)' : 'var(--text2)' },
              { label: 'Left', value: formatCAD(summary.remaining_income), color: summary.remaining_income >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert banners */}
        {alerts.map((alert, i) => (
          <div key={i} style={{
            borderRadius: 14, padding: '13px 16px', marginBottom: 10,
            background: alert.type === 'danger'
              ? 'linear-gradient(135deg, #7a1a1a, #4a0d0d)'
              : 'linear-gradient(135deg, #7a4a00, #4a2d00)',
            border: `1px solid ${alert.type === 'danger' ? '#a03030' : '#9a6010'}`,
            fontSize: 13, fontWeight: 600, color: '#fff',
            animation: 'slideDown 0.3s ease',
          }}>
            {alert.msg}
          </div>
        ))}

        {/* Variable categories */}
        {(variableBudgets ?? []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 2px 10px' }}>
              VARIABLE EXPENSES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(variableBudgets ?? []).map(b => {
                const actual = variableActuals[b.category] ?? 0
                const pct = Number(b.budgeted) > 0 ? (actual / Number(b.budgeted)) * 100 : 0
                const statusColor = pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--orange)' : 'var(--text3)'
                return (
                  <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <IconBox category={b.category} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{b.category}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <ProgressBar actual={actual} budgeted={Number(b.budgeted)} />
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          {formatCAD(actual)} of {formatCAD(Number(b.budgeted))} · {formatCAD(Number(b.budgeted) - actual)} left
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Fixed expenses */}
        {(fixedExpenses ?? []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '20px 2px 10px' }}>
              FIXED EXPENSES · {formatCAD(summary.total_fixed_budgeted)}/mo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(fixedExpenses ?? []).map(e => (
                <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IconBox category={e.category} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{e.category}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: e.actual != null ? 'var(--text)' : 'var(--text3)' }}>
                    {formatCAD(e.actual ?? e.budgeted)}
                    {e.actual == null && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4, fontWeight: 400 }}>est</span>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Investments */}
        {(investments ?? []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '20px 2px 10px' }}>
              INVESTMENTS · {summary.investments_pct.toFixed(1)}% of income
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(investments ?? []).map(inv => {
                const actual = Number(inv.actual ?? 0)
                return (
                  <div key={inv.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <IconBox category={inv.vehicle} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{inv.vehicle}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {formatCAD(actual)} of {formatCAD(Number(inv.budgeted))}
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: actual >= Number(inv.budgeted) ? 'var(--green)' : 'var(--text3)' }}>
                        {Number(inv.budgeted) > 0 ? `${((actual / Number(inv.budgeted)) * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                    <ProgressBar actual={actual} budgeted={Number(inv.budgeted)} />
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Income breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>INCOME ALLOCATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {[
              { label: 'Fundamentals', pct: summary.fundamentals_pct, color: 'var(--red)' },
              { label: 'Investments', pct: summary.investments_pct, color: 'var(--green)' },
              { label: 'Remaining', pct: remainingPct, color: 'var(--purple)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.pct.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

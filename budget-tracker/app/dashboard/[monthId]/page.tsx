import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { computeMonthlySummary, getVariableActualByCategory, getMonthName, formatCAD } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import { WeeklyTile } from '@/components/WeeklyTile'

const CATEGORY_ICONS: Record<string, { icon: string; grad: string }> = {
  'Grocery':            { icon: '🛒', grad: 'linear-gradient(135deg,#1a4a2e,#0d2e1a)' },
  'Outside Food':       { icon: '🍜', grad: 'linear-gradient(135deg,#4a2e1a,#2e1a0d)' },
  'Skin Care':          { icon: '✨', grad: 'linear-gradient(135deg,#2e1a4a,#1a0d2e)' },
  'Hair Care':          { icon: '💇', grad: 'linear-gradient(135deg,#1a3a4a,#0d1e2e)' },
  'Home Expense':       { icon: '🏠', grad: 'linear-gradient(135deg,#4a3a1a,#2e240d)' },
  'Misc':               { icon: '📦', grad: 'linear-gradient(135deg,#2a2a4a,#1a1a2e)' },
  'Business Expense':   { icon: '💼', grad: 'linear-gradient(135deg,#1a2a4a,#0d1a2e)' },
  'Uber':               { icon: '🚗', grad: 'linear-gradient(135deg,#3a1a4a,#200d2e)' },
  'Books':              { icon: '📚', grad: 'linear-gradient(135deg,#4a1a1a,#2e0d0d)' },
  'Mortgage':           { icon: '🏡', grad: 'linear-gradient(135deg,#1a3a4a,#0d2030)' },
  'Utilities':          { icon: '⚡', grad: 'linear-gradient(135deg,#4a3a00,#2e2400)' },
  'Phone':              { icon: '📱', grad: 'linear-gradient(135deg,#1a2e4a,#0d1a2e)' },
  'Internet':           { icon: '🌐', grad: 'linear-gradient(135deg,#0d2a4a,#071a2e)' },
  'YouTube Premium':    { icon: '▶️', grad: 'linear-gradient(135deg,#4a0d0d,#2e0707)' },
  'IPTV':               { icon: '📺', grad: 'linear-gradient(135deg,#1a1a4a,#0d0d2e)' },
  'Property Tax':       { icon: '🏛️', grad: 'linear-gradient(135deg,#2e2a1a,#1e1a0d)' },
  'Home Insurance':     { icon: '🛡️', grad: 'linear-gradient(135deg,#1a3a2a,#0d2018)' },
  'Movati':             { icon: '💪', grad: 'linear-gradient(135deg,#3a1a2e,#200d1a)' },
  'Mortgage Accelerated': { icon: '🏠', grad: 'linear-gradient(135deg,#1a3a4a,#0d2030)' },
  'WealthSimple':       { icon: '📈', grad: 'linear-gradient(135deg,#1a4a2e,#0d2e1a)' },
  'Questrade TFSA':     { icon: '💹', grad: 'linear-gradient(135deg,#0d3a1a,#07200d)' },
  'Questrade RRSP':     { icon: '🏦', grad: 'linear-gradient(135deg,#1a2a4a,#0d1a30)' },
  'Scotia':             { icon: '🏧', grad: 'linear-gradient(135deg,#4a0d0d,#2e0707)' },
}

function IconBox({ category }: { category: string }) {
  const meta = CATEGORY_ICONS[category] ?? { icon: '•', grad: 'linear-gradient(135deg,#1e2a4a,#141d35)' }
  return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: meta.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
      {meta.icon}
    </div>
  )
}

// SVG sparkline for wealth trend
function WealthSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 200, h = 48
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 8) - 4
    return `${x},${y}`
  })
  const trend = values[values.length - 1] >= values[0]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={trend ? '#30a46c' : '#e5484d'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots at each data point */}
      {pts.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return <circle key={i} cx={x} cy={y} r={i === values.length - 1 ? 4 : 2.5} fill={trend ? '#30a46c' : '#e5484d'} />
      })}
    </svg>
  )
}

export default async function MonthDashboardPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userName: string = user.user_metadata?.full_name ?? 'My'

  const [
    { data: month },
    { data: fixedExpenses },
    { data: variableBudgets },
    { data: transactions },
    { data: investments },
    { data: allMonths },
  ] = await Promise.all([
    supabase.from('months').select('*').eq('id', monthId).eq('user_id', user.id).single(),
    supabase.from('fixed_expenses').select('*').eq('month_id', monthId).order('category'),
    supabase.from('variable_budget').select('*').eq('month_id', monthId).order('category'),
    supabase.from('transactions').select('*').eq('month_id', monthId),
    supabase.from('investments').select('*').eq('month_id', monthId).order('vehicle'),
    supabase.from('months').select('id,year,month,label').eq('user_id', user.id).order('year').order('month'),
  ])

  if (!month) notFound()

  // Wealth over time: fetch account balances per month
  const monthIds = (allMonths ?? []).map(m => m.id)
  const { data: allAccounts } = monthIds.length > 0
    ? await supabase.from('accounts').select('month_id,balance').in('month_id', monthIds)
    : { data: [] }

  // TFSA tracker: YTD investments for current year
  const TFSA_VEHICLES = ['Questrade TFSA', 'WealthSimple', 'Scotia']
  const tfsaRoom: number | null = user.user_metadata?.tfsa_room ?? null
  const yearMonthIds = (allMonths ?? []).filter(m => m.year === month.year).map(m => m.id)
  const { data: ytdInvestments } = yearMonthIds.length > 0
    ? await supabase.from('investments').select('vehicle,actual,month_id').in('month_id', yearMonthIds)
    : { data: [] }
  const tfsaMonthContrib = (investments ?? [])
    .filter(i => TFSA_VEHICLES.includes(i.vehicle))
    .reduce((s, i) => s + Number(i.actual ?? 0), 0)
  const tfsaYtd = (ytdInvestments ?? [])
    .filter(i => TFSA_VEHICLES.includes(i.vehicle))
    .reduce((s, i) => s + Number(i.actual ?? 0), 0)
  const tfsaRemaining = tfsaRoom != null ? tfsaRoom - tfsaYtd : null

  const wealthByMonth = (allMonths ?? []).map(m => {
    const total = (allAccounts ?? [])
      .filter(a => a.month_id === m.id)
      .reduce((s, a) => s + Number(a.balance), 0)
    return { label: getMonthName(m.month).slice(0, 3), total }
  })
  const wealthValues = wealthByMonth.map(w => w.total)
  const currentWealth = wealthValues[wealthValues.length - 1] ?? 0
  const prevWealth = wealthValues.length > 1 ? wealthValues[wealthValues.length - 2] : null
  const wealthDiff = prevWealth !== null ? currentWealth - prevWealth : null

  const summary = computeMonthlySummary(
    Number(month.salary), Number(month.rent_income), Number(month.other_income),
    fixedExpenses ?? [], variableBudgets ?? [], transactions ?? [], investments ?? []
  )
  const variableActuals = getVariableActualByCategory(transactions ?? [])
  const remainingPct = Math.max(0, 100 - summary.fundamentals_pct - summary.investments_pct)
  const totalSpentPct = summary.total_income > 0
    ? Math.min((summary.total_actual / summary.total_income) * 100, 100)
    : 0

  const alerts: Array<{ msg: string; type: 'warn' | 'danger' }> = [];
  (variableBudgets ?? []).forEach(b => {
    const actual = variableActuals[b.category] ?? 0
    const pct = Number(b.budgeted) > 0 ? (actual / Number(b.budgeted)) * 100 : 0
    if (pct >= 100) alerts.push({ msg: `⚡ ${b.category} exceeded! (${formatCAD(actual)} / ${formatCAD(Number(b.budgeted))})`, type: 'danger' })
    else if (pct >= 75) alerts.push({ msg: `⚠️ ${b.category} at ${pct.toFixed(0)}% — ${formatCAD(Number(b.budgeted) - actual)} left`, type: 'warn' })
  })

  const now = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayName = days[now.getDay()]
  const daysInMonth = new Date(month.year, month.month, 0).getDate()
  const totalWeeks = Math.ceil(daysInMonth / 7)
  const weekNum = Math.min(Math.ceil(now.getDate() / 7), totalWeeks)

  // Spending by type breakdown
  const spendingByType: Record<string, number> = {}
  ;(transactions ?? []).forEach(t => {
    if (t.sub_label) spendingByType[t.sub_label] = (spendingByType[t.sub_label] ?? 0) + Number(t.amount)
  })
  const spendingTypeEntries = Object.entries(spendingByType).sort((a, b) => b[1] - a[1])
  const maxTypeSpend = spendingTypeEntries[0]?.[1] ?? 1

  // Investment goal widget data
  const goalAmount: number | null = user.user_metadata?.investment_goal_amount ?? null
  const goalDeadline: string | null = user.user_metadata?.investment_goal_deadline ?? null // "YYYY-MM"
  const ytdInvestedTotal = (ytdInvestments ?? []).reduce((s, i) => s + Number(i.actual ?? 0), 0)
  // Count only months that have at least some investment activity
  const activeInvestmentMonths = Math.max(1, yearMonthIds.filter(mid =>
    (ytdInvestments ?? []).some(i => i.month_id === mid && Number(i.actual ?? 0) > 0)
  ).length)
  let goalWidget: { pct: number; onTrack: boolean; paceDelta: number; projectedDate: string } | null = null
  if (goalAmount && goalDeadline) {
    const [dlYear, dlMonth] = goalDeadline.split('-').map(Number)
    const deadlineDate = new Date(dlYear, dlMonth, 1)
    const nowDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthsLeft = Math.max(0, (deadlineDate.getFullYear() - nowDate.getFullYear()) * 12 + (deadlineDate.getMonth() - nowDate.getMonth()))
    const currentPace = ytdInvestedTotal / activeInvestmentMonths
    const requiredPace = goalAmount / (activeInvestmentMonths + monthsLeft)
    const onTrack = currentPace >= requiredPace
    const pct = Math.min((ytdInvestedTotal / goalAmount) * 100, 100)
    const monthsToComplete = currentPace > 0 ? Math.ceil((goalAmount - ytdInvestedTotal) / currentPace) : null
    const projDate = monthsToComplete != null
      ? new Date(nowDate.getFullYear(), nowDate.getMonth() + monthsToComplete, 1)
        .toLocaleString('en-CA', { month: 'short', year: 'numeric' })
      : '—'
    goalWidget = { pct, onTrack, paceDelta: ((currentPace - requiredPace) / requiredPace) * 100, projectedDate: projDate }
  }

  // Build context string for AI assistant
  const askContext = [
    `Month: ${getMonthName(month.month)} ${month.year}`,
    `Income: salary ${formatCAD(Number(month.salary))}, rent ${formatCAD(Number(month.rent_income))}, other ${formatCAD(Number(month.other_income ?? 0))}, total ${formatCAD(summary.total_income)}`,
    `Total spent: ${formatCAD(summary.total_actual)} (fixed ${formatCAD(summary.total_fixed_actual)}, variable ${formatCAD(summary.total_variable_actual)}, investments ${formatCAD(summary.total_investments_actual)})`,
    `Remaining: ${formatCAD(summary.remaining_income)}`,
    '',
    'Variable budgets:',
    ...(variableBudgets ?? []).map(b => `  ${b.category}: budget ${formatCAD(Number(b.budgeted))}, spent ${formatCAD(variableActuals[b.category] ?? 0)}`),
    '',
    'Fixed expenses:',
    ...(fixedExpenses ?? []).map(e => `  ${e.category}: ${formatCAD(Number(e.actual ?? 0))}`),
    '',
    'Investments:',
    ...(investments ?? []).map(i => `  ${i.vehicle}: budgeted ${formatCAD(Number(i.budgeted))}, actual ${formatCAD(Number(i.actual ?? 0))}`),
    '',
    'Transactions (date, category, vendor, amount, spending type):',
    ...(transactions ?? []).map(t =>
      `  ${t.date} | ${t.category} | ${t.subcategory || '—'} | ${formatCAD(Number(t.amount))}${t.sub_label ? ` [${t.sub_label}]` : ''}${t.is_shared ? ` (shared ${t.share_split})` : ''}`
    ),
  ].join('\n')

  const navTiles = [
    { href: `/dashboard/${monthId}/monthly`, icon: '📋', label: 'Monthly', sublabel: `${formatCAD(summary.total_actual)} spent`, color: '#7c6fcd', grad: 'linear-gradient(135deg,#2a1e5a,#1a1240)' },
    { href: `/dashboard/${monthId}/charts`, icon: '📊', label: 'Charts', sublabel: `${totalSpentPct.toFixed(0)}% of income`, color: '#f97316', grad: 'linear-gradient(135deg,#4a2a0a,#2e1a04)' },
    { href: `/dashboard/${monthId}/net-worth`, icon: '💎', label: 'Wealth', sublabel: formatCAD(currentWealth), color: '#30a46c', grad: 'linear-gradient(135deg,#0a3a20,#052212)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{userName} Budget</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', textDecoration: 'none', fontSize: 16 }}>←</Link>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{getMonthName(month.month)} {month.year}</span>
            <Link href={`/settings?monthId=${monthId}`} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', textDecoration: 'none', fontSize: 18 }}>⚙️</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* Date hero card */}
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
            {getMonthName(now.getMonth() + 1)} {now.getDate()}, {now.getFullYear()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#9ba3d4', fontWeight: 600 }}>Week {weekNum} of {totalWeeks}</div>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(weekNum / totalWeeks) * 100}%`, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* Spending snapshot */}
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
            background: alert.type === 'danger' ? 'linear-gradient(135deg,#7a1a1a,#4a0d0d)' : 'linear-gradient(135deg,#7a4a00,#4a2d00)',
            border: `1px solid ${alert.type === 'danger' ? '#a03030' : '#9a6010'}`,
            fontSize: 13, fontWeight: 600, color: '#fff', animation: 'slideDown 0.3s ease',
          }}>{alert.msg}</div>
        ))}

        {/* Spending by Type */}
        {spendingTypeEntries.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 2px 10px' }}>SPENDING BY TYPE</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
              {spendingTypeEntries.map(([type, amount], idx) => {
                const palette = ['#7c6fcd','#30a46c','#f97316','#60a5fa','#f59e0b','#e5484d','#a78bfa','#38bdf8','#fb7185','#34d399']
                const color = palette[idx % palette.length]
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{type}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatCAD(amount)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(amount / maxTypeSpend) * 100}%`, background: color, borderRadius: 3, opacity: 0.8 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Investment Goal Widget */}
        {goalWidget && goalAmount && goalDeadline && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 2px 10px' }}>INVESTMENT GOAL</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>${ytdInvestedTotal.toLocaleString('en-CA', { maximumFractionDigits: 0 })} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)' }}>of ${Number(goalAmount).toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Target by {goalDeadline}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: goalWidget.onTrack ? 'var(--green)' : 'var(--red)' }}>
                    {goalWidget.onTrack ? '✓ On track' : `${Math.abs(goalWidget.paceDelta).toFixed(0)}% behind`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Proj. {goalWidget.projectedDate}</div>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${goalWidget.pct}%`, background: goalWidget.onTrack ? 'var(--green)' : 'var(--orange)', borderRadius: 4, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'right' }}>{goalWidget.pct.toFixed(1)}% complete</div>
            </div>
          </>
        )}

        {/* Quick nav tiles — 2×2 grid */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 2px 10px' }}>NAVIGATE</div>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Link href={`/dashboard/${monthId}/monthly`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg,#2a1e5a,#1a1240)', border: '1px solid #7c6fcd30', borderRadius: 18, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 4px 20px #7c6fcd18' }}>
                <span style={{ fontSize: 28 }}>📋</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Monthly</div>
                <div style={{ fontSize: 11, color: '#7c6fcd', fontWeight: 600 }}>{formatCAD(summary.total_actual)} spent</div>
              </div>
            </Link>
            <WeeklyTile monthId={monthId} year={month.year} month={month.month} transactions={transactions ?? []} />
            {navTiles.map(tile => (
              <Link key={tile.href} href={tile.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: tile.grad, border: `1px solid ${tile.color}30`, borderRadius: 18, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: `0 4px 20px ${tile.color}18` }}>
                  <span style={{ fontSize: 28 }}>{tile.icon}</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{tile.label}</div>
                  <div style={{ fontSize: 11, color: tile.color, fontWeight: 600 }}>{tile.sublabel}</div>
                </div>
              </Link>
            ))}
          </div>
          {/* Report tile — full width below the grid */}
          <Link href={`/dashboard/report?from=${monthId}`} style={{ textDecoration: 'none', display: 'block', marginTop: 10 }}>
            <div style={{ background: 'linear-gradient(135deg,#1a3a4a,#0d1e2e)', border: '1px solid #38bdf830', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px #38bdf818' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>📈</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Report</div>
                  <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>Filter by category, sub-category & date range</div>
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#38bdf8' }}>›</span>
            </div>
          </Link>

          {/* Compare button — centered at the intersection of the 4 tiles */}
          <Link href="/dashboard/compare" style={{
            textDecoration: 'none', position: 'absolute',
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}>⇄</div>
          </Link>
        </div>

        {/* Wealth over time */}
        {wealthByMonth.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 2px 10px' }}>WEALTH OVER TIME</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{formatCAD(currentWealth)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Net Worth</div>
                </div>
                {wealthDiff !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: wealthDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {wealthDiff >= 0 ? '+' : ''}{formatCAD(wealthDiff)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>vs last month</div>
                  </div>
                )}
              </div>
              {wealthValues.length > 1 && (
                <>
                  <WealthSparkline values={wealthValues} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    {wealthByMonth.map((w, i) => (
                      <div key={i} style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, textAlign: 'center' }}>{w.label}</div>
                    ))}
                  </div>
                </>
              )}
              {wealthValues.length <= 1 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                  Trend will appear after you track multiple months
                </div>
              )}
            </div>
          </>
        )}

        {/* TFSA Tracker */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 2px 10px' }}>TFSA TRACKER</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>Questrade TFSA · WealthSimple · Scotia</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--purple)' }}>${Math.round(tfsaMonthContrib).toLocaleString('en-CA')}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>This Month</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>${Math.round(tfsaYtd).toLocaleString('en-CA')}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>YTD Total</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              {tfsaRemaining != null ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: tfsaRemaining >= 0 ? 'var(--green)' : 'var(--red)' }}>${Math.round(tfsaRemaining).toLocaleString('en-CA')}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Room Left</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>—</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Set in Settings</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Income allocation summary */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
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

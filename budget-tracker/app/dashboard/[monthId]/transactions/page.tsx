'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCAD } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import type { Transaction, VariableBudget } from '@/lib/supabase/types'

const WEEKS = [1, 2, 3, 4, 5]

const CATEGORY_META: Record<string, { icon: string; grad: string }> = {
  'Grocery':          { icon: '🛒', grad: 'linear-gradient(135deg,#1a4a2e,#0d2e1a)' },
  'Outside Food':     { icon: '🍜', grad: 'linear-gradient(135deg,#4a2e1a,#2e1a0d)' },
  'Skin Care':        { icon: '✨', grad: 'linear-gradient(135deg,#2e1a4a,#1a0d2e)' },
  'Hair Care':        { icon: '💇', grad: 'linear-gradient(135deg,#1a3a4a,#0d1e2e)' },
  'Home Expense':     { icon: '🏠', grad: 'linear-gradient(135deg,#4a3a1a,#2e240d)' },
  'Misc':             { icon: '📦', grad: 'linear-gradient(135deg,#2a2a4a,#1a1a2e)' },
  'Business Expense': { icon: '💼', grad: 'linear-gradient(135deg,#1a2a4a,#0d1a2e)' },
  'Uber':             { icon: '🚗', grad: 'linear-gradient(135deg,#3a1a4a,#200d2e)' },
  'Books':            { icon: '📚', grad: 'linear-gradient(135deg,#4a1a1a,#2e0d0d)' },
}

export default function TransactionsPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const [activeWeek, setActiveWeek] = useState(Math.ceil(new Date().getDate() / 7))
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<VariableBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('transactions').select('*').eq('month_id', monthId).order('date', { ascending: false }),
      supabase.from('variable_budget').select('*').eq('month_id', monthId),
    ]).then(([{ data: txns }, { data: bud }]) => {
      setTransactions(txns ?? [])
      setBudgets(bud ?? [])
      setLoading(false)
    })
  }, [monthId])

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  const weekTxns = transactions.filter(t => t.week_number === activeWeek)
  // Per-week actuals (only this week, only non-shared)
  const weekCategoryActuals: Record<string, number> = {}
  weekTxns.filter(t => !t.is_shared).forEach(t => {
    weekCategoryActuals[t.category] = (weekCategoryActuals[t.category] ?? 0) + Number(t.amount)
  })
  const weekTotal = weekTxns.filter(t => !t.is_shared).reduce((s, t) => s + Number(t.amount), 0)
  const weeklyBudget = (b: number) => b / 5  // divide monthly budget into 5 weeks

  // Alerts for >75% of weekly allocation
  const alerts = budgets
    .map(b => {
      const wBudget = weeklyBudget(Number(b.budgeted))
      const actual = weekCategoryActuals[b.category] ?? 0
      return { ...b, actual, pct: wBudget > 0 ? (actual / wBudget) * 100 : 0 }
    })
    .filter(b => b.pct >= 75)
    .sort((a, b) => b.pct - a.pct)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={`/dashboard/${monthId}`} style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Summary</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Transactions</span>
          <Link href={`/add?monthId=${monthId}`} style={{
            background: 'linear-gradient(135deg,#e5484d,#c0392b)',
            color: '#fff', width: 34, height: 34, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 200, textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(229,72,77,0.45)',
          }}>+</Link>
        </div>

        {/* Week tabs */}
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', borderTop: '1px solid var(--border)', padding: '0 8px' }}>
          {WEEKS.map(w => (
            <button key={w} onClick={() => setActiveWeek(w)} style={{
              flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer',
              color: activeWeek === w ? 'var(--purple)' : 'var(--text3)',
              borderBottom: `2px solid ${activeWeek === w ? 'var(--purple)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}>WK {w}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>Loading...</div>
        ) : (
          <>
            {/* Spending progress */}
            {budgets.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WEEK {activeWeek} BUDGET (1/5 of monthly)</span>
                </div>
                {budgets.map((b, i) => {
                  const wBudget = weeklyBudget(Number(b.budgeted))
                  const actual = weekCategoryActuals[b.category] ?? 0
                  const pct = wBudget > 0 ? (actual / wBudget) * 100 : 0
                  const meta = CATEGORY_META[b.category] ?? { icon: '•', grad: 'var(--surface2)' }
                  return (
                    <div key={b.id} style={{ padding: '10px 14px', borderBottom: i < budgets.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: meta.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{meta.icon}</div>
                        <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>{b.category}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 100 ? 'var(--red)' : pct >= 75 ? 'var(--orange)' : 'var(--text3)' }}>
                          {formatCAD(actual)} / {formatCAD(wBudget)}
                        </span>
                      </div>
                      <ProgressBar actual={actual} budgeted={wBudget} />
                    </div>
                  )
                })}
              </div>
            )}

            {/* Alert banners */}
            {alerts.map((a, i) => (
              <div key={i} style={{
                borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
                background: a.pct >= 100
                  ? 'linear-gradient(135deg, #7a1a1a, #4a0d0d)'
                  : 'linear-gradient(135deg, #7a4a00, #4a2d00)',
                border: `1px solid ${a.pct >= 100 ? '#a03030' : '#9a6010'}`,
                animation: 'slideDown 0.3s ease',
              }}>
                {a.pct >= 100 ? '⚡' : '⚠️'} {a.category} {a.pct >= 100 ? 'exceeded' : `at ${a.pct.toFixed(0)}%`} — {formatCAD(a.actual)} / {formatCAD(Number(a.budgeted))}
              </div>
            ))}

            {/* Week header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                WEEK {activeWeek} · {weekTxns.length} item{weekTxns.length !== 1 ? 's' : ''}
              </span>
              {weekTotal > 0 && <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{formatCAD(weekTotal)}</span>}
            </div>

            {/* Transactions list */}
            {weekTxns.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '36px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 18 }}>No transactions for Week {activeWeek}</div>
                <Link href={`/add?monthId=${monthId}`} style={{
                  display: 'inline-block', background: 'linear-gradient(135deg,#e5484d,#c0392b)',
                  color: '#fff', borderRadius: 12, padding: '11px 24px',
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(229,72,77,0.4)',
                }}>+ Add Transaction</Link>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {weekTxns.map((t, i) => {
                  const meta = CATEGORY_META[t.category] ?? { icon: '•', grad: 'var(--surface2)' }
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', padding: '13px 14px',
                      borderBottom: i < weekTxns.length - 1 ? '1px solid var(--border)' : 'none',
                      opacity: deletingId === t.id ? 0.3 : 1, transition: 'opacity 0.2s',
                    }}>
                      <div style={{ width: 44, height: 44, borderRadius: 13, background: meta.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, marginRight: 12 }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.subcategory || t.category}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{t.category}</span>
                          <span>·</span>
                          <span>{t.date}</span>
                          {t.is_shared && <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>SHARED</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{formatCAD(Number(t.amount))}</span>
                        <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                          style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 4px', lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

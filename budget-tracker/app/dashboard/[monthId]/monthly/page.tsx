'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { computeMonthlySummary, getVariableActualByCategory, getMonthName, formatCAD } from '@/lib/calculations/monthlySummary'
import type { FixedExpense, VariableBudget, Transaction, Investment } from '@/lib/supabase/types'
import type { FixedExpenseItem } from '@/lib/supabase/types'
import Link from 'next/link'

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

// Inline editable number field — taps to edit, blurs to save
function InlineAmount({
  value,
  onSave,
  label,
}: {
  value: number | null
  onSave: (v: number | null) => Promise<void>
  label?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(value != null ? String(value) : '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function commit() {
    setEditing(false)
    const num = draft === '' ? null : parseFloat(draft)
    if (num !== value) await onSave(isNaN(num as number) ? null : num)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        style={{
          width: 80, padding: '4px 8px', fontSize: 13, fontWeight: 700,
          background: 'var(--surface2)', border: '1px solid var(--red)',
          borderRadius: 8, color: 'var(--text)', outline: 'none', textAlign: 'right',
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title={`Edit ${label ?? 'amount'}`}
      style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 8,
        padding: '3px 8px', fontSize: 13, fontWeight: 700, color: 'var(--text2)',
        cursor: 'pointer', minWidth: 64, textAlign: 'right',
      }}
    >
      {value != null ? formatCAD(value) : <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
    </button>
  )
}

export default function MonthlyPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const supabase = createClient()

  const [month, setMonth] = useState<{ id: string; year: number; month: number; salary: number; rent_income: number; other_income: number } | null>(null)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [fixedItems, setFixedItems] = useState<FixedExpenseItem[]>([])
  const [variableBudgets, setVariableBudgets] = useState<VariableBudget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  // sub-item add state: { fixedExpenseId, label, amount }
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null)
  const [newItemLabel, setNewItemLabel] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')

  useEffect(() => {
    async function load() {
      const [
        { data: m },
        { data: fe },
        { data: fi },
        { data: vb },
        { data: txns },
        { data: inv },
      ] = await Promise.all([
        supabase.from('months').select('*').eq('id', monthId).single(),
        supabase.from('fixed_expenses').select('*').eq('month_id', monthId).order('category'),
        supabase.from('fixed_expense_items').select('*').eq('month_id', monthId).order('label'),
        supabase.from('variable_budget').select('*').eq('month_id', monthId).order('category'),
        supabase.from('transactions').select('*').eq('month_id', monthId),
        supabase.from('investments').select('*').eq('month_id', monthId).order('vehicle'),
      ])
      setMonth(m)
      setFixedExpenses(fe ?? [])
      setFixedItems((fi as FixedExpenseItem[] | null) ?? [])
      setVariableBudgets(vb ?? [])
      setTransactions(txns ?? [])
      setInvestments(inv ?? [])
      setLoading(false)
    }
    load()
  }, [monthId])

  // Fetch fixed_expense_items — table may not exist yet
  async function reloadFixedItems() {
    const { data } = await supabase.from('fixed_expense_items').select('*').eq('month_id', monthId).order('label')
    setFixedItems((data as FixedExpenseItem[] | null) ?? [])
  }

  async function saveFixedBudget(id: string, val: number | null) {
    await supabase.from('fixed_expenses').update({ budgeted: val ?? 0 }).eq('id', id)
    setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, budgeted: val ?? 0 } : e))
  }

  async function saveFixedActual(id: string, val: number | null) {
    await supabase.from('fixed_expenses').update({ actual: val }).eq('id', id)
    setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, actual: val } : e))
  }

  async function saveInvestmentBudget(id: string, val: number | null) {
    await supabase.from('investments').update({ budgeted: val ?? 0 }).eq('id', id)
    setInvestments(prev => prev.map(i => i.id === id ? { ...i, budgeted: val ?? 0 } : i))
  }

  async function saveInvestmentActual(id: string, val: number | null) {
    await supabase.from('investments').update({ actual: val }).eq('id', id)
    setInvestments(prev => prev.map(i => i.id === id ? { ...i, actual: val } : i))
  }

  async function addFixedItem(fixedExpenseId: string) {
    const amt = parseFloat(newItemAmount)
    if (!newItemLabel.trim() || isNaN(amt)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Need month_id on fixed_expense_items — fetch from fixed_expense
    await supabase.from('fixed_expense_items').insert({
      user_id: user.id,
      fixed_expense_id: fixedExpenseId,
      month_id: monthId,
      label: newItemLabel.trim(),
      amount: amt,
    })
    setNewItemLabel('')
    setNewItemAmount('')
    setAddingItemFor(null)
    await reloadFixedItems()
    // Update actual on the parent fixed expense to be sum of items
    const items = [...fixedItems.filter(i => i.fixed_expense_id === fixedExpenseId), { label: newItemLabel.trim(), amount: amt } as FixedExpenseItem]
    const total = items.reduce((s, i) => s + Number(i.amount), 0)
    await saveFixedActual(fixedExpenseId, total)
  }

  async function deleteFixedItem(item: FixedExpenseItem) {
    await supabase.from('fixed_expense_items').delete().eq('id', item.id)
    const remaining = fixedItems.filter(i => i.id !== item.id && i.fixed_expense_id === item.fixed_expense_id)
    const total = remaining.reduce((s, i) => s + Number(i.amount), 0)
    await saveFixedActual(item.fixed_expense_id, remaining.length > 0 ? total : null)
    await reloadFixedItems()
  }

  if (loading || !month) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  const summary = computeMonthlySummary(
    Number(month.salary), Number(month.rent_income), Number(month.other_income),
    fixedExpenses, variableBudgets, transactions, investments
  )
  const variableActuals = getVariableActualByCategory(transactions)
  const remainingPct = Math.max(0, 100 - summary.fundamentals_pct - summary.investments_pct)
  const totalSpentPct = summary.total_income > 0 ? Math.min((summary.total_actual / summary.total_income) * 100, 100) : 0

  const alerts: Array<{ msg: string; type: 'warn' | 'danger' }> = []
  variableBudgets.forEach(b => {
    const actual = variableActuals[b.category] ?? 0
    const pct = Number(b.budgeted) > 0 ? (actual / Number(b.budgeted)) * 100 : 0
    if (pct >= 100) alerts.push({ msg: `⚡ ${b.category} exceeded! (${formatCAD(actual)} / ${formatCAD(Number(b.budgeted))})`, type: 'danger' })
    else if (pct >= 75) alerts.push({ msg: `⚠️ ${b.category} at ${pct.toFixed(0)}% — ${formatCAD(Number(b.budgeted) - actual)} left`, type: 'warn' })
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 2,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 72 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={`/dashboard/${monthId}`} style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Home</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{getMonthName(month.month)} {month.year}</span>
          <Link href={`/settings?monthId=${monthId}`} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', textDecoration: 'none', fontSize: 18 }}>⚙️</Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* Overall progress */}
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
            fontSize: 13, fontWeight: 600, color: '#fff',
          }}>{alert.msg}</div>
        ))}

        {/* Variable categories */}
        {variableBudgets.length > 0 && (
          <>
            <div style={{ margin: '16px 2px 10px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>VARIABLE EXPENSES</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatCAD(summary.total_variable_actual)}</span>
                <span style={{ color: 'var(--text3)' }}> / {formatCAD(summary.total_variable_budgeted)}</span>
                <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {summary.total_income > 0 ? ((summary.total_variable_actual / summary.total_income) * 100).toFixed(1) : '0'}% of income</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {variableBudgets.map(b => {
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
                          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{pct.toFixed(0)}%</span>
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
        {fixedExpenses.length > 0 && (
          <>
            <div style={{ margin: '20px 2px 10px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>FIXED EXPENSES</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatCAD(summary.total_fixed_actual)}</span>
                <span style={{ color: 'var(--text3)' }}> / {formatCAD(summary.total_fixed_budgeted)}</span>
                <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {summary.total_income > 0 ? ((summary.total_fixed_actual / summary.total_income) * 100).toFixed(1) : '0'}% of income</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fixedExpenses.map(e => {
                const items = fixedItems.filter(i => i.fixed_expense_id === e.id)
                const hasItems = items.length > 0
                const displayActual = hasItems
                  ? items.reduce((s, i) => s + Number(i.amount), 0)
                  : (e.actual ?? null)
                return (
                  <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                    {/* Parent row */}
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <IconBox category={e.category} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{e.category}</span>
                      </div>
                      {/* Budget field */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={labelStyle}>Budget</div>
                        <InlineAmount value={Number(e.budgeted)} onSave={v => saveFixedBudget(e.id, v)} label="budget" />
                      </div>
                      {/* Actual field — if has items show sum (not editable here), else editable */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={labelStyle}>Actual</div>
                        {hasItems ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 64, textAlign: 'right' }}>
                            {formatCAD(displayActual ?? 0)}
                          </span>
                        ) : (
                          <InlineAmount value={e.actual} onSave={v => saveFixedActual(e.id, v)} label="actual" />
                        )}
                      </div>
                    </div>

                    {/* Sub-items */}
                    {hasItems && (
                      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                        {items.map((item, idx) => (
                          <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', padding: '9px 14px 9px 66px',
                            borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <span style={{ color: 'var(--text3)', marginRight: 8, fontSize: 12 }}>{idx === items.length - 1 ? '└' : '├'}</span>
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatCAD(Number(item.amount))}</span>
                            <button onClick={() => deleteFixedItem(item)}
                              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, padding: '0 0 0 10px', lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add entry row */}
                    {addingItemFor === e.id ? (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg)' }}>
                        <input
                          type="text" value={newItemLabel} onChange={ev => setNewItemLabel(ev.target.value)}
                          placeholder="Label (e.g. Kitchener)" autoFocus
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }}
                          onKeyDown={ev => ev.key === 'Enter' && addFixedItem(e.id)}
                        />
                        <input
                          type="number" inputMode="decimal" value={newItemAmount} onChange={ev => setNewItemAmount(ev.target.value)}
                          placeholder="$0"
                          style={{ width: 72, padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }}
                          onKeyDown={ev => ev.key === 'Enter' && addFixedItem(e.id)}
                        />
                        <button onClick={() => addFixedItem(e.id)} style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                        <button onClick={() => { setAddingItemFor(null); setNewItemLabel(''); setNewItemAmount('') }}
                          style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingItemFor(e.id); setNewItemLabel(''); setNewItemAmount('') }}
                        style={{ width: '100%', padding: '8px 14px 8px 66px', textAlign: 'left', background: 'none', border: 'none', borderTop: hasItems ? '1px solid var(--border)' : 'none', color: 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        + Add entry
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Investments */}
        {investments.length > 0 && (
          <>
            <div style={{ margin: '20px 2px 10px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>INVESTMENTS</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{formatCAD(summary.total_investments_actual)}</span>
                <span style={{ color: 'var(--text3)' }}> / {formatCAD(summary.total_investments_budgeted)}</span>
                <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· {summary.investments_pct.toFixed(1)}% of income</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {investments.map(inv => {
                const actual = Number(inv.actual ?? 0)
                return (
                  <div key={inv.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <IconBox category={inv.vehicle} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{inv.vehicle}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={labelStyle}>Budget</div>
                        <InlineAmount value={Number(inv.budgeted)} onSave={v => saveInvestmentBudget(inv.id, v)} label="budget" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={labelStyle}>Actual</div>
                        <InlineAmount value={inv.actual} onSave={v => saveInvestmentActual(inv.id, v)} label="actual" />
                      </div>
                    </div>
                    <ProgressBar actual={actual} budgeted={Number(inv.budgeted)} />
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {formatCAD(actual)} of {formatCAD(Number(inv.budgeted))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Income allocation */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', marginTop: 20, marginBottom: 16 }}>
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

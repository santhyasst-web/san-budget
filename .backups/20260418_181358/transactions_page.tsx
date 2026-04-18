'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCAD } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import type { Transaction, VariableBudget, TransactionItem } from '@/lib/supabase/types'

// WEEKS is computed dynamically from weeksInMonth below

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
  const [weeksInMonth, setWeeksInMonth] = useState(5)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null)
  const [txnItems, setTxnItems] = useState<Record<string, TransactionItem[]>>({})
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ subcategory: string; amount: string; date: string; is_shared: boolean; shared_direction: 'from_thiyag' | 'to_thiyag'; share_split: 'half' | 'full' } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('transactions').select('*').eq('month_id', monthId).order('date', { ascending: false }),
      supabase.from('variable_budget').select('*').eq('month_id', monthId),
      supabase.from('months').select('year,month').eq('id', monthId).single(),
    ]).then(([{ data: txns }, { data: bud }, { data: mon }]) => {
      setTransactions(txns ?? [])
      setBudgets(bud ?? [])
      if (mon) {
        const daysInMonth = new Date(mon.year, mon.month, 0).getDate()
        setWeeksInMonth(Math.ceil(daysInMonth / 7))
      }
      setLoading(false)
    })
  }, [monthId])

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  function startEdit(t: Transaction) {
    setEditingId(t.id)
    setEditDraft({
      subcategory: t.subcategory ?? '',
      amount: String(t.amount),
      date: t.date,
      is_shared: t.is_shared,
      shared_direction: t.shared_direction ?? 'from_thiyag',
      share_split: t.share_split ?? 'half',
    })
  }

  async function saveEdit(t: Transaction) {
    if (!editDraft) return
    setSavingEdit(true)
    const amountNum = parseFloat(editDraft.amount)
    if (isNaN(amountNum) || amountNum <= 0) { setSavingEdit(false); return }

    const weekNum = Math.ceil(new Date(editDraft.date).getDate() / 7)
    await supabase.from('transactions').update({
      subcategory: editDraft.subcategory.trim(),
      amount: amountNum,
      date: editDraft.date,
      week_number: weekNum,
      is_shared: editDraft.is_shared,
      shared_direction: editDraft.is_shared ? editDraft.shared_direction : null,
      share_split: editDraft.is_shared ? editDraft.share_split : 'half',
    }).eq('id', t.id)

    // Sync shared_settlements: delete old (if any) and insert new
    if (t.is_shared || editDraft.is_shared) {
      await supabase.from('shared_settlements').delete().eq('transaction_id', t.id)
      if (editDraft.is_shared) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const settlementAmount = editDraft.share_split === 'full' ? amountNum : amountNum / 2
          await supabase.from('shared_settlements').insert({
            user_id: user.id, month_id: monthId,
            direction: editDraft.shared_direction,
            description: editDraft.subcategory.trim() || t.category,
            amount: settlementAmount, date: editDraft.date,
            settled: false, transaction_id: t.id,
          })
        }
      }
    }

    // Update local state
    setTransactions(prev => prev.map(tx => tx.id === t.id ? {
      ...tx,
      subcategory: editDraft.subcategory.trim(),
      amount: amountNum,
      date: editDraft.date,
      week_number: weekNum,
      is_shared: editDraft.is_shared,
      shared_direction: editDraft.is_shared ? editDraft.shared_direction : null,
      share_split: editDraft.is_shared ? editDraft.share_split : 'half',
    } : tx))

    setEditingId(null)
    setEditDraft(null)
    setSavingEdit(false)
  }

  async function toggleExpand(txnId: string) {
    if (expandedTxn === txnId) { setExpandedTxn(null); return }
    setExpandedTxn(txnId)
    if (!txnItems[txnId]) {
      const { data } = await supabase.from('transaction_items').select('*').eq('transaction_id', txnId).order('label')
      setTxnItems(prev => ({ ...prev, [txnId]: (data as TransactionItem[] | null) ?? [] }))
    }
  }

  const weekTxns = transactions.filter(t => t.week_number === activeWeek)
  // Per-week actuals (shared counts at 50%)
  const weekCategoryActuals: Record<string, number> = {}
  weekTxns.forEach(t => {
    const amt = t.is_shared ? Number(t.amount) * 0.5 : Number(t.amount)
    weekCategoryActuals[t.category] = (weekCategoryActuals[t.category] ?? 0) + amt
  })
  const weekTotal = weekTxns.reduce((s, t) => s + (t.is_shared ? Number(t.amount) * 0.5 : Number(t.amount)), 0)
  const weeklyBudget = (b: number) => b / weeksInMonth

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
          {Array.from({ length: weeksInMonth }, (_, i) => i + 1).map(w => (
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
            {/* Week total card — top */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Week {activeWeek} · {weekTxns.length} transaction{weekTxns.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: weekTotal > 0 ? 'var(--text)' : 'var(--text3)', marginTop: 4 }}>
                {weekTotal > 0 ? formatCAD(weekTotal) : '$0.00'}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>spent this week</span>
              </div>
            </div>

            {/* Alert banners — top */}
            {alerts.map((a, i) => (
              <div key={i} style={{
                borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#fff',
                background: a.pct >= 100
                  ? 'linear-gradient(135deg, #7a1a1a, #4a0d0d)'
                  : 'linear-gradient(135deg, #7a4a00, #4a2d00)',
                border: `1px solid ${a.pct >= 100 ? '#a03030' : '#9a6010'}`,
              }}>
                {a.pct >= 100 ? '⚡' : '⚠️'} {a.category} {a.pct >= 100 ? 'exceeded' : `at ${a.pct.toFixed(0)}%`} — {formatCAD(a.actual)} / {formatCAD(Number(a.budgeted))}
              </div>
            ))}

            {/* Spending progress */}
            {budgets.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>WEEK {activeWeek} BUDGET (1/{weeksInMonth} of monthly)</span>
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
                  const items = txnItems[t.id]
                  const isExpanded = expandedTxn === t.id
                  const hasItems = items && items.length > 0
                  const isEditing = editingId === t.id
                  const sharedLabel = t.is_shared ? (t.share_split === 'full' ? '💯 SHARED' : '½ SHARED') : null
                  return (
                    <div key={t.id} style={{ borderBottom: i < weekTxns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {/* Main row */}
                      <div style={{
                        display: 'flex', alignItems: 'center', padding: '13px 14px',
                        opacity: deletingId === t.id ? 0.3 : 1, transition: 'opacity 0.2s',
                      }}>
                        <div style={{ width: 44, height: 44, borderRadius: 13, background: meta.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, marginRight: 12 }}>
                          {meta.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.subcategory || t.category}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <span>{t.category}</span>
                            <span>·</span>
                            <span>{t.date}</span>
                            {sharedLabel && <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{sharedLabel}</span>}
                            <button onClick={() => toggleExpand(t.id)}
                              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: 'var(--text3)' }}>
                              {isExpanded ? '▾ hide' : hasItems ? `▸ ${items.length} items` : '▸ items'}
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{formatCAD(Number(t.amount))}</span>
                          <button onClick={() => isEditing ? (setEditingId(null), setEditDraft(null)) : startEdit(t)}
                            style={{ color: isEditing ? 'var(--purple)' : 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '2px 4px', lineHeight: 1 }}>✏️</button>
                          <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                            style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 4px', lineHeight: 1 }}>×</button>
                        </div>
                      </div>

                      {/* Inline edit panel */}
                      {isEditing && editDraft && (
                        <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Vendor</div>
                              <input type="text" value={editDraft.subcategory} onChange={e => setEditDraft(d => d && ({ ...d, subcategory: e.target.value }))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Amount</div>
                              <input type="number" inputMode="decimal" value={editDraft.amount} onChange={e => setEditDraft(d => d && ({ ...d, amount: e.target.value }))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={editDraft.date} onChange={e => setEditDraft(d => d && ({ ...d, date: e.target.value }))}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
                          </div>
                          {/* Shared toggle */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Shared with Thiyag</span>
                            <button type="button" onClick={() => setEditDraft(d => d && ({ ...d, is_shared: !d.is_shared }))}
                              style={{ width: 44, height: 26, borderRadius: 13, background: editDraft.is_shared ? 'var(--red)' : 'var(--surface2)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                              <span style={{ position: 'absolute', top: 3, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'transform 0.2s', transform: editDraft.is_shared ? 'translateX(20px)' : 'translateX(3px)', display: 'block' }} />
                            </button>
                          </div>
                          {editDraft.is_shared && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {(['from_thiyag', 'to_thiyag'] as const).map(dir => (
                                  <button key={dir} type="button" onClick={() => setEditDraft(d => d && ({ ...d, shared_direction: dir }))}
                                    style={{ padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${editDraft.shared_direction === dir ? 'var(--red)' : 'var(--border)'}`, background: editDraft.shared_direction === dir ? 'var(--red-dim)' : 'var(--surface2)', color: editDraft.shared_direction === dir ? 'var(--red)' : 'var(--text3)' }}>
                                    {dir === 'from_thiyag' ? '💳 I paid' : '🤝 Thiyag paid'}
                                  </button>
                                ))}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {(['half', 'full'] as const).map(split => (
                                  <button key={split} type="button" onClick={() => setEditDraft(d => d && ({ ...d, share_split: split }))}
                                    style={{ padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${editDraft.share_split === split ? '#7c3aed' : 'var(--border)'}`, background: editDraft.share_split === split ? 'rgba(139,92,246,0.15)' : 'var(--surface2)', color: editDraft.share_split === split ? '#a78bfa' : 'var(--text3)' }}>
                                    {split === 'half' ? '½ Split 50%' : '💯 Full'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button onClick={() => { setEditingId(null); setEditDraft(null) }}
                              style={{ padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            <button onClick={() => saveEdit(t)} disabled={savingEdit}
                              style={{ padding: '10px', borderRadius: 10, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingEdit ? 0.5 : 1 }}>
                              {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Items expansion */}
                      {isExpanded && items && items.length > 0 && (
                        <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '4px 14px 8px 70px' }}>
                          {items.map((item, idx) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '5px 0' }}>
                              <span style={{ color: 'var(--text3)', marginRight: 8, fontSize: 12 }}>{idx === items.length - 1 ? '└' : '├'}</span>
                              <span style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>{item.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatCAD(Number(item.amount))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isExpanded && items && items.length === 0 && (
                        <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '8px 14px 8px 70px', fontSize: 12, color: 'var(--text3)' }}>
                          No items recorded for this transaction.
                        </div>
                      )}
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

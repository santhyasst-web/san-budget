'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export function AskPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const supabase = createClient()

  // Extract monthId from any dashboard route: /dashboard/[monthId]/...
  const monthIdMatch = pathname.match(/\/dashboard\/([^/]+)/)
  const monthId = monthIdMatch ? monthIdMatch[1] : null

  // Must be before early return — hooks must run unconditionally
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Don't show on non-dashboard pages
  if (!monthId || pathname === '/dashboard') return null

  async function fetchContext() {
    if (context || !monthId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch all months for this user
    const { data: allMonths } = await supabase
      .from('months').select('*').eq('user_id', user.id).order('year').order('month')
    if (!allMonths || allMonths.length === 0) return

    const allMonthIds = allMonths.map(m => m.id)

    const [
      { data: allTransactions },
      { data: allVariableBudgets },
      { data: allFixedExpenses },
      { data: allInvestments },
      { data: allAccounts },
    ] = await Promise.all([
      supabase.from('transactions').select('*').in('month_id', allMonthIds),
      supabase.from('variable_budget').select('*').in('month_id', allMonthIds),
      supabase.from('fixed_expenses').select('*').in('month_id', allMonthIds),
      supabase.from('investments').select('*').in('month_id', allMonthIds),
      supabase.from('accounts').select('*').in('month_id', allMonthIds),
    ])

    const fmt = (n: number) => `$${Number(n).toFixed(2)}`
    const eff = (t: { amount: number; is_shared: boolean; share_split: string }) =>
      t.is_shared ? (t.share_split === 'full' ? 0 : t.amount * 0.5) : t.amount

    const currentMonth = allMonths.find(m => m.id === monthId)
    const currentLabel = currentMonth
      ? `${new Date(currentMonth.year, currentMonth.month - 1).toLocaleString('en', { month: 'long' })} ${currentMonth.year}`
      : monthId

    const lines: string[] = [
      `Currently viewing: ${currentLabel}`,
      `Data available for ${allMonths.length} month(s): ${allMonths.map(m => `${new Date(m.year, m.month - 1).toLocaleString('en', { month: 'short' })} ${m.year}`).join(', ')}`,
      '',
    ]

    // Net worth trend summary across all months
    const netWorthByMonth = allMonths.map(m => {
      const accts = (allAccounts ?? []).filter(a => a.month_id === m.id)
      const total = accts.reduce((s, a) => s + Number(a.balance), 0)
      return { label: `${new Date(m.year, m.month - 1).toLocaleString('en', { month: 'short' })} ${m.year}`, total, accts }
    })
    if (netWorthByMonth.some(m => m.total > 0)) {
      lines.push('Net worth by month:')
      netWorthByMonth.forEach(m => lines.push(`  ${m.label}: ${fmt(m.total)}`))
      lines.push('')
    }

    for (const month of allMonths) {
      const label = `${new Date(month.year, month.month - 1).toLocaleString('en', { month: 'long' })} ${month.year}`
      const txns = (allTransactions ?? []).filter(t => t.month_id === month.id)
      const vBudgets = (allVariableBudgets ?? []).filter(b => b.month_id === month.id)
      const fixed = (allFixedExpenses ?? []).filter(e => e.month_id === month.id)
      const invs = (allInvestments ?? []).filter(i => i.month_id === month.id)
      const accts = (allAccounts ?? []).filter(a => a.month_id === month.id)

      const totalIncome = Number(month.salary) + Number(month.rent_income) + Number(month.other_income ?? 0)
      const totalVariableSpent = txns.reduce((s, t) => s + eff(t), 0)
      const totalFixedSpent = fixed.reduce((s, e) => s + Number(e.actual ?? 0), 0)
      const totalSpent = totalVariableSpent + totalFixedSpent
      const netWorth = accts.reduce((s, a) => s + Number(a.balance), 0)

      const variableActuals: Record<string, number> = {}
      txns.forEach(t => { variableActuals[t.category] = (variableActuals[t.category] ?? 0) + eff(t) })

      lines.push(`=== ${label} ===`)
      lines.push(`Income: ${fmt(totalIncome)} | Total expenses: ${fmt(totalSpent)} (variable: ${fmt(totalVariableSpent)}, fixed: ${fmt(totalFixedSpent)}) | Left: ${fmt(totalIncome - totalSpent)}`)
      if (netWorth > 0) lines.push(`Net worth: ${fmt(netWorth)}`)

      if (accts.length > 0) {
        lines.push('Account balances:')
        accts.forEach(a => lines.push(`  ${a.account_name} (${a.account_type}): ${fmt(Number(a.balance))}`))
      }
      if (vBudgets.length > 0) {
        lines.push('Variable budgets:')
        vBudgets.forEach(b => lines.push(`  ${b.category}: budget ${fmt(Number(b.budgeted))}, spent ${fmt(variableActuals[b.category] ?? 0)}`))
      }
      if (fixed.length > 0) {
        lines.push('Fixed expenses:')
        fixed.forEach(e => lines.push(`  ${e.category}: ${fmt(Number(e.actual ?? 0))}`))
      }
      if (invs.length > 0) {
        lines.push('Investments:')
        invs.forEach(i => lines.push(`  ${i.vehicle}: budgeted ${fmt(Number(i.budgeted))}, actual ${fmt(Number(i.actual ?? 0))}`))
      }
      if (txns.length > 0) {
        lines.push('Transactions:')
        txns.forEach(t => lines.push(
          `  ${t.date} | ${t.category} | ${t.subcategory || '—'} | ${fmt(Number(t.amount))}${t.sub_label ? ` [${t.sub_label}]` : ''}${t.is_shared ? ` (shared ${t.share_split})` : ''}`
        ))
      }
      lines.push('')
    }

    setContext(lines.join('\n'))
  }

  async function handleOpen() {
    setOpen(true)
    await fetchContext()
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  async function send() {
    const q = input.trim()
    if (!q || loading || !context) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer ?? 'No answer.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* Floating "?" button — above bottom nav, respects safe area */}
      <button
        onClick={handleOpen}
        aria-label="Ask about your spending"
        style={{
          position: 'fixed',
          bottom: 94,
          right: 16, zIndex: 39,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
          boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
          border: 'none', color: '#fff', fontSize: 20, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>

      {/* Backdrop */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 41 }} />
      )}

      {/* Bottom sheet — anchored at bottom:0, slides up above nav when open */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        zIndex: 50,
        transform: open ? 'translateY(-80px)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '70vh',
        minHeight: 320,
      }}>
        {/* Handle + header */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ask about your spending</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>e.g. "Did I spend more on Uber this month vs last?"</div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && !loading && (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
              Ask anything about your spending — across any month, or compare months.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: m.role === 'user' ? '#7c3aed' : 'var(--surface2)',
              color: '#fff',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px', fontSize: 14, lineHeight: 1.6,
            }}>
              {m.text.split('\n').map((line, j) => (
                <div key={j} style={{ marginBottom: line.startsWith('•') ? 4 : 0 }}>
                  {line || <br />}
                </div>
              ))}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--surface2)', borderRadius: '16px 16px 16px 4px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text3)', animation: `askbounce 1s ease ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={context ? 'Ask a question...' : 'Loading data...'}
            disabled={!context}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: 12, fontSize: 14,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', outline: 'none',
            }}
          />
          <button onClick={send} disabled={!input.trim() || loading || !context}
            style={{
              background: input.trim() && !loading && context ? '#7c3aed' : 'var(--surface3)',
              border: 'none', borderRadius: 12, width: 46, height: 46, flexShrink: 0,
              color: '#fff', fontSize: 20, cursor: input.trim() && !loading && context ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}>↑</button>
        </div>
      </div>

      <style>{`
        @keyframes askbounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  )
}

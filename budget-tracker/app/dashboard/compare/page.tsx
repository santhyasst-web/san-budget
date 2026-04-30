'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCAD } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import type { Month, FixedExpense, VariableBudget, Transaction, Investment } from '@/lib/supabase/types'

interface MonthSnapshot {
  month: Month
  fixedExpenses: FixedExpense[]
  variableBudgets: VariableBudget[]
  transactions: Transaction[]
  investments: Investment[]
}

function diffColor(diff: number) {
  if (diff > 0) return 'var(--red)'
  if (diff < 0) return 'var(--green)'
  return 'var(--text3)'
}

function diffSign(diff: number) {
  return diff > 0 ? '+' : ''
}

export default function ComparePage() {
  const supabase = createClient()
  const [months, setMonths] = useState<Month[]>([])
  const [monthAId, setMonthAId] = useState('')
  const [monthBId, setMonthBId] = useState('')
  const [snapA, setSnapA] = useState<MonthSnapshot | null>(null)
  const [snapB, setSnapB] = useState<MonthSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMonths, setLoadingMonths] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('months').select('*').eq('user_id', user.id)
        .order('year', { ascending: false }).order('month', { ascending: false })
        .then(({ data }) => { setMonths(data ?? []); setLoadingMonths(false) })
    })
  }, [])

  async function loadSnap(monthId: string): Promise<MonthSnapshot | null> {
    const month = months.find(m => m.id === monthId)
    if (!month) return null
    const [{ data: fe }, { data: vb }, { data: txns }, { data: inv }] = await Promise.all([
      supabase.from('fixed_expenses').select('*').eq('month_id', monthId),
      supabase.from('variable_budget').select('*').eq('month_id', monthId),
      supabase.from('transactions').select('*').eq('month_id', monthId),
      supabase.from('investments').select('*').eq('month_id', monthId),
    ])
    return {
      month,
      fixedExpenses: fe ?? [],
      variableBudgets: vb ?? [],
      transactions: txns ?? [],
      investments: inv ?? [],
    }
  }

  async function compare() {
    if (!monthAId || !monthBId || monthAId === monthBId) return
    setLoading(true)
    const [a, b] = await Promise.all([loadSnap(monthAId), loadSnap(monthBId)])
    setSnapA(a)
    setSnapB(b)
    setLoading(false)
  }

  function getTxnActual(snap: MonthSnapshot, category: string) {
    return snap.transactions
      .filter(t => t.category === category)
      .reduce((s, t) => s + (t.is_shared ? Number(t.amount) * 0.5 : Number(t.amount)), 0)
  }

  function getFixedActual(snap: MonthSnapshot, category: string) {
    const fe = snap.fixedExpenses.find(e => e.category === category)
    return fe ? Number(fe.actual ?? fe.budgeted) : 0
  }

  function getInvestmentActual(snap: MonthSnapshot, vehicle: string) {
    const inv = snap.investments.find(i => i.vehicle === vehicle)
    return inv ? Number(inv.actual ?? 0) : 0
  }

  function totalFixed(snap: MonthSnapshot) {
    return snap.fixedExpenses.reduce((s, e) => s + Number(e.actual ?? e.budgeted), 0)
  }

  function totalVariable(snap: MonthSnapshot) {
    const cats = new Set(snap.transactions.map(t => t.category))
    return Array.from(cats).reduce((s, cat) => s + getTxnActual(snap, cat), 0)
  }

  function totalInvestments(snap: MonthSnapshot) {
    return snap.investments.reduce((s, i) => s + Number(i.actual ?? 0), 0)
  }

  function totalIncome(snap: MonthSnapshot) {
    return Number(snap.month.salary) + Number(snap.month.rent_income) + Number(snap.month.other_income)
  }

  const allFixedCats = snapA && snapB
    ? Array.from(new Set([
        ...snapA.fixedExpenses.map(e => e.category),
        ...snapB.fixedExpenses.map(e => e.category),
      ])).sort()
    : []

  const allVariableCats = snapA && snapB
    ? Array.from(new Set([
        ...snapA.transactions.map(t => t.category),
        ...snapB.transactions.map(t => t.category),
      ])).sort()
    : []

  const allInvestmentVehicles = snapA && snapB
    ? Array.from(new Set([
        ...snapA.investments.map(i => i.vehicle),
        ...snapB.investments.map(i => i.vehicle),
      ])).sort()
    : []

  const colStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right', minWidth: 72,
  }
  const rowStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 80px 80px 72px',
    padding: '9px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 4,
  }
  const headerRowStyle: React.CSSProperties = {
    ...rowStyle, background: 'var(--surface2)', padding: '7px 14px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Home</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Compare Months</span>
          <div style={{ width: 48 }} />
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* Month selectors */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {([
              { label: 'Month A', value: monthAId, set: setMonthAId },
              { label: 'Month B', value: monthBId, set: setMonthBId },
            ]).map(({ label, value, set }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                <select
                  value={value}
                  onChange={e => set(e.target.value)}
                  disabled={loadingMonths}
                  style={{ width: '100%', padding: '9px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none' }}
                >
                  <option value="">Select month</option>
                  {months.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={compare}
            disabled={!monthAId || !monthBId || monthAId === monthBId || loading}
            style={{
              width: '100%', padding: '12px', background: 'linear-gradient(135deg,#e5484d,#c0392b)',
              color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 12,
              cursor: 'pointer', opacity: (!monthAId || !monthBId || monthAId === monthBId || loading) ? 0.5 : 1,
            }}
          >{loading ? 'Loading...' : 'Compare'}</button>
        </div>

        {snapA && snapB && (
          <>
            {/* Income */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
              <div style={headerRowStyle}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>INCOME</span>
                <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapA.month.label.split(' ')[0].slice(0, 3)}</span>
                <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapB.month.label.split(' ')[0].slice(0, 3)}</span>
                <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>DIFF</span>
              </div>
              {(() => {
                const a = totalIncome(snapA); const b = totalIncome(snapB); const diff = b - a
                return (
                  <div style={rowStyle}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total Income</span>
                    <span style={colStyle}>{formatCAD(a)}</span>
                    <span style={colStyle}>{formatCAD(b)}</span>
                    <span style={{ ...colStyle, color: diffColor(-diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                  </div>
                )
              })()}
            </div>

            {/* Fixed Expenses */}
            {allFixedCats.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <div style={headerRowStyle}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>FIXED EXPENSES</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapA.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapB.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>DIFF</span>
                </div>
                {allFixedCats.map(cat => {
                  const a = getFixedActual(snapA, cat); const b = getFixedActual(snapB, cat); const diff = b - a
                  return (
                    <div key={cat} style={rowStyle}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{cat}</span>
                      <span style={colStyle}>{formatCAD(a)}</span>
                      <span style={colStyle}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })}
                {(() => {
                  const a = totalFixed(snapA); const b = totalFixed(snapB); const diff = b - a
                  return (
                    <div style={{ ...rowStyle, background: 'var(--surface2)', borderBottom: 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Total</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(a)}</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Variable Expenses */}
            {allVariableCats.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <div style={headerRowStyle}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>VARIABLE EXPENSES</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapA.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapB.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>DIFF</span>
                </div>
                {allVariableCats.map(cat => {
                  const a = getTxnActual(snapA, cat); const b = getTxnActual(snapB, cat); const diff = b - a
                  return (
                    <div key={cat} style={rowStyle}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{cat}</span>
                      <span style={colStyle}>{formatCAD(a)}</span>
                      <span style={colStyle}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })}
                {(() => {
                  const a = totalVariable(snapA); const b = totalVariable(snapB); const diff = b - a
                  return (
                    <div style={{ ...rowStyle, background: 'var(--surface2)', borderBottom: 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Total</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(a)}</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Investments */}
            {allInvestmentVehicles.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <div style={headerRowStyle}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>INVESTMENTS</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapA.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapB.month.label.split(' ')[0].slice(0, 3)}</span>
                  <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>DIFF</span>
                </div>
                {allInvestmentVehicles.map(vehicle => {
                  const a = getInvestmentActual(snapA, vehicle); const b = getInvestmentActual(snapB, vehicle); const diff = b - a
                  return (
                    <div key={vehicle} style={rowStyle}>
                      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{vehicle}</span>
                      <span style={colStyle}>{formatCAD(a)}</span>
                      <span style={colStyle}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(-diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })}
                {(() => {
                  const a = totalInvestments(snapA); const b = totalInvestments(snapB); const diff = b - a
                  return (
                    <div style={{ ...rowStyle, background: 'var(--surface2)', borderBottom: 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Total</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(a)}</span>
                      <span style={{ ...colStyle, color: 'var(--text)' }}>{formatCAD(b)}</span>
                      <span style={{ ...colStyle, color: diffColor(-diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Summary */}
            {(() => {
              const totalA = totalFixed(snapA) + totalVariable(snapA) + totalInvestments(snapA)
              const totalB = totalFixed(snapB) + totalVariable(snapB) + totalInvestments(snapB)
              const diff = totalB - totalA
              const incA = totalIncome(snapA); const incB = totalIncome(snapB)
              const remA = incA - totalA; const remB = incB - totalB
              const remDiff = remB - remA
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={headerRowStyle}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SUMMARY</span>
                    <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapA.month.label.split(' ')[0].slice(0, 3)}</span>
                    <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>{snapB.month.label.split(' ')[0].slice(0, 3)}</span>
                    <span style={{ ...colStyle, fontSize: 10, color: 'var(--text3)' }}>DIFF</span>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total Spent</span>
                    <span style={colStyle}>{formatCAD(totalA)}</span>
                    <span style={colStyle}>{formatCAD(totalB)}</span>
                    <span style={{ ...colStyle, color: diffColor(diff) }}>{diffSign(diff)}{formatCAD(diff)}</span>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>Remaining</span>
                    <span style={{ ...colStyle, color: remA >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCAD(remA)}</span>
                    <span style={{ ...colStyle, color: remB >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCAD(remB)}</span>
                    <span style={{ ...colStyle, color: diffColor(-remDiff) }}>{diffSign(remDiff)}{formatCAD(remDiff)}</span>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

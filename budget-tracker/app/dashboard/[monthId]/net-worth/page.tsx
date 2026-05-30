'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import Link from 'next/link'
import type { Account } from '@/lib/supabase/types'

interface MonthMeta { id: string; year: number; month: number; label: string }

export default function NetWorthPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'liquid' | 'investments'>('all')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('chequing')
  const [addingNew, setAddingNew] = useState(false)
  const [allMonths, setAllMonths] = useState<MonthMeta[]>([])
  const [allAccounts, setAllAccounts] = useState<Account[]>([])
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: accts }, { data: months }] = await Promise.all([
        supabase.from('accounts').select('*').eq('month_id', monthId).order('account_type'),
        supabase.from('months').select('id,year,month,label').eq('user_id', user.id).order('year').order('month'),
      ])
      setAccounts(accts ?? [])
      setLoading(false)
      if (months && months.length > 1) {
        setAllMonths(months)
        const monthIds = months.map((m: MonthMeta) => m.id)
        const { data: hist } = await supabase.from('accounts').select('*').in('month_id', monthIds)
        setAllAccounts(hist ?? [])
      }
    }
    load()
  }, [monthId])

  async function saveBalance(id: string) {
    setSaving(true)
    const val = parseFloat(editValue)
    if (!isNaN(val)) {
      await supabase.from('accounts').update({ balance: val }).eq('id', id)
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, balance: val } : a))
    }
    setEditing(null); setEditValue(''); setSaving(false)
  }

  async function deleteAccount(id: string) {
    if (!confirm('Remove this account?')) return
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  async function addAccount() {
    if (!newName.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('accounts').insert({
      user_id: user.id,
      month_id: monthId,
      account_name: newName.trim(),
      account_type: newType,
      balance: 0,
      is_liquid: ['chequing', 'savings'].includes(newType),
    }).select().single()
    if (data) setAccounts(prev => [...prev, data])
    setNewName(''); setAddingNew(false); setSaving(false)
  }

  const totalWorth = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const liquidWorth = accounts.filter(a => a.is_liquid).reduce((s, a) => s + Number(a.balance), 0)
  const investmentWorth = accounts.filter(a => !a.is_liquid).reduce((s, a) => s + Number(a.balance), 0)
  const typeOrder = ['chequing', 'savings', 'investment', 'tfsa', 'rrsp', 'mutual_fund']
  const sorted = [...accounts].sort((a, b) => typeOrder.indexOf(a.account_type) - typeOrder.indexOf(b.account_type))

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-4 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href={`/dashboard/${monthId}`} className="text-red-400 text-sm font-medium">‹ Summary</Link>
          <h1 className="text-lg font-bold text-white">Net Worth</h1>
          <button onClick={() => setAddingNew(true)} className="text-red-400 text-sm font-medium">+ Add</button>
        </div>
        <div className="flex max-w-lg mx-auto mt-3 gap-1">
          {([['current', 'This Month'], ['history', 'History']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === key ? 'var(--purple, #7c6fcd)' : '#6b7280',
              borderBottom: `2px solid ${activeTab === key ? '#7c6fcd' : 'transparent'}`,
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div>
            {allMonths.length < 2 ? (
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', fontSize: 14 }}>
                Need at least 2 months of data to show history.
              </p>
            ) : (() => {
              // Get unique account names across all months
              const accountNames = [...new Set(allAccounts.map(a => a.account_name))].sort()
              const fmt = (n: number) => n === 0 ? '—' : `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              const monthTotals = allMonths.map(m => ({
                ...m,
                total: allAccounts.filter(a => a.month_id === m.id).reduce((s, a) => s + Number(a.balance), 0),
              }))
              return (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: allMonths.length * 80 + 120 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', background: '#1f2937', position: 'sticky', left: 0, zIndex: 2, minWidth: 120 }}>Account</th>
                        {allMonths.map(m => (
                          <th key={m.id} style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', background: '#1f2937', whiteSpace: 'nowrap', minWidth: 80 }}>
                            {new Date(m.year, m.month - 1).toLocaleString('en', { month: 'short' })} {m.year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accountNames.map((name, ri) => (
                        <tr key={name} style={{ background: ri % 2 === 0 ? '#111827' : '#1f2937' }}>
                          <td style={{ padding: '10px 10px', color: '#fff', fontWeight: 600, position: 'sticky', left: 0, background: ri % 2 === 0 ? '#111827' : '#1f2937', zIndex: 1 }}>{name}</td>
                          {allMonths.map(m => {
                            const acct = allAccounts.find(a => a.month_id === m.id && a.account_name === name)
                            const bal = acct ? Number(acct.balance) : null
                            const prev = allMonths[allMonths.indexOf(m) - 1]
                            const prevAcct = prev ? allAccounts.find(a => a.month_id === prev.id && a.account_name === name) : null
                            const delta = bal !== null && prevAcct ? bal - Number(prevAcct.balance) : null
                            return (
                              <td key={m.id} style={{ textAlign: 'right', padding: '10px 10px', color: bal !== null ? '#fff' : '#4b5563', whiteSpace: 'nowrap' }}>
                                {bal !== null ? fmt(bal) : '—'}
                                {delta !== null && delta !== 0 && (
                                  <div style={{ fontSize: 10, color: delta > 0 ? '#30a46c' : '#e5484d', fontWeight: 600 }}>
                                    {delta > 0 ? '+' : ''}{fmt(delta)}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{ background: '#0d1426', borderTop: '1px solid #374151' }}>
                        <td style={{ padding: '10px 10px', color: '#a78bfa', fontWeight: 800, fontSize: 13, position: 'sticky', left: 0, background: '#0d1426', zIndex: 1 }}>NET WORTH</td>
                        {monthTotals.map((m, i) => {
                          const delta = i > 0 ? m.total - monthTotals[i - 1].total : null
                          return (
                            <td key={m.id} style={{ textAlign: 'right', padding: '10px 10px', color: '#a78bfa', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>
                              {fmt(m.total)}
                              {delta !== null && delta !== 0 && (
                                <div style={{ fontSize: 10, color: delta > 0 ? '#30a46c' : '#e5484d', fontWeight: 600 }}>
                                  {delta > 0 ? '+' : ''}{fmt(delta)}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {activeTab === 'current' && <><div className="grid grid-cols-3 gap-2">
          {([
            { key: 'all' as const, label: 'Total Worth', amount: totalWorth },
            { key: 'liquid' as const, label: 'Liquid', amount: liquidWorth },
            { key: 'investments' as const, label: 'Investments', amount: investmentWorth },
          ]).map(tile => {
            const isActive = activeFilter === tile.key
            return (
              <button
                key={tile.key}
                onClick={() => setActiveFilter(tile.key)}
                className={`rounded-xl p-3 text-center w-full ${isActive ? 'bg-red-600' : 'bg-gray-800 border border-gray-700'}`}
              >
                <p className={`text-xs font-medium ${isActive ? 'text-red-100' : 'text-gray-400'}`}>{tile.label}</p>
                <p className="text-sm font-bold mt-1 text-white"><CurrencyDisplay amount={tile.amount} /></p>
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {sorted.filter(a =>
              activeFilter === 'all' ? true :
              activeFilter === 'liquid' ? a.is_liquid : !a.is_liquid
            ).map(account => (
              <div key={account.id} className="px-4 py-3 border-b border-gray-700 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{account.account_name}</p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{account.account_type.replace('_', ' ')}</p>
                  </div>
                  {editing === account.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="decimal" step="0.01"
                        value={editValue} onChange={e => setEditValue(e.target.value)}
                        className="w-28 px-2 py-1 bg-gray-700 border border-red-500 rounded-lg text-sm text-right text-white focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveBalance(account.id)} disabled={saving} className="text-red-400 font-semibold text-sm">Save</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setEditing(account.id); setEditValue(String(account.balance)) }} className="text-right">
                        <p className="font-semibold text-white"><CurrencyDisplay amount={Number(account.balance)} /></p>
                        <p className="text-xs text-red-400">tap to edit</p>
                      </button>
                      <button onClick={() => deleteAccount(account.id)} className="text-gray-600 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No accounts yet. Tap + Add to get started.</p>
            )}
          </div>
        )}

        {addingNew && (
          <div className="bg-gray-800 rounded-xl border border-red-800 p-4 space-y-3">
            <h3 className="font-semibold text-white">New Account</h3>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
            <select value={newType} onChange={e => setNewType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none">
              <option value="chequing">Chequing</option>
              <option value="savings">Savings</option>
              <option value="investment">Investment</option>
              <option value="tfsa">TFSA</option>
              <option value="rrsp">RRSP</option>
              <option value="mutual_fund">Mutual Fund</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setAddingNew(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-sm text-gray-400">Cancel</button>
              <button onClick={addAccount} disabled={saving || !newName.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Add</button>
            </div>
          </div>
        )}
        </>}
      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

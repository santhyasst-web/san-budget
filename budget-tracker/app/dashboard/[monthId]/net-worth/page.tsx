'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import Link from 'next/link'
import type { Account } from '@/lib/supabase/types'

export default function NetWorthPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('chequing')
  const [addingNew, setAddingNew] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('accounts').select('*').eq('month_id', monthId).order('account_type')
      .then(({ data }) => { setAccounts(data ?? []); setLoading(false) })
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
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Total Worth', amount: totalWorth, highlight: true },
            { label: 'Liquid', amount: liquidWorth, highlight: false },
            { label: 'Investments', amount: investmentWorth, highlight: false },
          ].map(card => (
            <div key={card.label} className={`rounded-xl p-3 text-center ${card.highlight ? 'bg-red-600' : 'bg-gray-800 border border-gray-700'}`}>
              <p className={`text-xs font-medium ${card.highlight ? 'text-red-100' : 'text-gray-400'}`}>{card.label}</p>
              <p className={`text-sm font-bold mt-1 ${card.highlight ? 'text-white' : 'text-white'}`}>
                <CurrencyDisplay amount={card.amount} />
              </p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {sorted.map(account => (
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
      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

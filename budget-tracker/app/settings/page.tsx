'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import { DEFAULT_FIXED_EXPENSES, DEFAULT_VARIABLE_BUDGETS } from '@/lib/constants/categories'
import { DEFAULT_ACCOUNTS, DEFAULT_INVESTMENTS } from '@/lib/constants/accounts'
import { getMonthName } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import type { Month, FixedExpense, VariableBudget, Investment, Account } from '@/lib/supabase/types'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function SettingsPage() {
  const router = useRouter()
  const [months, setMonths] = useState<Month[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)

  const now = new Date()
  const [newYear, setNewYear] = useState(now.getFullYear())
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1)
  const [salary, setSalary] = useState('9445.66')
  const [rentIncome, setRentIncome] = useState('930')
  const [otherIncome, setOtherIncome] = useState('0')

  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [variableBudgets, setVariableBudgets] = useState<VariableBudget[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [editingFixed, setEditingFixed] = useState<string | null>(null)
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [editingInvestment, setEditingInvestment] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u ? { id: u.id, email: u.email } : null)
      if (u) {
        const { data } = await supabase.from('months').select('*').eq('user_id', u.id)
          .order('year', { ascending: false }).order('month', { ascending: false })
        setMonths(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function createMonth() {
    if (!user) return
    setSaving(true)
    const label = `${MONTH_NAMES[newMonth - 1]} ${newYear}`
    const { data: month, error } = await supabase.from('months').insert({
      user_id: user.id,
      year: newYear,
      month: newMonth,
      label,
      salary: parseFloat(salary) || 0,
      rent_income: parseFloat(rentIncome) || 0,
      other_income: parseFloat(otherIncome) || 0,
    }).select().single()

    if (error || !month) {
      alert(error?.message ?? 'Failed to create month')
      setSaving(false)
      return
    }

    const prevMonth = months[0]
    let fixedToInsert = DEFAULT_FIXED_EXPENSES.map(e => ({ ...e, user_id: user.id, month_id: month.id }))
    let variableToInsert = Object.entries(DEFAULT_VARIABLE_BUDGETS).map(([category, budgeted]) => ({
      user_id: user.id, month_id: month.id, category, budgeted
    }))
    let investToInsert = DEFAULT_INVESTMENTS.map(i => ({ ...i, user_id: user.id, month_id: month.id }))
    let accountsToInsert = DEFAULT_ACCOUNTS.map(a => ({ ...a, user_id: user.id, month_id: month.id, balance: 0 }))

    if (prevMonth) {
      const [{ data: pFixed }, { data: pVar }, { data: pInv }, { data: pAcc }] = await Promise.all([
        supabase.from('fixed_expenses').select('*').eq('month_id', prevMonth.id),
        supabase.from('variable_budget').select('*').eq('month_id', prevMonth.id),
        supabase.from('investments').select('*').eq('month_id', prevMonth.id),
        supabase.from('accounts').select('*').eq('month_id', prevMonth.id),
      ])
      if (pFixed?.length) fixedToInsert = pFixed.map(({ id, month_id, ...rest }: FixedExpense) => ({ ...rest, month_id: month.id }))
      if (pVar?.length) variableToInsert = pVar.map(({ id, month_id, ...rest }: VariableBudget) => ({ ...rest, month_id: month.id }))
      if (pInv?.length) investToInsert = pInv.map(({ id, month_id, actual, contributed_date, ...rest }: Investment) => ({ ...rest, month_id: month.id, actual: null, contributed_date: null }))
      if (pAcc?.length) accountsToInsert = pAcc.map(({ id, month_id, balance, ...rest }: Account) => ({ ...rest, month_id: month.id, balance: 0 }))
    }

    await Promise.all([
      supabase.from('fixed_expenses').insert(fixedToInsert),
      supabase.from('variable_budget').insert(variableToInsert),
      supabase.from('investments').insert(investToInsert),
      supabase.from('accounts').insert(accountsToInsert),
    ])

    setMonths(prev => [month as Month, ...prev])
    setCreating(false)
    setSaving(false)
    router.push(`/dashboard/${month.id}`)
  }

  async function loadMonthDetails(monthId: string) {
    setSelectedMonthId(monthId)
    const [{ data: f }, { data: v }, { data: i }] = await Promise.all([
      supabase.from('fixed_expenses').select('*').eq('month_id', monthId).order('category'),
      supabase.from('variable_budget').select('*').eq('month_id', monthId).order('category'),
      supabase.from('investments').select('*').eq('month_id', monthId).order('vehicle'),
    ])
    setFixedExpenses(f ?? [])
    setVariableBudgets(v ?? [])
    setInvestments(i ?? [])
  }

  async function saveFixed(id: string) {
    const val = parseFloat(editValue)
    if (!isNaN(val)) {
      await supabase.from('fixed_expenses').update({ actual: val }).eq('id', id)
      setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, actual: val } : e))
    }
    setEditingFixed(null); setEditValue('')
  }

  async function saveVariable(id: string) {
    const val = parseFloat(editValue)
    if (!isNaN(val)) {
      await supabase.from('variable_budget').update({ budgeted: val }).eq('id', id)
      setVariableBudgets(prev => prev.map(b => b.id === id ? { ...b, budgeted: val } : b))
    }
    setEditingVariable(null); setEditValue('')
  }

  async function saveInvestment(id: string) {
    const val = parseFloat(editValue)
    if (!isNaN(val)) {
      await supabase.from('investments').update({ actual: val }).eq('id', id)
      setInvestments(prev => prev.map(i => i.id === id ? { ...i, actual: val } : i))
    }
    setEditingInvestment(null); setEditValue('')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputClass = "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
  const editInputClass = "w-24 px-2 py-1 bg-gray-700 border border-red-500 rounded text-sm text-right text-white focus:outline-none"

  return (
    <div className="min-h-screen bg-gray-900 pb-8">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-4 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/dashboard" className="text-red-400 text-sm font-medium">‹ Back</Link>
          <h1 className="text-lg font-bold text-white">Settings</h1>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">

        {/* User info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-white">Signed in as</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
          <button onClick={handleSignOut} className="text-sm text-red-400 font-medium">Sign out</button>
        </div>

        {/* Months */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-semibold text-white">Months</h2>
            <button onClick={() => setCreating(true)} className="text-sm text-red-400 font-medium">+ New Month</button>
          </div>

          {creating && (
            <div className="bg-gray-800 rounded-xl border border-red-800 p-4 space-y-3 mb-3">
              <h3 className="font-semibold text-white">New Month</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Month</label>
                  <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none">
                    {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Year</label>
                  <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))} className={inputClass} />
                </div>
              </div>
              {[
                { label: 'Salary', value: salary, set: setSalary },
                { label: 'Rent Income', value: rentIncome, set: setRentIncome },
                { label: 'Other Income', value: otherIncome, set: setOtherIncome },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                  <input type="number" inputMode="decimal" step="0.01" value={value} onChange={e => set(e.target.value)} className={inputClass} />
                </div>
              ))}
              <p className="text-xs text-gray-500">Budgets from previous month will be copied automatically.</p>
              <div className="flex gap-2">
                <button onClick={() => setCreating(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-sm text-gray-400">Cancel</button>
                <button onClick={createMonth} disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Month'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-2">
              {months.map(m => (
                <div key={m.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{m.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Income: <CurrencyDisplay amount={Number(m.salary) + Number(m.rent_income) + Number(m.other_income)} />
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/${m.id}`} className="text-sm text-red-400 font-medium">View</Link>
                      <button
                        onClick={() => selectedMonthId === m.id ? setSelectedMonthId(null) : loadMonthDetails(m.id)}
                        className="text-sm text-gray-500"
                      >
                        {selectedMonthId === m.id ? 'Close' : 'Edit'}
                      </button>
                    </div>
                  </div>

                  {selectedMonthId === m.id && (
                    <div className="border-t border-gray-700 px-4 pb-4 pt-3 space-y-4">
                      {[
                        {
                          title: 'Fixed Expenses — Actual Paid',
                          items: fixedExpenses,
                          editing: editingFixed,
                          setEditing: setEditingFixed,
                          save: saveFixed,
                          getValue: (e: FixedExpense) => e.actual ?? e.budgeted,
                          getLabel: (e: FixedExpense) => e.category,
                          nullLabel: '(budgeted)',
                          isNull: (e: FixedExpense) => e.actual == null,
                        },
                      ].map(section => (
                        <div key={section.title}>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{section.title}</h4>
                          <div className="space-y-1">
                            {section.items.map((e: FixedExpense) => (
                              <div key={e.id} className="flex items-center justify-between py-1.5">
                                <span className="text-sm text-gray-300">{section.getLabel(e)}</span>
                                {section.editing === e.id ? (
                                  <div className="flex items-center gap-2">
                                    <input type="number" inputMode="decimal" step="0.01" value={editValue}
                                      onChange={ev => setEditValue(ev.target.value)} className={editInputClass} autoFocus />
                                    <button onClick={() => section.save(e.id)} className="text-red-400 text-sm font-medium">Save</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { section.setEditing(e.id); setEditValue(String(section.getValue(e))) }} className="text-sm text-right">
                                    <span className={section.isNull(e) ? 'text-gray-500' : 'text-white'}>
                                      <CurrencyDisplay amount={section.getValue(e)} />
                                    </span>
                                    {section.isNull(e) && <span className="text-xs text-gray-600 ml-1">{section.nullLabel}</span>}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variable Budgets</h4>
                        <div className="space-y-1">
                          {variableBudgets.map(b => (
                            <div key={b.id} className="flex items-center justify-between py-1.5">
                              <span className="text-sm text-gray-300">{b.category}</span>
                              {editingVariable === b.id ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" inputMode="decimal" step="0.01" value={editValue}
                                    onChange={ev => setEditValue(ev.target.value)} className={editInputClass} autoFocus />
                                  <button onClick={() => saveVariable(b.id)} className="text-red-400 text-sm font-medium">Save</button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditingVariable(b.id); setEditValue(String(b.budgeted)) }} className="text-sm text-white">
                                  <CurrencyDisplay amount={Number(b.budgeted)} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Investments — Actual Contributed</h4>
                        <div className="space-y-1">
                          {investments.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between py-1.5">
                              <span className="text-sm text-gray-300">{inv.vehicle}</span>
                              {editingInvestment === inv.id ? (
                                <div className="flex items-center gap-2">
                                  <input type="number" inputMode="decimal" step="0.01" value={editValue}
                                    onChange={ev => setEditValue(ev.target.value)} className={editInputClass} autoFocus />
                                  <button onClick={() => saveInvestment(inv.id)} className="text-red-400 text-sm font-medium">Save</button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditingInvestment(inv.id); setEditValue(String(inv.actual ?? inv.budgeted)) }} className="text-sm text-right">
                                  <span className={inv.actual != null ? 'text-white' : 'text-gray-500'}>
                                    <CurrencyDisplay amount={Number(inv.actual ?? inv.budgeted)} />
                                  </span>
                                  {inv.actual == null && <span className="text-xs text-gray-600 ml-1">(budgeted)</span>}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


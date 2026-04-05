'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_FIXED_EXPENSES, DEFAULT_VARIABLE_BUDGETS } from '@/lib/constants/categories'
import { DEFAULT_ACCOUNTS, DEFAULT_INVESTMENTS } from '@/lib/constants/accounts'
import { getMonthName } from '@/lib/calculations/monthlySummary'
import Link from 'next/link'
import type { Month, FixedExpense, VariableBudget, Investment, Account } from '@/lib/supabase/types'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthIdParam = searchParams.get('monthId')

  const [months, setMonths] = useState<Month[]>([])
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string; full_name?: string } | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [activeSection, setActiveSection] = useState<'months' | 'categories' | 'account'>('months')

  const now = new Date()
  const [newYear, setNewYear] = useState(now.getFullYear())
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1)
  const [salary, setSalary] = useState('')
  const [rentIncome, setRentIncome] = useState('')
  const [otherIncome, setOtherIncome] = useState('')

  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(monthIdParam)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [variableBudgets, setVariableBudgets] = useState<VariableBudget[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [editingFixed, setEditingFixed] = useState<string | null>(null)
  const [editingFixedField, setEditingFixedField] = useState<'budgeted' | 'actual'>('actual')
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [editingInvestment, setEditingInvestment] = useState<string | null>(null)
  const [editingInvestmentField, setEditingInvestmentField] = useState<'budgeted' | 'actual'>('actual')
  const [editValue, setEditValue] = useState('')

  // New category
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryBudget, setNewCategoryBudget] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      const name = u?.user_metadata?.full_name ?? ''
      setUser(u ? { id: u.id, email: u.email, full_name: name } : null)
      setNameValue(name)
      if (u) {
        const { data } = await supabase.from('months').select('*').eq('user_id', u.id)
          .order('year', { ascending: false }).order('month', { ascending: false })
        setMonths(data ?? [])
        if (monthIdParam) {
          loadMonthDetails(monthIdParam)
        }
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
      user_id: user.id, year: newYear, month: newMonth, label,
      salary: parseFloat(salary) || 0,
      rent_income: parseFloat(rentIncome) || 0,
      other_income: parseFloat(otherIncome) || 0,
    }).select().single()

    if (error || !month) { alert(error?.message ?? 'Failed to create month'); setSaving(false); return }

    const prevMonth = months[0]
    let fixedToInsert = DEFAULT_FIXED_EXPENSES.map(e => ({ ...e, user_id: user.id, month_id: month.id }))
    let variableToInsert = Object.entries(DEFAULT_VARIABLE_BUDGETS).map(([category, budgeted]) => ({ user_id: user.id, month_id: month.id, category, budgeted }))
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
      await supabase.from('fixed_expenses').update({ [editingFixedField]: val }).eq('id', id)
      setFixedExpenses(prev => prev.map(e => e.id === id ? { ...e, [editingFixedField]: val } : e))
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
      await supabase.from('investments').update({ [editingInvestmentField]: val }).eq('id', id)
      setInvestments(prev => prev.map(i => i.id === id ? { ...i, [editingInvestmentField]: val } : i))
    }
    setEditingInvestment(null); setEditValue('')
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Existing transactions will not be deleted.')) return
    await supabase.from('variable_budget').delete().eq('id', id)
    setVariableBudgets(prev => prev.filter(b => b.id !== id))
  }

  async function addCategory() {
    if (!newCategoryName.trim() || !selectedMonthId || !user) return
    const budget = parseFloat(newCategoryBudget) || 0
    const { data, error } = await supabase.from('variable_budget').insert({
      user_id: user.id,
      month_id: selectedMonthId,
      category: newCategoryName.trim(),
      budgeted: budget,
    }).select().single()
    if (!error && data) {
      setVariableBudgets(prev => [...prev, data].sort((a, b) => a.category.localeCompare(b.category)))
      setNewCategoryName('')
      setNewCategoryBudget('')
      setAddingCategory(false)
    }
  }

  async function saveName() {
    if (!nameValue.trim()) return
    setSavingName(true)
    await supabase.auth.updateUser({ data: { full_name: nameValue.trim() } })
    setUser(prev => prev ? { ...prev, full_name: nameValue.trim() } : prev)
    setSavingName(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 10 }
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid var(--border)' }
  const labelStyle: React.CSSProperties = { fontSize: 14, color: 'var(--text)', fontWeight: 500 }
  const valueStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text)' }
  const dimStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text3)' }
  const inputStyle: React.CSSProperties = { width: 90, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--text)', fontSize: 14, textAlign: 'right', outline: 'none' }
  const saveBtn: React.CSSProperties = { color: 'var(--red)', fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }

  const backHref = monthIdParam ? `/dashboard/${monthIdParam}` : '/dashboard'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={backHref} style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Back</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Settings</span>
          <button onClick={handleSignOut} style={{ color: 'var(--text3)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
        </div>

        {/* Section tabs */}
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', borderTop: '1px solid var(--border)' }}>
          {(['months', 'categories', 'account'] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)} style={{
              flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase',
              color: activeSection === s ? 'var(--purple)' : 'var(--text3)',
              borderBottom: `2px solid ${activeSection === s ? 'var(--purple)' : 'transparent'}`,
            }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* ── MONTHS TAB ── */}
        {activeSection === 'months' && (
          <>
            <button onClick={() => setCreating(true)} style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg,#e5484d,#c0392b)',
              color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 14,
              cursor: 'pointer', marginBottom: 14, boxShadow: '0 4px 16px rgba(229,72,77,0.35)',
            }}>+ New Month</button>

            {creating && (
              <div style={{ ...cardStyle, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Create New Month</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={dimStyle}>Month</div>
                    <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, marginTop: 4 }}>
                      {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={dimStyle}>Year</div>
                    <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                      style={{ ...inputStyle, width: '100%', marginTop: 4 }} />
                  </div>
                </div>
                {[
                  { label: 'Salary', value: salary, set: setSalary },
                  { label: 'Rent Income', value: rentIncome, set: setRentIncome },
                  { label: 'Other Income', value: otherIncome, set: setOtherIncome },
                ].map(({ label, value, set }) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={dimStyle}>{label}</div>
                    <input type="number" inputMode="decimal" value={value} onChange={e => set(e.target.value)}
                      style={{ ...inputStyle, width: '100%', marginTop: 4 }} />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Budgets from previous month will be copied automatically.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCreating(false)} style={{ flex: 1, padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={createMonth} disabled={saving} style={{ flex: 1, padding: '12px', background: 'var(--red)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>
            ) : (
              months.map(m => (
                <div key={m.id} style={cardStyle}>
                  <div style={{ ...rowStyle, borderBottom: selectedMonthId === m.id ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <div style={labelStyle}>{m.label}</div>
                      <div style={dimStyle}>${(Number(m.salary) + Number(m.rent_income) + Number(m.other_income)).toFixed(2)} income</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Link href={`/dashboard/${m.id}`} style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>View</Link>
                      <button onClick={() => selectedMonthId === m.id ? setSelectedMonthId(null) : loadMonthDetails(m.id)}
                        style={{ ...saveBtn, color: 'var(--purple)' }}>
                        {selectedMonthId === m.id ? 'Close' : 'Edit'}
                      </button>
                    </div>
                  </div>

                  {selectedMonthId === m.id && (
                    <div style={{ padding: '12px 16px' }}>

                      {/* Fixed Expenses */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Fixed Expenses</div>
                      {fixedExpenses.map((e, i) => (
                        <div key={e.id} style={{ padding: '10px 0', borderBottom: i < fixedExpenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={labelStyle}>{e.category}</div>
                          {editingFixed === e.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <span style={dimStyle}>{editingFixedField === 'budgeted' ? 'Budget:' : 'Actual:'}</span>
                              <input type="number" inputMode="decimal" step="0.01" value={editValue}
                                onChange={ev => setEditValue(ev.target.value)} style={inputStyle} autoFocus />
                              <button onClick={() => saveFixed(e.id)} style={saveBtn}>Save</button>
                              <button onClick={() => setEditingFixed(null)} style={{ ...saveBtn, color: 'var(--text3)' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button onClick={() => { setEditingFixed(e.id); setEditingFixedField('budgeted'); setEditValue(String(e.budgeted)) }}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>BUDGET</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${Number(e.budgeted).toFixed(2)}</div>
                              </button>
                              <button onClick={() => { setEditingFixed(e.id); setEditingFixedField('actual'); setEditValue(String(e.actual ?? e.budgeted)) }}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>ACTUAL</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: e.actual != null ? 'var(--green)' : 'var(--text3)' }}>
                                  {e.actual != null ? `$${Number(e.actual).toFixed(2)}` : 'not set'}
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Investments */}
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 8px' }}>Investments</div>
                      {investments.map((inv, i) => (
                        <div key={inv.id} style={{ padding: '10px 0', borderBottom: i < investments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={labelStyle}>{inv.vehicle}</div>
                          {editingInvestment === inv.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                              <span style={dimStyle}>{editingInvestmentField === 'budgeted' ? 'Budget:' : 'Actual:'}</span>
                              <input type="number" inputMode="decimal" step="0.01" value={editValue}
                                onChange={ev => setEditValue(ev.target.value)} style={inputStyle} autoFocus />
                              <button onClick={() => saveInvestment(inv.id)} style={saveBtn}>Save</button>
                              <button onClick={() => setEditingInvestment(null)} style={{ ...saveBtn, color: 'var(--text3)' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button onClick={() => { setEditingInvestment(inv.id); setEditingInvestmentField('budgeted'); setEditValue(String(inv.budgeted)) }}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>BUDGET</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>${Number(inv.budgeted).toFixed(2)}</div>
                              </button>
                              <button onClick={() => { setEditingInvestment(inv.id); setEditingInvestmentField('actual'); setEditValue(String(inv.actual ?? 0)) }}
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)' }}>ACTUAL</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: inv.actual != null ? 'var(--green)' : 'var(--text3)' }}>
                                  {inv.actual != null ? `$${Number(inv.actual).toFixed(2)}` : 'not set'}
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ── CATEGORIES TAB ── */}
        {activeSection === 'categories' && (
          <>
            {!selectedMonthId ? (
              <div style={{ ...cardStyle, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>Select a month to manage its categories</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {months.map(m => (
                    <button key={m.id} onClick={() => { loadMonthDetails(m.id); }}
                      style={{ padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                    {months.find(m => m.id === selectedMonthId)?.label}
                  </div>
                  <button onClick={() => setSelectedMonthId(null)} style={{ ...saveBtn, color: 'var(--text3)', fontSize: 12 }}>Change month</button>
                </div>

                <div style={cardStyle}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Variable Categories</span>
                    <button onClick={() => setAddingCategory(!addingCategory)} style={{ ...saveBtn, fontSize: 13 }}>+ Add</button>
                  </div>

                  {addingCategory && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      <input type="text" placeholder="Category name (e.g. Coffee)" value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        style={{ ...inputStyle, width: '100%', textAlign: 'left', marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" inputMode="decimal" placeholder="Monthly budget" value={newCategoryBudget}
                          onChange={e => setNewCategoryBudget(e.target.value)}
                          style={{ ...inputStyle, flex: 1 }} />
                        <button onClick={addCategory} style={{ padding: '8px 16px', background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Add</button>
                        <button onClick={() => setAddingCategory(false)} style={{ ...saveBtn, color: 'var(--text3)' }}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {variableBudgets.map((b, i) => (
                    <div key={b.id} style={{ ...rowStyle, borderBottom: i < variableBudgets.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={labelStyle}>{b.category}</div>
                        <div style={dimStyle}>Budget: ${Number(b.budgeted).toFixed(2)}/mo</div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {editingVariable === b.id ? (
                          <>
                            <input type="number" inputMode="decimal" step="0.01" value={editValue}
                              onChange={ev => setEditValue(ev.target.value)} style={inputStyle} autoFocus />
                            <button onClick={() => saveVariable(b.id)} style={saveBtn}>Save</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingVariable(b.id); setEditValue(String(b.budgeted)) }}
                            style={{ ...saveBtn, color: 'var(--purple)' }}>Edit</button>
                        )}
                        <button onClick={() => deleteCategory(b.id)}
                          style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── ACCOUNT TAB ── */}
        {activeSection === 'account' && (
          <div style={cardStyle}>
            <div style={{ ...rowStyle }}>
              <div>
                <div style={labelStyle}>Signed in as</div>
                <div style={dimStyle}>{user?.email}</div>
              </div>
              <button onClick={handleSignOut} style={{ ...saveBtn, color: 'var(--red)' }}>Sign out</button>
            </div>
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
              <div style={{ ...dimStyle, marginBottom: 6 }}>Your name (used in app title)</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  placeholder="Enter your first name"
                  style={{ ...inputStyle, flex: 1, textAlign: 'left' }}
                />
                <button onClick={saveName} disabled={savingName || !nameValue.trim()}
                  style={{ ...saveBtn, opacity: savingName ? 0.5 : 1 }}>
                  {savingName ? 'Saving...' : 'Save'}
                </button>
              </div>
              {user?.full_name && (
                <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 6 }}>
                  App title: {user.full_name} Budget
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}

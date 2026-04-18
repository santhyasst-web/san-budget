'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMonthName } from '@/lib/calculations/monthlySummary'
import { DEFAULT_FIXED_EXPENSES, DEFAULT_VARIABLE_BUDGETS } from '@/lib/constants/categories'
import { DEFAULT_ACCOUNTS, DEFAULT_INVESTMENTS } from '@/lib/constants/accounts'
import Link from 'next/link'
import type { Month } from '@/lib/supabase/types'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Step = 'name' | 'tracking' | 'fixed' | 'variable' | 'investments' | 'income' | 'month'
const STEPS: Step[] = ['name', 'tracking', 'fixed', 'variable', 'investments', 'income', 'month']

const DEFAULT_FIXED_NAMES = DEFAULT_FIXED_EXPENSES.map(e => e.category)
const DEFAULT_VARIABLE_NAMES = Object.keys(DEFAULT_VARIABLE_BUDGETS)
const DEFAULT_INVESTMENT_NAMES = DEFAULT_INVESTMENTS.map(i => i.vehicle)

// Category picker — shows chips, tap to toggle, add custom
function CategoryPicker({
  title, emoji, description,
  defaults, selected, setSelected,
  custom, setCustom,
}: {
  title: string; emoji: string; description: string
  defaults: string[]
  selected: string[]; setSelected: (v: string[]) => void
  custom: string; setCustom: (v: string) => void
}) {
  function toggle(cat: string) {
    setSelected(selected.includes(cat) ? selected.filter(c => c !== cat) : [...selected, cat])
  }
  function addCustom() {
    const trimmed = custom.trim()
    if (!trimmed || selected.includes(trimmed)) { setCustom(''); return }
    setSelected([...selected, trimmed])
    setCustom('')
  }
  // Extra selected items not in defaults (custom ones already added)
  const extras = selected.filter(c => !defaults.includes(c))

  return (
    <div>
      <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>{emoji}</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', margin: '0 0 20px' }}>{description}</p>

      {/* Default chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {defaults.map(cat => {
          const on = selected.includes(cat)
          return (
            <button key={cat} type="button" onClick={() => toggle(cat)} style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: `1px solid ${on ? 'var(--red)' : 'var(--border)'}`,
              background: on ? 'var(--red-dim)' : 'var(--surface2)',
              color: on ? 'var(--red)' : 'var(--text3)',
            }}>{cat}</button>
          )
        })}
        {/* Custom ones already added */}
        {extras.map(cat => (
          <button key={cat} type="button" onClick={() => toggle(cat)} style={{
            padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: '1px solid var(--red)',
            background: 'var(--red-dim)', color: 'var(--red)',
          }}>{cat} ×</button>
        ))}
      </div>

      {/* Add custom */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text" value={custom} onChange={e => setCustom(e.target.value)}
          placeholder="Add your own category..."
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          style={{
            flex: 1, padding: '10px 14px', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
            fontSize: 14, outline: 'none',
          }}
        />
        <button type="button" onClick={addCustom} style={{
          padding: '10px 16px', background: 'var(--red)', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Add</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
        {selected.length} selected — tap to deselect
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<Month[]>([])
  const [user, setUser] = useState<{ id: string; email?: string; full_name?: string } | null>(null)

  // Onboarding state
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [trackingMode, setTrackingMode] = useState<'weekly' | 'monthly'>('weekly')
  const [selectedFixed, setSelectedFixed] = useState<string[]>(DEFAULT_FIXED_NAMES)
  const [customFixed, setCustomFixed] = useState('')
  const [selectedVariable, setSelectedVariable] = useState<string[]>(DEFAULT_VARIABLE_NAMES)
  const [customVariable, setCustomVariable] = useState('')
  const [selectedInvestments, setSelectedInvestments] = useState<string[]>(DEFAULT_INVESTMENT_NAMES)
  const [customInvestment, setCustomInvestment] = useState('')
  const [salary, setSalary] = useState('')
  const [rentIncome, setRentIncome] = useState('')
  const [otherIncome, setOtherIncome] = useState('')
  const now = new Date()
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1)
  const [newYear, setNewYear] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/login'); return }
      const full_name = u.user_metadata?.full_name ?? ''
      setUser({ id: u.id, email: u.email, full_name })
      if (full_name) setName(full_name)
      const { data } = await supabase.from('months').select('*').eq('user_id', u.id)
        .order('year', { ascending: false }).order('month', { ascending: false })
      setMonths(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function goNext() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }
  function goBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  async function finishOnboarding() {
    if (!user || !name.trim()) return
    setSaving(true)

    await supabase.auth.updateUser({ data: { full_name: name.trim(), tracking_mode: trackingMode } })

    const label = `${MONTH_NAMES[newMonth - 1]} ${newYear}`
    const { data: month, error } = await supabase.from('months').insert({
      user_id: user.id, year: newYear, month: newMonth, label,
      salary: parseFloat(salary) || 0,
      rent_income: parseFloat(rentIncome) || 0,
      other_income: parseFloat(otherIncome) || 0,
    }).select().single()

    if (error || !month) { setSaving(false); return }

    await Promise.all([
      supabase.from('fixed_expenses').insert(
        selectedFixed.map(category => ({ category, budgeted: 0, user_id: user.id, month_id: month.id }))
      ),
      supabase.from('variable_budget').insert(
        selectedVariable.map(category => ({ category, budgeted: 0, user_id: user.id, month_id: month.id }))
      ),
      supabase.from('investments').insert(
        selectedInvestments.map(vehicle => ({ vehicle, budgeted: 0, user_id: user.id, month_id: month.id }))
      ),
      supabase.from('accounts').insert(
        DEFAULT_ACCOUNTS.map(a => ({ ...a, user_id: user.id, month_id: month.id, balance: 0 }))
      ),
    ])

    router.push(`/dashboard/${month.id}`)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  // ── Existing user: show month list ────────────────────────────────────────
  if (months.length > 0) {
    const userName = user?.full_name ?? 'My'
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 32 }}>
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>💰</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{userName} Budget</span>
            </div>
            <Link href="/settings" style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Settings</Link>
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>SELECT MONTH</div>
          {months.map(m => (
            <Link key={m.id} href={`/dashboard/${m.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{getMonthName(m.month)} {m.year}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    Income: ${(Number(m.salary) + Number(m.rent_income) + Number(m.other_income)).toFixed(2)}
                  </div>
                </div>
                <span style={{ color: 'var(--text3)', fontSize: 20 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── New user: onboarding wizard ───────────────────────────────────────────
  const stepIndex = STEPS.indexOf(step)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)',
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
  }
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '14px', background: 'linear-gradient(135deg,#e5484d,#c0392b)',
    color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 12,
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(229,72,77,0.4)',
  }
  const backBtn: React.CSSProperties = {
    ...btnStyle, background: 'var(--surface2)', color: 'var(--text2)', boxShadow: 'none', flex: '0 0 80px',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              width: i === stepIndex ? 20 : 8, height: 8, borderRadius: 4,
              background: i <= stepIndex ? 'var(--red)' : 'var(--border)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>

          {/* Step 1: Name */}
          {step === 'name' && (
            <div>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>👋</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Welcome!</h2>
              <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>Let's set up your budget. What's your first name?</p>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your first name" style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && name.trim() && goNext()}
              />
              <button onClick={() => name.trim() && goNext()} disabled={!name.trim()}
                style={{ ...btnStyle, marginTop: 12, opacity: name.trim() ? 1 : 0.5 }}>
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Tracking preference */}
          {step === 'tracking' && (
            <div>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>📊</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>How do you track?</h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>
                Weekly tracking breaks your budget into weeks and shows weekly progress. Monthly tracks everything at the month level.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {([
                  { value: 'weekly', label: '📅 Weekly', desc: 'Track spending by week, see weekly budget progress and alerts' },
                  { value: 'monthly', label: '🗓️ Monthly', desc: 'Track all transactions for the month without weekly breakdown' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setTrackingMode(opt.value)} style={{
                    padding: '14px 16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${trackingMode === opt.value ? 'var(--red)' : 'var(--border)'}`,
                    background: trackingMode === opt.value ? 'var(--red-dim)' : 'var(--surface2)',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: trackingMode === opt.value ? 'var(--red)' : 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={goNext} style={{ ...btnStyle, flex: 1 }}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3: Fixed expense categories */}
          {step === 'fixed' && (
            <div>
              <CategoryPicker
                title="Fixed Expenses" emoji="🏠"
                description={`Hi ${name}! Select the fixed monthly expenses you want to track.`}
                defaults={DEFAULT_FIXED_NAMES}
                selected={selectedFixed} setSelected={setSelectedFixed}
                custom={customFixed} setCustom={setCustomFixed}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={goNext} style={{ ...btnStyle, flex: 1 }}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 4: Variable expense categories */}
          {step === 'variable' && (
            <div>
              <CategoryPicker
                title="Variable Expenses" emoji="🛒"
                description="Select the spending categories you want to track each month."
                defaults={DEFAULT_VARIABLE_NAMES}
                selected={selectedVariable} setSelected={setSelectedVariable}
                custom={customVariable} setCustom={setCustomVariable}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={goNext} style={{ ...btnStyle, flex: 1 }}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 5: Investment categories */}
          {step === 'investments' && (
            <div>
              <CategoryPicker
                title="Investments" emoji="📈"
                description="Select the investment vehicles you contribute to."
                defaults={DEFAULT_INVESTMENT_NAMES}
                selected={selectedInvestments} setSelected={setSelectedInvestments}
                custom={customInvestment} setCustom={setCustomInvestment}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={goNext} style={{ ...btnStyle, flex: 1 }}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 6: Income */}
          {step === 'income' && (
            <div>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>💰</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Hi {name}!</h2>
              <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>What's your monthly income? (You can update this anytime)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Monthly Salary / Take-home pay', value: salary, set: setSalary, placeholder: 'e.g. 5000' },
                  { label: 'Rental Income (if any)', value: rentIncome, set: setRentIncome, placeholder: 'e.g. 900 or 0' },
                  { label: 'Other Income (if any)', value: otherIncome, set: setOtherIncome, placeholder: 'e.g. 0' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
                    <input type="number" inputMode="decimal" value={value} onChange={e => set(e.target.value)}
                      placeholder={placeholder} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={goNext} disabled={!salary}
                  style={{ ...btnStyle, flex: 1, opacity: salary ? 1 : 0.5 }}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 7: First month */}
          {step === 'month' && (
            <div>
              <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>📅</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>First month</h2>
              <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>Which month are you starting with?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Month</div>
                  <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                    style={{ ...inputStyle, appearance: 'none' as const }}>
                    {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Year</div>
                  <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))}
                    style={inputStyle} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: '14px 0 0', textAlign: 'center' }}>
                Budget amounts start at $0 — set them on the Monthly tab after setup.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={goBack} style={backBtn}>← Back</button>
                <button onClick={finishOnboarding} disabled={saving}
                  style={{ ...btnStyle, flex: 1, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Setting up...' : '🚀 Get Started'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

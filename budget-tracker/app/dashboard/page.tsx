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

type Step = 'name' | 'income' | 'month' | 'done'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<Month[]>([])
  const [user, setUser] = useState<{ id: string; email?: string; full_name?: string } | null>(null)

  // Onboarding state
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
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

  async function finishOnboarding() {
    if (!user || !name.trim()) return
    setSaving(true)

    // Save name
    await supabase.auth.updateUser({ data: { full_name: name.trim() } })

    // Create first month
    const label = `${MONTH_NAMES[newMonth - 1]} ${newYear}`
    const { data: month, error } = await supabase.from('months').insert({
      user_id: user.id, year: newYear, month: newMonth, label,
      salary: parseFloat(salary) || 0,
      rent_income: parseFloat(rentIncome) || 0,
      other_income: parseFloat(otherIncome) || 0,
    }).select().single()

    if (error || !month) { setSaving(false); return }

    await Promise.all([
      supabase.from('fixed_expenses').insert(DEFAULT_FIXED_EXPENSES.map(e => ({ ...e, user_id: user.id, month_id: month.id }))),
      supabase.from('variable_budget').insert(Object.entries(DEFAULT_VARIABLE_BUDGETS).map(([category, budgeted]) => ({ user_id: user.id, month_id: month.id, category, budgeted }))),
      supabase.from('investments').insert(DEFAULT_INVESTMENTS.map(i => ({ ...i, user_id: user.id, month_id: month.id }))),
      supabase.from('accounts').insert(DEFAULT_ACCOUNTS.map(a => ({ ...a, user_id: user.id, month_id: month.id, balance: 0 }))),
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {(['name','income','month'] as Step[]).map(s => (
            <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: step === s || (step === 'done') ? 'var(--red)' : 'var(--border)' }} />
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 'name' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 16 }}>👋</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>Welcome!</h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>Let's set up your budget. What's your first name?</p>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your first name" style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('income')}
            />
            <button onClick={() => name.trim() && setStep('income')} disabled={!name.trim()}
              style={{ ...btnStyle, marginTop: 12, opacity: name.trim() ? 1 : 0.5 }}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 2: Income */}
        {step === 'income' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 16 }}>💰</div>
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
              <button onClick={() => setStep('name')} style={{ ...btnStyle, background: 'var(--surface2)', color: 'var(--text2)', boxShadow: 'none', flex: '0 0 80px' }}>← Back</button>
              <button onClick={() => setStep('month')} disabled={!salary}
                style={{ ...btnStyle, flex: 1, opacity: salary ? 1 : 0.5 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: First month */}
        {step === 'month' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 16 }}>📅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', textAlign: 'center' }}>First month</h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px' }}>Which month are you starting with?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>Month</div>
                <select value={newMonth} onChange={e => setNewMonth(Number(e.target.value))}
                  style={{ ...inputStyle, appearance: 'none' }}>
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
              Budget amounts start at $0 — set them in Settings after creating.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setStep('income')} style={{ ...btnStyle, background: 'var(--surface2)', color: 'var(--text2)', boxShadow: 'none', flex: '0 0 80px' }}>← Back</button>
              <button onClick={finishOnboarding} disabled={saving}
                style={{ ...btnStyle, flex: 1, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Setting up...' : '🚀 Get Started'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

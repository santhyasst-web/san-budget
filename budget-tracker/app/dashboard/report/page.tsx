'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatCAD, getMonthName } from '@/lib/calculations/monthlySummary'
import type { Transaction, Month, Subcategory } from '@/lib/supabase/types'

function ReportContent() {
  const searchParams = useSearchParams()
  const fromMonthId = searchParams.get('from')

  const [months, setMonths] = useState<Month[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [querying, setQuerying] = useState(false)

  // Filters
  const [startMonthId, setStartMonthId] = useState<string>('')
  const [endMonthId, setEndMonthId] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedSubLabels, setSelectedSubLabels] = useState<string[]>([])

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: monthsData }, { data: subcatsData }] = await Promise.all([
        supabase.from('months').select('*').eq('user_id', user.id).order('year').order('month'),
        supabase.from('subcategories').select('*').eq('user_id', user.id).order('name'),
      ])
      setMonths(monthsData ?? [])
      setSubcategories(subcatsData ?? [])
      // Default: start = fromMonth or first month, end = last month
      const ms = monthsData ?? []
      if (ms.length > 0) {
        const fromIdx = fromMonthId ? ms.findIndex(m => m.id === fromMonthId) : -1
        setStartMonthId(fromIdx >= 0 ? ms[fromIdx].id : ms[0].id)
        setEndMonthId(ms[ms.length - 1].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!startMonthId || !endMonthId) return
    const startIdx = months.findIndex(m => m.id === startMonthId)
    const endIdx = months.findIndex(m => m.id === endMonthId)
    if (startIdx < 0 || endIdx < 0) return
    const rangeMonths = months.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1)
    const monthIds = rangeMonths.map(m => m.id)
    if (monthIds.length === 0) return
    setQuerying(true)
    supabase.from('transactions').select('*').in('month_id', monthIds).order('date', { ascending: false })
      .then(({ data }) => {
        setAllTransactions(data ?? [])
        setQuerying(false)
      })
  }, [startMonthId, endMonthId, months])

  // All categories from fetched transactions
  const allCategories = [...new Set(allTransactions.map(t => t.category))].sort()

  // Sub-label options for selected categories
  const subLabelOptions = [...new Set(
    subcategories
      .filter(s => selectedCategories.length === 0 || selectedCategories.includes(s.category))
      .map(s => s.name)
  )].sort()

  // Filter transactions
  const filtered = allTransactions.filter(t => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false
    if (selectedSubLabels.length > 0 && !selectedSubLabels.includes(t.sub_label)) return false
    return true
  })

  const totalSpent = filtered.reduce((s, t) => s + Number(t.amount), 0)

  // Group by category
  const byCategory: Record<string, { total: number; txns: Transaction[] }> = {}
  filtered.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = { total: 0, txns: [] }
    byCategory[t.category].total += Number(t.amount)
    byCategory[t.category].txns.push(t)
  })
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)
  const maxCatTotal = sortedCategories[0]?.[1].total ?? 1

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
    setSelectedSubLabels([]) // reset sub-labels when category changes
  }

  function toggleSubLabel(label: string) {
    setSelectedSubLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href={fromMonthId ? `/dashboard/${fromMonthId}` : '/dashboard'} style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>‹ Back</Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Report</span>
          <div style={{ width: 48 }} />
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px 0' }}>

        {/* Month range filter */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Date Range</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'From', value: startMonthId, set: setStartMonthId },
              { label: 'To', value: endMonthId, set: setEndMonthId },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <select value={value} onChange={e => set(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}>
                  {months.map(m => (
                    <option key={m.id} value={m.id}>{getMonthName(m.month)} {m.year}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Category filter */}
        {allCategories.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</div>
              {selectedCategories.length > 0 && (
                <button onClick={() => { setSelectedCategories([]); setSelectedSubLabels([]) }}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allCategories.map(cat => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${selectedCategories.includes(cat) ? 'var(--red)' : 'var(--border)'}`, background: selectedCategories.includes(cat) ? 'var(--red-dim)' : 'var(--surface2)', color: selectedCategories.includes(cat) ? 'var(--red)' : 'var(--text3)' }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-label filter */}
        {subLabelOptions.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sub-category</div>
              {selectedSubLabels.length > 0 && (
                <button onClick={() => setSelectedSubLabels([])}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {subLabelOptions.map(label => (
                <button key={label} onClick={() => toggleSubLabel(label)}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${selectedSubLabels.includes(label) ? 'var(--purple)' : 'var(--border)'}`, background: selectedSubLabels.includes(label) ? 'rgba(139,92,246,0.15)' : 'var(--surface2)', color: selectedSubLabels.includes(label) ? '#a78bfa' : 'var(--text3)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary bar */}
        {querying ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Loading transactions...</div>
        ) : (
          <>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{formatCAD(totalSpent)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Total · {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</div>
                </div>
                {(selectedCategories.length > 0 || selectedSubLabels.length > 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                    {selectedCategories.length > 0 && <div>{selectedCategories.join(', ')}</div>}
                    {selectedSubLabels.length > 0 && <div style={{ color: '#a78bfa' }}>{selectedSubLabels.join(', ')}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Breakdown by category */}
            {sortedCategories.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Breakdown</div>
                {sortedCategories.map(([cat, { total }]) => {
                  const pct = (total / maxCatTotal) * 100
                  const sharePct = totalSpent > 0 ? (total / totalSpent) * 100 : 0
                  return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{cat}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{formatCAD(total)} · {sharePct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--purple)', borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Transaction list grouped by category */}
            {sortedCategories.map(([cat, { txns }]) => (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 2px 8px' }}>{cat}</div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                  {txns.map((t, i) => (
                    <div key={t.id} style={{ padding: '12px 16px', borderBottom: i < txns.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.subcategory || t.category}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{t.date}</span>
                          {t.sub_label && <span style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{t.sub_label}</span>}
                          {t.is_shared && <span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>shared</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginLeft: 12, flexShrink: 0 }}>{formatCAD(Number(t.amount))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 14 }}>No transactions match your filters</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
        Loading...
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
}

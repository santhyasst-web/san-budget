'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { VARIABLE_CATEGORIES, VENDOR_SUGGESTIONS } from '@/lib/constants/categories'

const CATEGORY_ICONS: Record<string, string> = {
  'Grocery': '🛒', 'Outside Food': '🍜', 'Skin Care': '✨', 'Hair Care': '💇',
  'Home Expense': '🏠', 'Misc': '📦', 'Business Expense': '💼', 'Uber': '🚗', 'Books': '📚',
}

function AddTransactionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const monthId = searchParams.get('monthId') ?? ''

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [sharedDirection, setSharedDirection] = useState<'from_thiyag' | 'to_thiyag'>('from_thiyag')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([])
  const [pastVendors, setPastVendors] = useState<string[]>([])
  // Item breakdown
  const [showItems, setShowItems] = useState(false)
  const [items, setItems] = useState<{ label: string; amount: string }[]>([{ label: '', amount: '' }])
  const supabase = createClient()

  useEffect(() => {
    if (category) {
      const defaults = VENDOR_SUGGESTIONS[category] ?? []
      setVendorSuggestions([...new Set([...defaults, ...pastVendors])])
    }
  }, [category, pastVendors])

  useEffect(() => {
    if (category && monthId) {
      supabase.from('transactions').select('subcategory').eq('month_id', monthId).eq('category', category)
        .then(({ data }) => {
          if (data) setPastVendors([...new Set(data.map((t: { subcategory: string }) => t.subcategory).filter(Boolean))])
        })
    }
  }, [category, monthId])

  function getWeekNumber(dateStr: string): number {
    return Math.ceil(new Date(dateStr).getDate() / 7)
  }

  // Auto-sum items into the amount field
  function syncAmountFromItems(newItems: { label: string; amount: string }[]) {
    const sum = newItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
    if (sum > 0) setAmount(sum.toFixed(2))
  }

  function updateItem(idx: number, field: 'label' | 'amount', val: string) {
    const next = items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    setItems(next)
    if (field === 'amount') syncAmountFromItems(next)
  }

  function addItemRow() {
    setItems(prev => [...prev, { label: '', amount: '' }])
  }

  function removeItemRow(idx: number) {
    const next = items.filter((_, i) => i !== idx)
    setItems(next.length > 0 ? next : [{ label: '', amount: '' }])
    syncAmountFromItems(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!category || !amount || !monthId) return
    setLoading(true)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in. Please refresh.'); setLoading(false); return }

    const { data: txn, error: insertError } = await supabase.from('transactions').insert({
      user_id: user.id, month_id: monthId, date,
      week_number: getWeekNumber(date), category,
      subcategory: subcategory.trim(), amount: amountNum,
      notes: notes.trim() || null, is_shared: isShared,
      shared_direction: isShared ? sharedDirection : null,
    }).select().single()

    if (insertError || !txn) { setError(insertError?.message ?? 'Failed to save'); setLoading(false); return }

    // Insert breakdown items if any
    if (showItems) {
      const validItems = items.filter(it => it.label.trim() && parseFloat(it.amount) > 0)
      if (validItems.length > 0) {
        await supabase.from('transaction_items').insert(
          validItems.map(it => ({
            user_id: user.id,
            transaction_id: txn.id,
            label: it.label.trim(),
            amount: parseFloat(it.amount),
          }))
        )
      }
    }

    if (isShared) {
      await supabase.from('shared_settlements').insert({
        user_id: user.id, month_id: monthId, direction: sharedDirection,
        description: subcategory.trim() || category, amount: amountNum / 2, date, settled: false,
      })
    }

    router.push(`/dashboard/${monthId}/transactions`)
  }

  const filtered = subcategory
    ? vendorSuggestions.filter(v => v.toLowerCase().includes(subcategory.toLowerCase()) && v !== subcategory)
    : []

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 12, color: 'var(--text)', fontSize: 15,
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} style={{ color: 'var(--red)', fontWeight: 500, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Add Transaction</div>
          <div style={{ width: 56 }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid #5a2020', borderRadius: 12, padding: '12px 16px', color: 'var(--red)', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Amount — most important, show first big */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Amount</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 300, color: 'var(--text3)', marginRight: 4 }}>$</span>
            <input
              type="number" inputMode="decimal" step="0.01" min="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              style={{ flex: 1, fontSize: 40, fontWeight: 800, color: 'var(--text)', background: 'none', border: 'none', outline: 'none', letterSpacing: '-0.02em' }}
            />
          </div>
        </div>

        {/* Item breakdown toggle */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <button type="button" onClick={() => setShowItems(!showItems)}
            style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>Break down into items</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, textAlign: 'left' }}>e.g. Milk $4, Eggs $6 — auto-sums to total</div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 18, transition: 'transform 0.2s', transform: showItems ? 'rotate(90deg)' : 'none' }}>›</span>
          </button>
          {showItems && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text" value={item.label} onChange={e => updateItem(idx, 'label', e.target.value)}
                    placeholder="Item name" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }}
                  />
                  <input
                    type="number" inputMode="decimal" value={item.amount} onChange={e => updateItem(idx, 'amount', e.target.value)}
                    placeholder="$0" style={{ width: 72, padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }}
                  />
                  <button type="button" onClick={() => removeItemRow(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
              ))}
              <button type="button" onClick={addItemRow}
                style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer', fontWeight: 600 }}>
                + Add item
              </button>
            </div>
          )}
        </div>

        {/* Category grid */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Category</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {VARIABLE_CATEGORIES.map(cat => (
              <button key={cat} type="button"
                onClick={() => { setCategory(cat); setSubcategory('') }}
                style={{
                  padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${category === cat ? 'var(--red)' : 'var(--border)'}`,
                  background: category === cat ? 'var(--red-dim)' : 'var(--surface)',
                  color: category === cat ? 'var(--red)' : 'var(--text2)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[cat] ?? '•'}</span>
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vendor */}
        {category && (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Vendor</div>
            <input
              type="text" value={subcategory} onChange={e => setSubcategory(e.target.value)}
              placeholder={`e.g. ${(VENDOR_SUGGESTIONS[category] ?? ['Store'])[0]}`}
              style={inputStyle}
            />
            {filtered.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: 4, overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {filtered.slice(0, 5).map(v => (
                  <button key={v} type="button" onClick={() => setSubcategory(v)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontSize: 14, cursor: 'pointer' }}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Date */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        {/* Shared toggle */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Shared with Thiyag</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Half goes to shared ledger</div>
            </div>
            <button type="button" onClick={() => setIsShared(!isShared)}
              style={{ width: 48, height: 28, borderRadius: 14, background: isShared ? 'var(--red)' : 'var(--surface2)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 3, width: 22, height: 22, background: '#fff', borderRadius: '50%', transition: 'transform 0.2s', transform: isShared ? 'translateX(22px)' : 'translateX(3px)', display: 'block' }} />
            </button>
          </div>
          {isShared && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              {(['from_thiyag', 'to_thiyag'] as const).map(dir => (
                <button key={dir} type="button" onClick={() => setSharedDirection(dir)}
                  style={{ padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${sharedDirection === dir ? 'var(--red)' : 'var(--border)'}`, background: sharedDirection === dir ? 'var(--red-dim)' : 'var(--surface2)', color: sharedDirection === dir ? 'var(--red)' : 'var(--text3)' }}>
                  {dir === 'from_thiyag' ? '💳 I paid' : '🤝 Thiyag paid'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Notes (optional)</div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..."
            style={inputStyle} />
        </div>

        <button type="submit" disabled={loading || !category || !amount || !monthId}
          style={{
            width: '100%', padding: '16px', background: 'var(--red)', color: '#fff',
            fontWeight: 700, fontSize: 16, borderRadius: 16, border: 'none', cursor: 'pointer',
            opacity: loading || !category || !amount ? 0.5 : 1,
            boxShadow: '0 4px 20px rgba(229,72,77,0.4)', transition: 'all 0.2s',
          }}>
          {loading ? 'Saving...' : 'Add Transaction'}
        </button>
      </form>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text3)' }}>Loading...</span>
      </div>
    }>
      <AddTransactionForm />
    </Suspense>
  )
}

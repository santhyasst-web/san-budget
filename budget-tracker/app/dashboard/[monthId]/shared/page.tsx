'use client'

import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/layout/BottomNav'
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay'
import Link from 'next/link'
import type { SharedSettlement } from '@/lib/supabase/types'

export default function SharedPage({ params }: { params: Promise<{ monthId: string }> }) {
  const { monthId } = use(params)
  const [items, setItems] = useState<SharedSettlement[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [direction, setDirection] = useState<'from_thiyag' | 'to_thiyag'>('from_thiyag')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('shared_settlements').select('*').eq('month_id', monthId).order('date', { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [monthId])

  async function addItem() {
    const amountNum = parseFloat(amount)
    if (!desc.trim() || isNaN(amountNum) || amountNum <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('shared_settlements').insert({
      user_id: user.id,
      month_id: monthId,
      direction,
      description: desc.trim(),
      amount: amountNum,
      date,
      settled: false,
    }).select().single()
    if (data) setItems(prev => [data, ...prev])
    setDesc(''); setAmount(''); setAdding(false); setSaving(false)
  }

  async function toggleSettled(id: string, settled: boolean) {
    await supabase.from('shared_settlements').update({ settled: !settled }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, settled: !settled } : i))
  }

  const fromThiyag = items.filter(i => i.direction === 'from_thiyag' && !i.settled)
  const toThiyag = items.filter(i => i.direction === 'to_thiyag' && !i.settled)
  const fromTotal = fromThiyag.reduce((s, i) => s + Number(i.amount), 0)
  const toTotal = toThiyag.reduce((s, i) => s + Number(i.amount), 0)
  const netBalance = fromTotal - toTotal

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-4 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href={`/dashboard/${monthId}`} className="text-red-400 text-sm font-medium">‹ Summary</Link>
          <h1 className="text-lg font-bold text-white">Shared with Thiyag</h1>
          <button onClick={() => setAdding(true)} className="text-red-400 font-bold text-xl">+</button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Net balance banner */}
        <div className={`rounded-xl p-4 text-center ${netBalance >= 0 ? 'bg-red-600' : 'bg-gray-800 border border-gray-700'}`}>
          <p className={`text-sm font-medium ${netBalance >= 0 ? 'text-red-100' : 'text-gray-400'}`}>
            {netBalance > 0 ? 'Thiyag owes you' : netBalance < 0 ? 'You owe Thiyag' : 'All settled up'}
          </p>
          {netBalance !== 0 && (
            <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-white' : 'text-red-400'}`}>
              <CurrencyDisplay amount={Math.abs(netBalance)} />
            </p>
          )}
        </div>

        {adding && (
          <div className="bg-gray-800 rounded-xl border border-red-800 p-4 space-y-3">
            <h3 className="font-semibold text-white">Add Shared Item</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['from_thiyag', 'to_thiyag'] as const).map(dir => (
                <button key={dir} type="button" onClick={() => setDirection(dir)}
                  className={`py-2 rounded-lg text-sm font-medium border ${direction === dir ? 'bg-red-600 text-white border-red-600' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                  {dir === 'from_thiyag' ? 'I paid' : 'Thiyag paid'}
                </button>
              ))}
            </div>
            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-sm text-gray-400">Cancel</button>
              <button onClick={addItem} disabled={saving} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Add</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            {[
              { title: 'I paid (Thiyag owes me)', items: fromThiyag, total: fromTotal, totalClass: 'text-green-400' },
              { title: 'Thiyag paid (I owe)', items: toThiyag, total: toTotal, totalClass: 'text-red-400' },
            ].map(section => (
              <div key={section.title} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700 flex justify-between">
                  <h2 className="font-semibold text-white text-sm">{section.title}</h2>
                  <span className={`font-semibold ${section.totalClass}`}><CurrencyDisplay amount={section.total} /></span>
                </div>
                {section.items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">Nothing here</p>
                ) : (
                  section.items.map(item => (
                    <div key={item.id} className="flex items-center px-4 py-3 border-b border-gray-700 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm text-white">{item.description}</p>
                        <p className="text-xs text-gray-500">{item.date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white"><CurrencyDisplay amount={Number(item.amount)} /></span>
                        <button onClick={() => toggleSettled(item.id, item.settled)} className="text-xs text-gray-500 border border-gray-600 px-2 py-0.5 rounded-full hover:border-gray-400">settle</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}

            {items.filter(i => i.settled).length > 0 && (
              <details className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <summary className="px-4 py-3 text-sm text-gray-500 cursor-pointer">
                  {items.filter(i => i.settled).length} settled items
                </summary>
                {items.filter(i => i.settled).map(item => (
                  <div key={item.id} className="flex items-center px-4 py-3 border-t border-gray-700 opacity-40">
                    <div className="flex-1">
                      <p className="text-sm text-white line-through">{item.description}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                    <span className="text-sm text-gray-400"><CurrencyDisplay amount={Number(item.amount)} /></span>
                  </div>
                ))}
              </details>
            )}
          </>
        )}
      </div>

      <BottomNav monthId={monthId} />
    </div>
  )
}

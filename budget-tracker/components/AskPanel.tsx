'use client'

import { useState, useRef, useEffect } from 'react'

interface AskPanelProps {
  context: string
}

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export function AskPanel({ context }: AskPanelProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, context }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer ?? 'No answer.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  return (
    <>
      {/* "?" trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--purple)', fontSize: 16, fontWeight: 800, cursor: 'pointer',
        }}
        aria-label="Ask a question about your spending"
      >
        ?
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '75vh',
      }}>
        {/* Handle + header */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Ask about your spending</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>e.g. "Where did I spend most on food?"</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
              Ask anything about this month's transactions, budgets, or spending patterns.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--purple)' : 'var(--surface2)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'var(--surface2)', borderRadius: '16px 16px 16px 4px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text3)', animation: `bounce 1s ease ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '10px 12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask a question..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 14,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            style={{
              background: input.trim() && !loading ? 'var(--purple)' : 'var(--surface3)',
              border: 'none', borderRadius: 12, width: 44, height: 44,
              color: '#fff', fontSize: 18, cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  )
}

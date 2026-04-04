'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = emailRef.current?.value ?? ''
    if (!email) return
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSentEmail(email)
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '0 16px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 32, width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Check your email</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            We sent a magic link to <strong style={{ color: 'var(--text)' }}>{sentEmail}</strong>. Tap the link to sign in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '0 16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 32, width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Budget Tracker</h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 4 }}>Sign in to access your budget</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>
            Email address
          </label>
          <input
            ref={emailRef}
            type="email"
            defaultValue=""
            required
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '12px 16px', background: 'var(--surface2)',
              border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)',
              fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            }}
          />

          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg,#e5484d,#c0392b)',
              color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(229,72,77,0.4)',
            }}
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      </div>
    </div>
  )
}

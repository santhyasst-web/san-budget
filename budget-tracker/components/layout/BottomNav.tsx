'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props { monthId: string }

const navItems = (monthId: string) => [
  { href: `/dashboard/${monthId}/monthly`,       label: 'MONTHLY',  icon: '📋' },
  { href: `/dashboard/${monthId}/transactions`, label: 'WEEKLY',   icon: '🗓️' },
  { href: `/add?monthId=${monthId}`,            label: 'ADD',      icon: '+',  isAdd: true },
  { href: `/dashboard/${monthId}/shared`,       label: 'SHARED',   icon: '🤝' },
  { href: `/dashboard/${monthId}/net-worth`,    label: 'WEALTH',   icon: '💎' },
]

export function BottomNav({ monthId }: Props) {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <div style={{ display: 'flex', maxWidth: 520, margin: '0 auto' }}>
        {navItems(monthId).map(item => {
          const isActive = pathname === item.href || (item.href.includes('/add') && pathname === '/add')

          if (item.isAdd) return (
            <Link key={item.href} href={item.href}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 60, textDecoration: 'none' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'linear-gradient(135deg, #e5484d, #c0392b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 200, color: '#fff',
                boxShadow: '0 4px 20px rgba(229,72,77,0.45)',
              }}>+</div>
            </Link>
          )

          return (
            <Link key={item.href} href={item.href}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 60, textDecoration: 'none', gap: 3 }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: isActive ? 'var(--purple)' : 'var(--text3)',
              }}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

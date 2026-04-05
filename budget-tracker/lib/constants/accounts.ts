import type { AccountType } from '@/lib/supabase/types'

export const DEFAULT_ACCOUNTS: Array<{ account_name: string; account_type: AccountType; is_liquid: boolean }> = [
  { account_name: 'Scotia Chequing', account_type: 'chequing', is_liquid: true },
  { account_name: 'TD Chequing', account_type: 'chequing', is_liquid: true },
  { account_name: 'Momentum Savings', account_type: 'savings', is_liquid: true },
  { account_name: 'Emergency Savings', account_type: 'savings', is_liquid: true },
  { account_name: 'Scotia Mutual Fund', account_type: 'mutual_fund', is_liquid: false },
  { account_name: 'TD Savings', account_type: 'savings', is_liquid: true },
  { account_name: 'WealthSimple', account_type: 'investment', is_liquid: false },
  { account_name: 'Questrade', account_type: 'investment', is_liquid: false },
  { account_name: 'Canada Life RRSP', account_type: 'rrsp', is_liquid: false },
]

export const DEFAULT_INVESTMENTS: Array<{ vehicle: string; budgeted: number }> = [
  { vehicle: 'Mortgage Accelerated', budgeted: 0 },
  { vehicle: 'WealthSimple', budgeted: 0 },
  { vehicle: 'Questrade TFSA', budgeted: 0 },
  { vehicle: 'Questrade RRSP', budgeted: 0 },
  { vehicle: 'Scotia', budgeted: 0 },
]

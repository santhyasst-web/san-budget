export type AccountType = 'chequing' | 'savings' | 'investment' | 'rrsp' | 'tfsa' | 'mutual_fund'
export type SharedDirection = 'from_thiyag' | 'to_thiyag'

export interface Month {
  id: string
  user_id: string
  year: number
  month: number
  label: string
  salary: number
  rent_income: number
  other_income: number
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  month_id: string
  account_name: string
  account_type: AccountType
  balance: number
  is_liquid: boolean
}

export interface FixedExpense {
  id: string
  user_id: string
  month_id: string
  category: string
  budgeted: number
  actual: number | null
  paid_date: string | null
}

export interface VariableBudget {
  id: string
  user_id: string
  month_id: string
  category: string
  budgeted: number
}

export interface Transaction {
  id: string
  user_id: string
  month_id: string
  date: string
  week_number: number
  category: string
  subcategory: string
  amount: number
  notes: string | null
  is_shared: boolean
  shared_direction: SharedDirection | null
}

export interface Investment {
  id: string
  user_id: string
  month_id: string
  vehicle: string
  budgeted: number
  actual: number | null
  contributed_date: string | null
}

export interface SharedSettlement {
  id: string
  user_id: string
  month_id: string
  direction: SharedDirection
  description: string
  amount: number
  date: string
  settled: boolean
}

export interface MonthlySummary {
  total_income: number
  total_fixed_budgeted: number
  total_fixed_actual: number
  total_variable_budgeted: number
  total_variable_actual: number
  total_investments_budgeted: number
  total_investments_actual: number
  total_budgeted: number
  total_actual: number
  remaining_income: number
  fundamentals_pct: number
  investments_pct: number
}

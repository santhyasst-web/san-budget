import type { FixedExpense, VariableBudget, Transaction, Investment, MonthlySummary } from '@/lib/supabase/types'

export function computeMonthlySummary(
  salary: number,
  rentIncome: number,
  otherIncome: number,
  fixedExpenses: FixedExpense[],
  variableBudgets: VariableBudget[],
  transactions: Transaction[],
  investments: Investment[]
): MonthlySummary {
  const totalIncome = salary + rentIncome + otherIncome

  const totalFixedBudgeted = fixedExpenses.reduce((sum, e) => sum + e.budgeted, 0)
  const totalFixedActual = fixedExpenses.reduce((sum, e) => sum + (e.actual ?? 0), 0)

  const totalVariableBudgeted = variableBudgets.reduce((sum, b) => sum + b.budgeted, 0)
  const totalVariableActual = transactions
    .filter(t => !t.is_shared)
    .reduce((sum, t) => sum + t.amount, 0)

  const totalInvestmentsBudgeted = investments.reduce((sum, i) => sum + i.budgeted, 0)
  const totalInvestmentsActual = investments.reduce((sum, i) => sum + (i.actual ?? 0), 0)

  const totalBudgeted = totalFixedBudgeted + totalVariableBudgeted + totalInvestmentsBudgeted
  const totalActual = totalFixedActual + totalVariableActual + totalInvestmentsActual
  const remainingIncome = totalIncome - totalActual

  const fundamentalsBudgeted = totalFixedBudgeted + totalVariableBudgeted
  const fundamentalsPct = totalIncome > 0 ? (fundamentalsBudgeted / totalIncome) * 100 : 0
  const investmentsPct = totalIncome > 0 ? (totalInvestmentsBudgeted / totalIncome) * 100 : 0

  return {
    total_income: totalIncome,
    total_fixed_budgeted: totalFixedBudgeted,
    total_fixed_actual: totalFixedActual,
    total_variable_budgeted: totalVariableBudgeted,
    total_variable_actual: totalVariableActual,
    total_investments_budgeted: totalInvestmentsBudgeted,
    total_investments_actual: totalInvestmentsActual,
    total_budgeted: totalBudgeted,
    total_actual: totalActual,
    remaining_income: remainingIncome,
    fundamentals_pct: fundamentalsPct,
    investments_pct: investmentsPct,
  }
}

export function getVariableActualByCategory(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {}
  transactions
    .filter(t => !t.is_shared)
    .forEach(t => {
      result[t.category] = (result[t.category] ?? 0) + t.amount
    })
  return result
}

export function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr)
  const day = date.getDate()
  return Math.ceil(day / 7)
}

export function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' })
}

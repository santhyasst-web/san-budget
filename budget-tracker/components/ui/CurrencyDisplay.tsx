import { formatCAD } from '@/lib/calculations/monthlySummary'

interface Props {
  amount: number
  className?: string
  showSign?: boolean
}

export function CurrencyDisplay({ amount, className = '', showSign = false }: Props) {
  const formatted = formatCAD(Math.abs(amount))
  const sign = showSign && amount < 0 ? '-' : showSign && amount > 0 ? '+' : ''
  return <span className={className}>{sign}{formatted}</span>
}

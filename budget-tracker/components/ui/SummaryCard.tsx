import { CurrencyDisplay } from './CurrencyDisplay'

interface Props {
  label: string
  amount: number
  sub?: string
  highlight?: boolean
  negative?: boolean
}

export function SummaryCard({ label, amount, sub, highlight, negative }: Props) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-red-600 text-white' : 'bg-gray-800 border border-gray-700'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${highlight ? 'text-red-100' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${negative ? 'text-red-400' : highlight ? 'text-white' : 'text-white'}`}>
        <CurrencyDisplay amount={amount} />
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${highlight ? 'text-red-100' : 'text-gray-500'}`}>{sub}</p>
      )}
    </div>
  )
}

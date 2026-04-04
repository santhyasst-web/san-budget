import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getMonthName } from '@/lib/calculations/monthlySummary'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userName: string = user.user_metadata?.full_name ?? 'My'

  const { data: months } = await supabase
    .from('months')
    .select('*')
    .eq('user_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-900 pb-8">
      <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-4 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-white">{userName} Budget</h1>
          <Link href="/settings" className="text-sm text-red-400 font-medium">Settings</Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        {months && months.length > 0 ? (
          months.map(m => (
            <Link
              key={m.id}
              href={`/dashboard/${m.id}`}
              className="block bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{getMonthName(m.month)} {m.year}</p>
                  <p className="text-sm text-gray-400 mt-0.5">Income: ${Number(m.salary + m.rent_income + m.other_income).toFixed(2)}</p>
                </div>
                <span className="text-gray-600 text-lg">›</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📅</p>
            <p className="text-gray-400 mb-6">No months yet. Create your first month in Settings.</p>
            <Link href="/settings" className="inline-block bg-red-600 text-white font-semibold px-6 py-3 rounded-xl">
              Go to Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: currentMonth } = await supabase
    .from('months')
    .select('id')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .single()

  if (currentMonth) redirect(`/dashboard/${currentMonth.id}`)

  const { data: latestMonth } = await supabase
    .from('months')
    .select('id')
    .eq('user_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single()

  if (latestMonth) redirect(`/dashboard/${latestMonth.id}`)

  redirect('/dashboard')
}

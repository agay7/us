import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthRedirect } from '@/lib/routing'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .maybeSingle()

  redirect(getPostAuthRedirect(!!membership))
}

// src/lib/session.ts
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export async function getSessionAndMembership(): Promise<{
  user: User | null
  spaceId: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, spaceId: null }
  }

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, spaceId: membership?.space_id ?? null }
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// space_members.user_id references auth.users directly (not
// profiles.user_id), so PostgREST has no FK to auto-embed profiles on
// that table — unlike place_visit_participants/place_wishlist, which were
// pointed at profiles specifically to allow that embed. Two-step lookup
// instead of a nested select.
export function usePartnerName(spaceId: string, currentUserId: string | null): string | null {
  const [partnerName, setPartnerName] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUserId) return

    const supabase = createClient()
    async function load() {
      const { data: members } = await supabase
        .from('space_members')
        .select('user_id')
        .eq('space_id', spaceId)

      const partnerId = members?.find((m) => m.user_id !== currentUserId)?.user_id
      if (!partnerId) {
        setPartnerName(null)
        return
      }

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', partnerId)
        .maybeSingle()

      setPartnerName(partnerProfile?.display_name ?? null)
    }
    load()
  }, [spaceId, currentUserId])

  return partnerName
}

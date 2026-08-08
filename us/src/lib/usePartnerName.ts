'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type PartnerInfo = { partnerId: string | null; partnerName: string | null }

// space_members.user_id references auth.users directly (not
// profiles.user_id), so PostgREST has no FK to auto-embed profiles on
// that table — unlike place_visit_participants/place_wishlist, which were
// pointed at profiles specifically to allow that embed. Two-step lookup
// instead of a nested select.
export function usePartnerInfo(spaceId: string, currentUserId: string | null): PartnerInfo {
  const [partner, setPartner] = useState<PartnerInfo>({ partnerId: null, partnerName: null })

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
        setPartner({ partnerId: null, partnerName: null })
        return
      }

      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', partnerId)
        .maybeSingle()

      setPartner({ partnerId, partnerName: partnerProfile?.display_name ?? null })
    }
    load()
  }, [spaceId, currentUserId])

  return partner
}

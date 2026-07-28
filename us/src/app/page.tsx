import { redirect } from 'next/navigation'
import { getSessionAndMembership } from '@/lib/session'
import { getPostAuthRedirect } from '@/lib/routing'

export default async function RootPage() {
  const { user, spaceId } = await getSessionAndMembership()

  if (!user) {
    redirect('/login')
  }

  redirect(getPostAuthRedirect(!!spaceId))
}

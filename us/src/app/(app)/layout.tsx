import { redirect } from 'next/navigation'
import { getSessionAndMembership } from '@/lib/session'
import { SpaceProvider } from '@/lib/space-context'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, spaceId } = await getSessionAndMembership()

  if (!user) {
    redirect('/login')
  }

  if (!spaceId) {
    redirect('/welcome')
  }

  return (
    <SpaceProvider spaceId={spaceId}>
      <div className="flex min-h-screen flex-col pb-16">
        <main className="flex-1">{children}</main>
        <BottomNav />
      </div>
    </SpaceProvider>
  )
}

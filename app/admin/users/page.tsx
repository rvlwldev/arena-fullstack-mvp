import { AppShell } from '@/app/_components/AppShell'
import { AdminUsersClient } from './AdminUsersClient'

export const dynamic = 'force-dynamic'

export default function AdminUsersPage() {
  return (
    <AppShell wide>
      <AdminUsersClient />
    </AppShell>
  )
}

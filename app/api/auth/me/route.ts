import { getCurrentUserWithBan } from '@/app/_lib/auth/session'
import { handle, ok } from '@/app/_lib/http'

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUserWithBan()
    return ok({ user })
  })
}

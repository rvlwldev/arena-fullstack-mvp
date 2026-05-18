import Link from 'next/link'
import { Card } from '../_components/ui'

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">관리자</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/issues">
          <Card className="transition hover:border-neutral-400">
            <h2 className="text-lg font-semibold">이슈 관리</h2>
            <p className="mt-1 text-sm text-neutral-600">이슈를 등록·수정·삭제합니다.</p>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="transition hover:border-neutral-400">
            <h2 className="text-lg font-semibold">사용자 관리</h2>
            <p className="mt-1 text-sm text-neutral-600">사용자를 검색하고 일정 기간 밴을 적용합니다.</p>
          </Card>
        </Link>
      </div>
    </div>
  )
}

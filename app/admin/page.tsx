import Link from 'next/link'
import { AppShell } from '../_components/AppShell'
import { Card } from '../_components/ui'

export default function AdminHomePage() {
  return (
    <AppShell wide>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">운영 콘솔</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">전장 관리</h1>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/issues">
          <Card className="transition hover:border-white/25">
            <h2 className="text-lg font-black text-white">이슈 관리</h2>
            <p className="mt-1 text-xs font-bold text-white/55">전장(이슈) 등록·수정·삭제, 시간 윈도우 조정</p>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="transition hover:border-white/25">
            <h2 className="text-lg font-black text-white">사용자 관리</h2>
            <p className="mt-1 text-xs font-bold text-white/55">검색·기간 밴 적용·해제</p>
          </Card>
        </Link>
      </div>
    </AppShell>
  )
}

import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessToken } from './app/_lib/auth/jwt'
import { ACCESS_COOKIE } from './app/_lib/auth/cookies'

export const config = {
  matcher: ['/api/admin/:path*', '/admin/:path*'],
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value
  if (!token) return unauthorized(req)
  const payload = await verifyAccessToken(token)
  if (!payload || payload.role !== 'ADMIN') return unauthorized(req)
  return NextResponse.next()
}

function unauthorized(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

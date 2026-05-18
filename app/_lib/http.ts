import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { HttpError } from './auth/session'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    const value = await fn()
    if (value instanceof NextResponse) return value
    return NextResponse.json(value)
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message)
    if (e instanceof ZodError) {
      return fail(400, e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '))
    }
    console.error(e)
    return fail(500, '서버 내부 오류')
  }
}

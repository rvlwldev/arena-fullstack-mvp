import { SignJWT, jwtVerify } from 'jose'
import { env } from '../env'

const enc = new TextEncoder()

export interface AccessPayload {
  sub: string
  role: 'USER' | 'ADMIN'
  nickname: string
}

export interface RefreshPayload {
  sub: string
  jti: string
}

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(`${env().ACCESS_TOKEN_TTL}s`)
    .sign(enc.encode(env().JWT_ACCESS_SECRET))
}

export async function signRefreshToken(payload: RefreshPayload): Promise<string> {
  return new SignJWT({ jti: payload.jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(`${env().REFRESH_TOKEN_TTL}s`)
    .sign(enc.encode(env().JWT_REFRESH_SECRET))
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(env().JWT_ACCESS_SECRET))
    if (typeof payload.sub !== 'string') return null
    return {
      sub: payload.sub,
      role: payload.role as 'USER' | 'ADMIN',
      nickname: payload.nickname as string,
    }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, enc.encode(env().JWT_REFRESH_SECRET))
    if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string') return null
    return { sub: payload.sub, jti: payload.jti }
  } catch {
    return null
  }
}

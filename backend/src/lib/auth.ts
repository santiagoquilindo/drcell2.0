import crypto from 'node:crypto'

import { env } from '../config/env.js'

const SCRYPT_KEY_LENGTH = 64
const SESSION_BYTES = 48

export const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt)
  return `${salt}:${derivedKey}`
}

export const verifyPassword = async (password: string, storedHash: string) => {
  const [salt, expected] = storedHash.split(':')
  if (!salt || !expected) return false
  const derivedKey = await scrypt(password, salt)
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(expected, 'hex'))
}

export const generateSessionToken = () => crypto.randomBytes(SESSION_BYTES).toString('hex')

export const hashSessionToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

export const parseCookies = (cookieHeader?: string | null) => {
  if (!cookieHeader) return {} as Record<string, string>

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const [name, ...rest] = chunk.trim().split('=')
    if (!name || rest.length === 0) return acc
    acc[name] = decodeURIComponent(rest.join('='))
    return acc
  }, {})
}

export const buildSessionCookie = (token: string, expiresAt: Date) => {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${env.SESSION_TTL_HOURS * 60 * 60}`,
    `Expires=${expiresAt.toUTCString()}`,
  ]

  if (env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export const buildExpiredSessionCookie = () => {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]

  if (env.NODE_ENV === 'production') {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function scrypt(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }

      resolve(derivedKey.toString('hex'))
    })
  })
}

import type { NextFunction, Request, Response } from 'express'

import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import { buildExpiredSessionCookie, hashSessionToken, parseCookies } from '../lib/auth.js'

type AdminSession = {
  adminId: number
  email: string
  name: string
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminSession
  }
}

const extractToken = (req: Request) => {
  const auth = req.header('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim()
  }

  const cookies = parseCookies(req.header('cookie'))
  return cookies[env.SESSION_COOKIE_NAME] ?? null
}

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req)
    if (!token) {
      return res.status(401).json({ message: 'Debes iniciar sesion para continuar' })
    }

    await pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()')

    const result = await pool.query<{
      adminId: number
      email: string
      name: string
    }>(
      `
        SELECT
          au.id AS "adminId",
          au.email,
          au.name
        FROM admin_sessions s
        INNER JOIN admin_users au ON au.id = s.admin_user_id
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
          AND au.is_active = TRUE
        LIMIT 1
      `,
      [hashSessionToken(token)],
    )

    if (result.rowCount === 0) {
      res.setHeader('Set-Cookie', buildExpiredSessionCookie())
      return res.status(401).json({ message: 'Sesion invalida o expirada' })
    }

    req.admin = result.rows[0]
    next()
  } catch (error) {
    next(error)
  }
}

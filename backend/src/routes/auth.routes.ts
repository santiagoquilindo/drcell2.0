import { Router } from 'express'
import { z } from 'zod'

import { pool } from '../config/database.js'
import { env } from '../config/env.js'
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  generateSessionToken,
  hashSessionToken,
  parseCookies,
  verifyPassword,
} from '../lib/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body)
    await pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()')
    const result = await pool.query<{
      id: number
      email: string
      passwordHash: string
      name: string
      isActive: boolean
    }>(
      `
        SELECT
          id,
          email,
          password_hash AS "passwordHash",
          name,
          is_active AS "isActive"
        FROM admin_users
        WHERE email = $1
        LIMIT 1
      `,
      [data.email.trim().toLowerCase()],
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Credenciales invalidas' })
    }

    const admin = result.rows[0]
    if (!admin.isActive) {
      return res.status(403).json({ message: 'Tu usuario administrador esta inactivo' })
    }

    const validPassword = await verifyPassword(data.password, admin.passwordHash)
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales invalidas' })
    }

    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)

    await pool.query('DELETE FROM admin_sessions WHERE admin_user_id = $1', [admin.id])
    await pool.query(
      `
        INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [admin.id, hashSessionToken(token), expiresAt],
    )

    res.setHeader('Set-Cookie', buildSessionCookie(token, expiresAt))
    res.json({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()')
    const token = parseCookies(req.header('cookie'))[env.SESSION_COOKIE_NAME]
    if (token) {
      await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [hashSessionToken(token)])
    }

    res.setHeader('Set-Cookie', buildExpiredSessionCookie())
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

router.get('/me', requireAdmin, async (req, res) => {
  res.json({
    user: req.admin,
  })
})

export default router

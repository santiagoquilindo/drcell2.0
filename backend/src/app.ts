import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { ZodError } from 'zod'

import { env } from './config/env.js'
import routes from './routes/index.js'

export function createApp() {
  const app = express()
  const uploadsDirectory = path.resolve(process.cwd(), env.UPLOADS_DIR)

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1)
  }

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)

  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed'))
    },
    credentials: true,
  }

  app.use(
    cors(corsOptions),
  )
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
  app.use(express.json({ limit: '8mb' }))
  app.use(express.urlencoded({ extended: false }))
  app.use(
    '/uploads',
    express.static(uploadsDirectory, {
      fallthrough: false,
      maxAge: env.NODE_ENV === 'production' ? '1d' : 0,
    }),
  )

  app.use('/api', routes)

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: 'Datos invalidos', issues: err.issues })
    }
    if (err instanceof Error && err.message === 'Origin not allowed') {
      return res.status(403).json({ message: 'Origen no permitido' })
    }
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor' })
  })

  return app
}

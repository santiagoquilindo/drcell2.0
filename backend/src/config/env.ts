import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173,http://localhost:5178'),
  SESSION_COOKIE_NAME: z.string().min(3).default('drcell_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  SESSION_COOKIE_DOMAIN: z.string().trim().optional(),
  SESSION_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SESSION_COOKIE_SECURE: z.coerce.boolean().optional(),
  TRUST_PROXY: z.coerce.boolean().default(false),
  UPLOADS_DIR: z.string().min(1).default('uploads'),
  BUSINESS_NAME: z.string().min(3).default('drcell 2.0'),
  BUSINESS_TRADE_NAME: z.string().optional(),
  BUSINESS_TAX_ID: z.string().optional(),
  BUSINESS_ADDRESS: z.string().optional(),
  BUSINESS_PHONE: z.string().optional(),
  BUSINESS_EMAIL: z.string().email().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data

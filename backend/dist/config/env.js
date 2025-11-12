import { config } from 'dotenv';
import { z } from 'zod';
config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().url(),
    ADMIN_API_KEY: z.string().min(8).optional(),
    BUSINESS_NAME: z.string().min(3).default('drcell 2.0'),
    BUSINESS_TRADE_NAME: z.string().optional(),
    BUSINESS_TAX_ID: z.string().optional(),
    BUSINESS_ADDRESS: z.string().optional(),
    BUSINESS_PHONE: z.string().optional(),
    BUSINESS_EMAIL: z.string().email().optional(),
    OPENAI_API_KEY: z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
}
export const env = parsed.data;

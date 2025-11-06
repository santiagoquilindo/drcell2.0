import { Pool } from 'pg';
import { env } from './env.js';
export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
});

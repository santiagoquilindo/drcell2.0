import { pool } from '../config/database.js'
import { hashPassword } from '../lib/auth.js'

async function main() {
  const [, , emailArg, passwordArg, ...nameParts] = process.argv
  const email = emailArg?.trim().toLowerCase()
  const password = passwordArg?.trim()
  const name = nameParts.join(' ').trim() || 'Administrador'

  if (!email || !password) {
    console.error('Uso: npm run create-admin -- <email> <password> [nombre]')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)

  await pool.query(
    `
      INSERT INTO admin_users (email, password_hash, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        is_active = TRUE,
        updated_at = NOW()
    `,
    [email, passwordHash, name],
  )

  console.log(`Administrador listo: ${email}`)
  await pool.end()
}

main().catch(async (error) => {
  console.error('No se pudo crear el administrador', error)
  await pool.end()
  process.exit(1)
})

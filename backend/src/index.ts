import { createApp } from './app.js'
import { pool } from './config/database.js'
import { env } from './config/env.js'

async function start() {
  try {
    await pool.query('SELECT 1')
    console.log('Conexion a PostgreSQL exitosa')
  } catch (error) {
    console.error('Error al conectar con PostgreSQL', error)
    process.exit(1)
  }

  const app = createApp()

  app.listen(env.PORT, () => {
    console.log(`Backend escuchando en puerto ${env.PORT}`)
  })
}

start().catch((error) => {
  console.error('No fue posible iniciar el servidor', error)
  process.exit(1)
})

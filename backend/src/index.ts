import { createApp } from './app.js'
import { pool } from './config/database.js'
import { env } from './config/env.js'

async function start() {
  try {
    await pool.query('SELECT 1')
    await verifyRequiredSchema()
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

async function verifyRequiredSchema() {
  const checks = await pool.query<{
    productsInventoryLink: boolean
    repairPartsTable: boolean
    repairManualLabor: boolean
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'productos'
          AND column_name = 'inventario_item_id'
      ) AS "productsInventoryLink",
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'repair_parts'
      ) AS "repairPartsTable",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'repair_tickets'
          AND column_name = 'mano_obra'
      ) AS "repairManualLabor"
  `)

  const row = checks.rows[0]
  const missingMigrations: string[] = []

  if (!row?.productsInventoryLink) {
    missingMigrations.push('backend/sql/010_product_inventory_link.sql')
  }

  if (!row?.repairPartsTable) {
    missingMigrations.push('backend/sql/011_repair_parts.sql')
  }

  if (!row?.repairManualLabor) {
    missingMigrations.push('backend/sql/012_repair_financials.sql')
  }

  if (missingMigrations.length > 0) {
    throw new Error(`Faltan migraciones obligatorias en PostgreSQL: ${missingMigrations.join(', ')}`)
  }
}

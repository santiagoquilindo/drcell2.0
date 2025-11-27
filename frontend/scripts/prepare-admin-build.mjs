import { cpSync, existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const adminOutputDir = join(process.cwd(), 'dist-admin')

if (!existsSync(distDir)) {
  console.error('[prepare-admin-build] No existe la carpeta dist. Ejecuta `npm run build` primero.')
  process.exit(1)
}

if (existsSync(adminOutputDir)) {
  rmSync(adminOutputDir, { recursive: true, force: true })
}

cpSync(distDir, adminOutputDir, { recursive: true })

const adminHtmlPath = join(adminOutputDir, 'admin.html')
const indexHtmlPath = join(adminOutputDir, 'index.html')

if (!existsSync(adminHtmlPath)) {
  console.error('[prepare-admin-build] No se encontró admin.html en dist. Verifica el build.')
  process.exit(1)
}

const adminHtml = readFileSync(adminHtmlPath, 'utf8')
writeFileSync(indexHtmlPath, adminHtml, 'utf8')
rmSync(adminHtmlPath)

console.log('[prepare-admin-build] Carpeta dist-admin lista para desplegar el panel.')

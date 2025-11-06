import { ENV } from '@utils/env'

/* Util */
const NL = '\n'

/* ---------- Armador de mensaje desde carrito ---------- */
export const construirMensajeWhatsApp = (
  items: Array<{ nombre: string; cantidad: number; precio: number }>
) => {
  const detalle = items
    .map(
      (i) =>
        `• ${i.nombre} ×${i.cantidad} — ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(i.precio * i.cantidad)}`
    )
    .join(NL)

  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const pie =
    items.length > 0
      ? `${NL}${NL}Total: ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(total)}`
      : ''

  const legal =
    `${NL}${NL}_Declaro que acepto la Política de Datos y los Términos._`

  return `Hola Doctor Cell 2.0! 👋 Me interesa comprar:${NL}${detalle}${pie}${legal}`
}

/* ---------- Abrir WhatsApp en nueva pestaña ---------- */
export const abrirWhatsApp = (texto: string) => {
  const url = `https://wa.me/${ENV.WHATSAPP_E164}?text=${encodeURIComponent(texto)}`
  window.open(url, '_blank', 'noopener')
}

/* ---------- Plantillas rápidas (botones) ---------- */
export const msgCompraVenta = () =>
  'Hola! Quiero *cotizar una compra/venta*. ¿Me ayudas con opciones?'

export const msgCredito = () =>
  'Hola! Quiero *información de crédito* (requisitos y simulación).'

/* ---------- Formularios detallados ---------- */
export type ReparacionEquipo = 'Celular' | 'Tablet' | 'Laptop' | 'Computador'
export type ReparacionDanio = 'Hardware' | 'Software'

export function msgReparacion(
  equipo: ReparacionEquipo,
  danio: ReparacionDanio,
  marcaModelo?: string,
  descripcion?: string
) {
  const filas = [
    'Hola, quiero *cotizar una reparación*.',
    `• *Equipo:* ${equipo}`,
    `• *Tipo de daño:* ${danio}`,
    marcaModelo ? `• *Marca/Modelo:* ${marcaModelo}` : '',
    descripcion ? `• *Detalle:* ${descripcion}` : '',
  ].filter(Boolean)
  return filas.join(NL)
}

/* ------------ Compra/Venta con detalle ------------ */
export type CompraTipo = 'Celular nuevo' | 'Celular usado' | 'Accesorio'
export type SOPreferido = 'Android' | 'iPhone' | 'Indiferente'

export function msgCompraDetalle(
  tipo: CompraTipo,
  marcaModelo?: string,
  so?: SOPreferido,
  presupuesto?: number,
  observaciones?: string
) {
  const filas = [
    'Hola, quiero *cotizar una compra*.',
    `• *Tipo:* ${tipo}`,
    marcaModelo ? `• *Marca/Modelo deseado:* ${marcaModelo}` : '',
    so ? `• *Preferencia:* ${so}` : '',
    presupuesto && presupuesto > 0
      ? `• *Presupuesto:* ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(presupuesto)}`
      : '',
    observaciones ? `• *Observaciones:* ${observaciones}` : '',
    '',
    '¿Qué opciones me recomiendan?',
  ].filter(Boolean)
  return filas.join(NL)
}

/* ----------------- Crédito con detalle ----------------- */
export type EntidadCredito = 'Addi' | 'Sistecrédito' | 'Cupo Brilla' | 'Indiferente'

export function msgCreditoDetalle(
  entidad: EntidadCredito,
  monto?: number,
  cuotaInicial?: number,
  plazoMeses?: number,
  observaciones?: string
) {
  const filas = [
    'Hola, quiero *información de crédito*.',
    `• *Entidad preferida:* ${entidad}`,
    monto && monto > 0
      ? `• *Monto aproximado:* ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(monto)}`
      : '',
    cuotaInicial && cuotaInicial > 0
      ? `• *Cuota inicial:* ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(cuotaInicial)}`
      : '',
    plazoMeses ? `• *Plazo estimado:* ${plazoMeses} meses` : '',
    observaciones ? `• *Observaciones:* ${observaciones}` : '',
    '',
    '¿Requisitos y simulación de cuotas?',
  ].filter(Boolean)
  return filas.join(NL)
}

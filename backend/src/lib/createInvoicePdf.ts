import dayjs from 'dayjs'
import PDFDocument from 'pdfkit'

import { env } from '../config/env.js'
import type { InvoiceWithItems } from '../routes/invoices.routes.js'

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
})

export async function createInvoicePdf(invoice: InvoiceWithItems) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    drawHeader(doc, invoice)
    drawItems(doc, invoice)
    drawTotals(doc, invoice)

    if (invoice.notas) {
      doc.moveDown()
      doc.fontSize(10).fillColor('#444').text(`Notas: ${invoice.notas}`)
    }

    doc.end()
  })
}

function drawHeader(doc: PDFKit.PDFDocument, invoice: InvoiceWithItems) {
  doc
    .fontSize(20)
    .fillColor('#0a7c45')
    .text(env.BUSINESS_NAME ?? 'drcell 2.0', { continued: false })
    .moveDown(0.2)

  doc.fontSize(11).fillColor('#111')

  if (env.BUSINESS_TRADE_NAME) {
    doc.text(env.BUSINESS_TRADE_NAME)
  }

  if (env.BUSINESS_TAX_ID) {
    doc.text(`NIT: ${env.BUSINESS_TAX_ID}`)
  }
  if (env.BUSINESS_ADDRESS) {
    doc.text(env.BUSINESS_ADDRESS)
  }
  if (env.BUSINESS_PHONE) {
    doc.text(env.BUSINESS_PHONE)
  }
  if (env.BUSINESS_EMAIL) {
    doc.text(env.BUSINESS_EMAIL)
  }

  doc.moveDown()
  doc
    .fontSize(14)
    .text(`${invoice.tipo === 'factura' ? 'Factura' : 'Cotización'} #${invoice.consecutivo}`, { align: 'left' })
  doc.fontSize(11).text(`Estado: ${invoice.estado}`)
  doc.text(`Fecha: ${dayjs(invoice.createdAt).format('DD/MM/YYYY HH:mm')}`)

  doc.moveDown()
  doc.fontSize(12).text('Datos del cliente', { underline: true })
  doc.fontSize(11)
  doc.text(invoice.clienteNombre)
  if (invoice.clienteIdentificacion) doc.text(`Identificación: ${invoice.clienteIdentificacion}`)
  if (invoice.clienteTelefono) doc.text(`Teléfono: ${invoice.clienteTelefono}`)
  if (invoice.clienteEmail) doc.text(`Email: ${invoice.clienteEmail}`)
  if (invoice.clienteDireccion) doc.text(`Dirección: ${invoice.clienteDireccion}`)
  doc.moveDown()
}

function drawItems(doc: PDFKit.PDFDocument, invoice: InvoiceWithItems) {
  const tableTop = doc.y
  doc.fontSize(11).text('Descripción', 40, tableTop)
  doc.text('Cant.', 260, tableTop, { width: 50, align: 'right' })
  doc.text('Unitario', 320, tableTop, { width: 80, align: 'right' })
  doc.text('Total', 420, tableTop, { width: 80, align: 'right' })
  doc.moveDown(0.5)
  doc.moveTo(40, doc.y).lineTo(520, doc.y).stroke('#e5e7eb')

  invoice.items.forEach((item) => {
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#111').text(item.descripcion, 40)
    doc.text(item.cantidad.toString(), 260, doc.y - 12, { width: 50, align: 'right' })
    doc.text(formatCOP(item.precioUnitario), 320, doc.y - 12, { width: 80, align: 'right' })
    doc.text(formatCOP(item.total), 420, doc.y - 12, { width: 80, align: 'right' })
    doc.moveDown(0.2)
    doc.moveTo(40, doc.y).lineTo(520, doc.y).strokeColor('#f1f5f9').stroke()
  })

  doc.moveDown()
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: InvoiceWithItems) {
  const startY = doc.y
  doc
    .fontSize(11)
    .text(`Subtotal: ${formatCOP(invoice.subtotal)}`, 300, startY, { align: 'right' })
    .moveDown(0.2)
  doc.text(`Impuestos: ${formatCOP(invoice.impuesto)}`, { align: 'right' })
  if (invoice.descuento > 0) {
    doc.text(`Descuentos: -${formatCOP(invoice.descuento)}`, { align: 'right' })
  }
  if (invoice.anticipo > 0) {
    doc.text(`Anticipo: -${formatCOP(invoice.anticipo)}`, { align: 'right' })
  }

  doc.fontSize(14).fillColor('#0a7c45').text(`TOTAL: ${formatCOP(invoice.total)}`, { align: 'right' })
  doc.fontSize(12).fillColor('#b91c1c').text(`Saldo: ${formatCOP(invoice.saldo)}`, { align: 'right' })
}

const formatCOP = (value: number) => currencyFormatter.format(value)

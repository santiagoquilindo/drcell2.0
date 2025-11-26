import dayjs from 'dayjs'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

import { env } from '../config/env.js'

type StickerData = {
  codigo: string
  clienteNombre: string
  dispositivo: string
  motivo: string
  fecha: Date | string
  trackingUrl?: string
}

const STICKER_SIZE_MM = { width: 80, height: 50 }
const MM_TO_POINTS = 2.83465

export async function createRepairSticker(data: StickerData) {
  const qrText = data.trackingUrl ?? buildTrackingUrl(data.codigo)
  const qrBuffer = await QRCode.toBuffer(qrText, { width: 128, margin: 1 })

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [STICKER_SIZE_MM.width * MM_TO_POINTS, STICKER_SIZE_MM.height * MM_TO_POINTS],
      margin: 10,
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(10).fillColor('#0a7c45').text(env.BUSINESS_NAME ?? 'drcell 2.0', { align: 'center' })
    doc.moveDown(0.1)
    doc
      .fontSize(12)
      .fillColor('#111')
      .text(data.codigo, { align: 'center', underline: true })
      .moveDown(0.2)

    const infoWidth = (STICKER_SIZE_MM.width * MM_TO_POINTS - 20) * 0.55

    doc
      .fontSize(8)
      .fillColor('#333')
      .text(`Cliente: ${truncate(data.clienteNombre, 30)}`, { width: infoWidth })
      .text(`Equipo: ${truncate(data.dispositivo, 30)}`, { width: infoWidth })
      .text(`Motivo: ${truncate(data.motivo, 34)}`, { width: infoWidth })
      .text(`Ingreso: ${dayjs(data.fecha).format('DD/MM HH:mm')}`, { width: infoWidth })
      .text('Escanea el QR para seguimiento', { width: infoWidth })

    const qrSize = STICKER_SIZE_MM.height * MM_TO_POINTS - 25
    const qrX = STICKER_SIZE_MM.width * MM_TO_POINTS - qrSize - 12
    const qrY = 18
    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize })

    doc.fontSize(6).fillColor('#555').text(shortenUrl(qrText), qrX, qrY + qrSize + 2, {
      width: qrSize,
      align: 'center',
    })

    doc.end()
  })
}

const truncate = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 3)}...` : value)

const buildTrackingUrl = (code: string) => {
  const base = env.PUBLIC_APP_URL ?? 'http://localhost:5178'
  const url = new URL('/seguimiento', base)
  url.searchParams.set('ticket', code)
  return url.toString()
}

const shortenUrl = (url: string, max = 32) => {
  return url.length > max ? `${url.slice(0, max - 3)}...` : url
}

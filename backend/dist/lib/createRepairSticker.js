import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
const STICKER_SIZE_MM = { width: 80, height: 50 };
const MM_TO_POINTS = 2.83465;
export function createRepairSticker(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [STICKER_SIZE_MM.width * MM_TO_POINTS, STICKER_SIZE_MM.height * MM_TO_POINTS],
            margin: 10,
        });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.fontSize(10).fillColor('#0a7c45').text(env.BUSINESS_NAME ?? 'drcell 2.0', { align: 'center' });
        doc.moveDown(0.2);
        doc
            .fontSize(12)
            .fillColor('#111')
            .text(data.codigo, { align: 'center', underline: true })
            .moveDown(0.2);
        doc.fontSize(8).fillColor('#333');
        doc.text(`Cliente: ${truncate(data.clienteNombre, 28)}`);
        doc.text(`Equipo: ${truncate(data.dispositivo, 28)}`);
        doc.text(`Motivo: ${truncate(data.motivo, 32)}`);
        doc.text(`Fecha: ${dayjs(data.fecha).format('DD/MM HH:mm')}`);
        doc.end();
    });
}
const truncate = (value, length) => (value.length > length ? `${value.slice(0, length - 1)}…` : value);

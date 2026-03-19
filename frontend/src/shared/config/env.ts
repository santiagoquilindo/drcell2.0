const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const rawWhatsAppNumber = import.meta.env.VITE_WHATSAPP_NUMBER?.trim()
const defaultApiUrl = 'http://localhost:4000/api'

if (import.meta.env.PROD && (!rawApiUrl || rawApiUrl === '')) {
  throw new Error('VITE_API_URL es obligatorio en produccion')
}

export const env = {
  apiUrl: rawApiUrl && rawApiUrl !== '' ? rawApiUrl : defaultApiUrl,
  whatsappNumber: rawWhatsAppNumber ?? '',
}

const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
const rawWhatsAppNumber = import.meta.env.VITE_WHATSAPP_NUMBER?.trim()

export const env = {
  apiUrl: rawApiUrl && rawApiUrl !== '' ? rawApiUrl : 'http://localhost:4000/api',
  whatsappNumber: rawWhatsAppNumber ?? '',
}

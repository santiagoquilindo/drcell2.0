import React from 'react'
import { MessageCircle } from 'lucide-react'
import { abrirWhatsApp, construirMensajeWhatsApp } from '@utils/whatsapp'
import { useCart } from '@context/cart'

export const WhatsAppFloat: React.FC = () => {
  const { state } = useCart()
  const onClick = () => {
    const message = construirMensajeWhatsApp(state.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })))
    abrirWhatsApp(message)
  }
  return (
    <>
      <button onClick={onClick} className="fixed z-40 bottom-6 right-6 rounded-full bg-green-500 hover:bg-green-400 text-black font-bold shadow-xl shadow-green-500/30 px-5 py-4 flex items-center gap-2" title="Escríbenos por WhatsApp">
        <MessageCircle /> WhatsApp
      </button>
      <p className="fixed bottom-2 right-6 text-[11px] text-green-200/80 bg-black/20 px-2 py-1 rounded">
        Al continuar por WhatsApp aceptas la Política de Datos y los Términos.
      </p>
    </>
  )
}

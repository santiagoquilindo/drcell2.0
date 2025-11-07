import React from 'react'
import { abrirWhatsApp, construirMensajeWhatsApp } from '@utils/whatsapp'
import { useCart } from '@context/cart'

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    aria-hidden="true"
    className={className}
  >
    <path
      fill="#25D366"
      d="M16,2.4C8.82,2.4,3,8.1,3,15c0,2.58.88,4.97,2.36,6.91L3.08,29,7.2,26.5c2.1,1.15,4.45,1.8,6.8,1.8,7.18,0,13-5.69,13-12.6C27,8.1,23.18,2.4,16,2.4Z"
    />
    <path
      fill="#FFF"
      d="M23.47,18.21c-.39-.2-2.26-1.1-2.61-1.22-.35-.13-.6-.2-.86.2-.26.39-1,1.22-1.21,1.47-.22.26-.45.29-.84.1-.39-.2-1.65-.6-3.14-1.94-1.16-1.05-1.94-2.36-2.17-2.75-.22-.39-.02-.6.17-.79.17-.17.39-.45.58-.68.2-.22.26-.39.39-.63.13-.26.06-.47-.03-.66-.1-.2-.83-2-1.15-2.69-.31-.72-.73-.63-.99-.64h-.84c-.26,0-.68.1-1.04.47-.35.39-1.37,1.33-1.37,3.22s1.4,3.74,1.6,4c.22.29,2.48,3.75,6.04,5.26,2.24.96,3.73.31,4.42-.49.7-.78.77-1.81.54-2.25-.22-.45-.7-.7-.99-.85Z"
    />
  </svg>
)

export const WhatsAppFloat: React.FC = () => {
  const { state } = useCart()
  const onClick = () => {
    const message = construirMensajeWhatsApp(
      state.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })),
    )
    abrirWhatsApp(message)
  }
  return (
    <>
      <button
        onClick={onClick}
        className="fixed z-40 bottom-6 right-6 rounded-full bg-white text-green-600 border border-green-400 hover:bg-green-50 font-bold shadow-xl shadow-green-500/20 px-5 py-4 flex items-center gap-2 transition-colors"
        title="Escríbenos por WhatsApp"
      >
        <WhatsAppIcon className="h-6 w-6" />
        WhatsApp
      </button>
      <p className="fixed bottom-2 right-6 text-[11px] text-green-200/80 bg-black/20 px-2 py-1 rounded">
        Al continuar por WhatsApp aceptas la Politica de Datos y los Terminos.
      </p>
    </>
  )
}


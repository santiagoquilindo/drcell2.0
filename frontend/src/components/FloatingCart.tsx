import React from 'react'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@context/cart'

type Props = {
  onClick: () => void
}

export const FloatingCart: React.FC<Props> = ({ onClick }) => {
  const { count } = useCart()

  return (
    <button
      onClick={onClick}
      className="fixed z-40 bottom-24 right-6 rounded-full bg-green-500 hover:bg-green-400 text-black font-bold shadow-xl shadow-green-500/30 px-5 py-4 flex items-center gap-2"
      title="Abrir carrito"
      aria-label="Abrir carrito"
    >
      <ShoppingCart />
      <span>Carrito</span>

      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-6 h-6 px-1 grid place-items-center font-bold">
          {count}
        </span>
      )}
    </button>
  )
}

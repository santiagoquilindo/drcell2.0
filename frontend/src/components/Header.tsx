import React from 'react'
import { MapPin, PhoneCall, ShoppingCart } from 'lucide-react'
import { useCart } from '@context/cart'

type Props = {
  onLocation: () => void
  onCart: () => void
}

export const Header: React.FC<Props> = ({ onLocation, onCart }) => {
  const { count } = useCart()

  return (
    <header className="bg-white border-b">
      <div className="container mx-auto px-4 py-6 flex items-center justify-between">
        {/* Logo + marca */}
        <div className="flex items-center gap-3">
          {/* Coloca el archivo en: public/logo-dr-cell-2.0.jpg */}
          <img
            src="/logodrcell.png"
            alt="Doctor Cell 2.0"
            className="h-12 w-12 rounded-md object-cover"
            loading="eager"
            decoding="async"
          />
          <div>
            <h1 className="text-3xl font-bold text-green-700">Doctor Cell 2.0</h1>
            <p className="text-gray-600 text-sm">Mantenimiento y Tecnología</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLocation}
            className="hidden md:flex items-center gap-2 text-gray-800 border border-gray-300 rounded-full px-3 py-1 hover:border-green-600"
          >
            <MapPin size={18} /> Local 4 – El Bostezo
          </button>

          <a
            href="tel:+573122650861"
            className="hidden md:flex items-center gap-2 text-white bg-green-600 rounded-full px-3 py-1 font-semibold hover:bg-green-700"
          >
            <PhoneCall size={18} /> 312 265 0861
          </a>

          <button
            onClick={onCart}
            className="relative bg-green-600 text-white px-4 py-2 rounded-full font-semibold flex items-center gap-2 hover:bg-green-700"
          >
            <ShoppingCart size={20} />
            <span>Carrito</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full min-w-6 h-6 px-1 grid place-items-center font-bold">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header

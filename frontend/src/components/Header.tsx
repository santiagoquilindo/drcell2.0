import React from 'react'
import { MapPin, PhoneCall, ShoppingCart } from 'lucide-react'
import { useCart } from '@context/cart'

type Props = {
  onLocation: () => void
  onCart: () => void
  onAdminAccess: () => void
  isAdmin: boolean
}

export const Header: React.FC<Props> = ({ onLocation, onCart, onAdminAccess, isAdmin }) => {
  const { count } = useCart()
  const clickCountRef = React.useRef(0)
  const timerRef = React.useRef<number | null>(null)

  const handleSecretAccess = React.useCallback(() => {
    clickCountRef.current += 1
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0
      timerRef.current = null
    }, 600)

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      onAdminAccess()
    }
  }, [onAdminAccess])

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm">
      <div className="container mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
        {/* Logo + marca */}
        <div className="flex items-center gap-3 select-none">
          <button
            type="button"
            onClick={handleSecretAccess}
            className="h-12 w-12 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label="Logo Doctor Cell 2.0"
          >
            <img
              src="/logodrcell.png"
              alt="Doctor Cell 2.0"
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-green-700">Doctor Cell 2.0</h1>
              {isAdmin && (
                <span className="text-xs font-semibold text-green-700 border border-green-300 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">Mantenimiento y Tecnologia</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button
            onClick={onLocation}
            className="hidden md:flex items-center gap-2 text-gray-800 border border-gray-300 rounded-full px-3 py-1 hover:border-green-600"
          >
            <MapPin size={18} /> Local 4 - El Bostezo
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

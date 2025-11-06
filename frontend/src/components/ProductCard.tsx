import React from 'react'
import { ShoppingCart } from 'lucide-react'
import type { Producto } from '@modules/catalog'
import { formatoCOP } from '@utils/money'
import { ImageWithFallback } from './ImageWithFallback'

type Props = {
  p: Producto
  onAdd: (p: Producto) => void
  onRemove?: (id: number) => void
}

const isValidImage = (value?: string) => Boolean(value && value.trim() !== '')

export const ProductCard: React.FC<Props> = ({ p, onAdd, onRemove }) => {
  const showImage = isValidImage(p.imagenUrl)

  return (
    <article className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-gray-50">
        {showImage ? (
          <img
            src={p.imagenUrl}
            alt={p.nombre}
            className="absolute inset-0 h-full w-full object-contain p-3 bg-gray-50"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ImageWithFallback
            src=""
            alt={p.nombre}
            className="absolute inset-0 h-full w-full object-contain p-3 bg-gray-50"
          />
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-green-700">{p.nombre}</h3>
        {p.descripcion && <p className="text-sm text-gray-600 mt-1">{p.descripcion}</p>}

        <p className="mt-4 text-2xl font-extrabold text-green-700">{formatoCOP(p.precio)}</p>

        <button
          onClick={() => onAdd(p)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white py-2 font-semibold hover:bg-green-700"
        >
          <ShoppingCart size={18} />
          Agregar
        </button>

        {onRemove && p.origin === 'remote' && (
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-400 text-red-500 py-2 text-sm font-semibold hover:bg-red-50"
          >
            Eliminar del catálogo
          </button>
        )}
      </div>
    </article>
  )
}

export default ProductCard

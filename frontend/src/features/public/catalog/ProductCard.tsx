import { formatCurrency } from '@shared/lib/currency'
import { resolveAssetUrl } from '@shared/lib/assets'
import type { Product } from '@shared/types/product'

type Props = {
  product: Product
  onAdd: (product: Product) => void
}

export function ProductCard({ product, onAdd }: Props) {
  const imageUrl = resolveAssetUrl(product.imagenUrl)

  return (
    <article className="product-card">
      <div className="product-card-topline">
        <span className="product-category">{product.categoria}</span>
        <span className={`inventory-pill${product.stock > 0 ? '' : ' inventory-pill-out'}`}>{product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}</span>
      </div>

      <div className="product-card-image">
        {imageUrl ? <img src={imageUrl} alt={product.nombre} /> : <span>Sin imagen</span>}
      </div>

      <div className="stack-sm">
        <div>
          <h3>{product.nombre}</h3>
        </div>
        <p className="muted">{product.descripcion}</p>
        <div className="product-card-footer">
          <div className="product-price-block">
            <strong>{formatCurrency(product.precio)}</strong>
            <span className="muted">Precio de referencia</span>
          </div>
          <button className="primary-button" disabled={product.stock === 0} onClick={() => onAdd(product)} type="button">
            {product.stock === 0 ? 'No disponible' : 'Agregar al pedido'}
          </button>
        </div>
      </div>
    </article>
  )
}

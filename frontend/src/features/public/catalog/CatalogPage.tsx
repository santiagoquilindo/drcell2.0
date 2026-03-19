import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCart } from '@features/public/cart/CartContext'
import { fetchProducts } from '@shared/api/products'
import type { Product } from '@shared/types/product'

import { CartPanel } from './CartPanel'
import { ProductCard } from './ProductCard'

export function CatalogPage() {
  const { dispatch } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
      .then((response) => {
        setProducts(response)
        setError(null)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el catalogo')
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return products

    return products.filter((product) =>
      `${product.nombre} ${product.descripcion} ${product.categoria}`.toLowerCase().includes(normalizedQuery),
    )
  }, [products, query])

  return (
    <div className="catalog-page">
      <section className="hero hero-commerce">
        <div className="stack-md">
          <p className="eyebrow">Dr. Cell</p>
          <h1>Accesorios, equipos y soluciones moviles listos para vender con atencion directa</h1>
          <p className="hero-copy">
            Explora el catalogo, arma tu pedido y envialo por WhatsApp en segundos. Todo conectado con inventario real desde el panel administrativo.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#catalogo">
              Ver catalogo
            </a>
            <Link className="ghost-button" to="/tracking">
              Seguir reparacion
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <div className="hero-card-top">
            <span className="status-pill status-listo">Operacion activa</span>
            <strong>{products.length} referencias publicas</strong>
          </div>

          <div className="hero-metrics">
            <div>
              <strong>{filteredProducts.length}</strong>
              <span>productos visibles</span>
            </div>
            <div>
              <strong>{new Set(products.map((product) => product.categoria)).size}</strong>
              <span>categorias</span>
            </div>
            <div>
              <strong>WA</strong>
              <span>pedido inmediato</span>
            </div>
          </div>
        </div>
      </section>

      <section className="catalog-toolbar panel" id="catalogo">
        <div className="catalog-toolbar-copy">
          <p className="eyebrow">Catalogo</p>
          <h2>Encuentra rapido lo que el cliente necesita</h2>
          <p className="muted">Busqueda simple, tarjetas mas claras y salida comercial directa al canal de venta.</p>
        </div>

        <label className="search-field">
          <span>Buscar producto</span>
          <input placeholder="Ej. iPhone, Samsung, cargador..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </section>

      <section className="catalog-content">
        <div className="catalog-list-shell">
          <div className="panel-heading">
            <h2>Productos disponibles</h2>
            <span>{filteredProducts.length} resultado(s)</span>
          </div>

          {loading ? (
            <div className="product-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="panel placeholder-card" key={index}>
                  Cargando producto...
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="panel message-card message-card-error">
              <strong>No se pudo cargar el catalogo</strong>
              <p>{error}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="panel message-card">
              <strong>Sin coincidencias</strong>
              <p className="muted">Prueba otra busqueda o revisa las categorias disponibles.</p>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={(selected) => dispatch({ type: 'add', product: selected })} />
              ))}
            </div>
          )}
        </div>

        <CartPanel />
      </section>
    </div>
  )
}

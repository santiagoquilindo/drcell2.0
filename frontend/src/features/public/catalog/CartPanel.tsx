import { useCart } from '@features/public/cart/CartContext'
import { env } from '@shared/config/env'
import { formatCurrency } from '@shared/lib/currency'

function buildWhatsAppMessage(items: ReturnType<typeof useCart>['items'], total: number) {
  return [
    'Hola Dr. Cell, quiero solicitar estos productos:',
    '',
    ...items.map((item) => `- ${item.nombre} | Cantidad: ${item.cantidad} | Precio: ${formatCurrency(item.precio)} | Subtotal: ${formatCurrency(item.precio * item.cantidad)}`),
    '',
    `Total: ${formatCurrency(total)}`,
  ].join('\n')
}

export function CartPanel() {
  const { items, total, count, dispatch } = useCart()

  const handleWhatsApp = () => {
    if (!env.whatsappNumber) {
      window.alert('Configura VITE_WHATSAPP_NUMBER para habilitar WhatsApp.')
      return
    }

    const message = buildWhatsAppMessage(items, total)
    window.open(`https://wa.me/${env.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
  }

  return (
    <aside className="cart-panel">
      <div className="cart-panel-header">
        <div>
          <p className="eyebrow">Pedido rapido</p>
          <h2>Tu seleccion</h2>
          <p className="muted">Arma tu lista y enviala directo a WhatsApp para cotizar o separar productos.</p>
        </div>
        <span className="cart-count-badge">{count} item(s)</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <strong>Tu lista esta vacia</strong>
          <p className="muted">Agrega productos del catalogo para generar un mensaje listo para enviar.</p>
        </div>
      ) : (
        <div className="stack-md">
          <div className="cart-steps">
            <span>1. Selecciona productos</span>
            <span>2. Ajusta cantidades</span>
            <span>3. Envia por WhatsApp</span>
          </div>

          <div className="cart-list">
            {items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div>
                  <strong>{item.nombre}</strong>
                  <p className="muted">
                    {formatCurrency(item.precio)} c/u
                    <br />
                    Subtotal: {formatCurrency(item.precio * item.cantidad)}
                  </p>
                </div>
                <div className="cart-item-actions">
                  <button onClick={() => dispatch({ type: 'decrement', id: item.id })} type="button">
                    -
                  </button>
                  <span>{item.cantidad}</span>
                  <button onClick={() => dispatch({ type: 'increment', id: item.id })} type="button">
                    +
                  </button>
                  <button className="link-button" onClick={() => dispatch({ type: 'remove', id: item.id })} type="button">
                    Quitar
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="cart-summary">
            <div className="cart-total">
              <span>Total estimado</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <button className="link-button" onClick={() => dispatch({ type: 'clear' })} type="button">
              Vaciar lista
            </button>
          </div>

          <button className="primary-button whatsapp-button" onClick={handleWhatsApp} type="button">
            Enviar por WhatsApp
          </button>
        </div>
      )}
    </aside>
  )
}

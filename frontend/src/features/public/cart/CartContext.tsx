import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { PropsWithChildren } from 'react'

import type { Product } from '@shared/types/product'

type CartItem = {
  id: number
  nombre: string
  precio: number
  cantidad: number
}

type CartAction =
  | { type: 'hydrate'; payload: CartItem[] }
  | { type: 'add'; product: Product }
  | { type: 'increment'; id: number }
  | { type: 'decrement'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'clear' }

const STORAGE_KEY = 'drcell_phase1_cart'

const CartContext = createContext<{
  items: CartItem[]
  total: number
  count: number
  dispatch: React.Dispatch<CartAction>
} | null>(null)

function reducer(state: CartItem[], action: CartAction) {
  switch (action.type) {
    case 'hydrate':
      return Array.isArray(action.payload) ? action.payload : []
    case 'add': {
      const existing = state.find((item) => item.id === action.product.id)
      if (existing) {
        return state.map((item) => (item.id === action.product.id ? { ...item, cantidad: item.cantidad + 1 } : item))
      }

      return [
        ...state,
        {
          id: action.product.id,
          nombre: action.product.nombre,
          precio: action.product.precio,
          cantidad: 1,
        },
      ]
    }
    case 'increment':
      return state.map((item) => (item.id === action.id ? { ...item, cantidad: item.cantidad + 1 } : item))
    case 'decrement':
      return state
        .map((item) => (item.id === action.id ? { ...item, cantidad: item.cantidad - 1 } : item))
        .filter((item) => item.cantidad > 0)
    case 'remove':
      return state.filter((item) => item.id !== action.id)
    case 'clear':
      return []
    default:
      return state
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, dispatch] = useReducer(reducer, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      dispatch({ type: 'hydrate', payload: JSON.parse(raw) as CartItem[] })
    } catch {
      dispatch({ type: 'hydrate', payload: [] })
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo(
    () => ({
      items,
      total: items.reduce((acc, item) => acc + item.precio * item.cantidad, 0),
      count: items.reduce((acc, item) => acc + item.cantidad, 0),
      dispatch,
    }),
    [items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider')
  }
  return context
}

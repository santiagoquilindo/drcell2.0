import type { PropsWithChildren } from 'react'

import { AuthProvider } from '@features/admin/auth/AuthContext'
import { CartProvider } from '@features/public/cart/CartContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  )
}

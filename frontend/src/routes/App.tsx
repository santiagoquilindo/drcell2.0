import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Home } from '@pages/Home'
import { Billing } from '@pages/Billing'
import { Repairs } from '@pages/Repairs'
import { Returns } from '@pages/Returns'
import { CartProvider } from '@context/cart'

export default () => (
  <CartProvider>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin/facturacion" element={<Billing />} />
      <Route path="/admin/reparaciones" element={<Repairs />} />
      <Route path="/admin/devoluciones" element={<Returns />} />
    </Routes>
  </CartProvider>
)

import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@features/admin/auth/ProtectedRoute'
import { AdminLoginPage } from '@features/admin/auth/AdminLoginPage'
import { AdminLayout } from '@features/admin/layout/AdminLayout'
import { AdminProductsPage } from '@features/admin/products/AdminProductsPage'
import { AdminRepairsPage } from '@features/admin/repairs/AdminRepairsPage'
import { CatalogPage } from '@features/public/catalog/CatalogPage'
import { PublicLayout } from '@features/public/layout/PublicLayout'
import { TrackingPage } from '@features/public/tracking/TrackingPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/products" replace />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="repairs" element={<AdminRepairsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

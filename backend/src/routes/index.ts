import { Router } from 'express'

import inventoryRoutes from './inventory.routes.js'
import productRoutes from './product.routes.js'
import providersRoutes from './providers.routes.js'

const router = Router()

router.use('/products', productRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/providers', providersRoutes)

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default router

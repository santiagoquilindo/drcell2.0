import { Router } from 'express';
import productRoutes from './product.routes.js';
const router = Router();
router.use('/products', productRoutes);
router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
export default router;

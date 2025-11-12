import { env } from '../config/env.js';
export const requireAdmin = (req, res, next) => {
    if (!env.ADMIN_API_KEY) {
        return res.status(500).json({ message: 'ADMIN_API_KEY not configured' });
    }
    let token = null;
    const apiKeyHeader = req.header('x-api-key');
    if (apiKeyHeader) {
        token = apiKeyHeader.trim();
    }
    else {
        const auth = req.header('authorization');
        if (auth && auth.toLowerCase().startsWith('bearer ')) {
            token = auth.slice(7).trim();
        }
    }
    if (token !== env.ADMIN_API_KEY) {
        return res.status(401).json({ message: 'Acceso no autorizado' });
    }
    next();
};

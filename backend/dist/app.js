import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import routes from './routes/index.js';
export function createApp() {
    const app = express();
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ??
        ['http://localhost:5173'];
    const corsOptions = {
        origin: allowedOrigins,
        credentials: true,
    };
    app.use(cors(corsOptions));
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: false }));
    app.use('/api', routes);
    app.use((err, _req, res, _next) => {
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Datos invalidos', issues: err.errors });
        }
        if (err instanceof Error && err.message === 'Origin not allowed') {
            return res.status(403).json({ message: 'Origen no permitido' });
        }
        console.error(err);
        res.status(500).json({ message: 'Error interno del servidor' });
    });
    return app;
}

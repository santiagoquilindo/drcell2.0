import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';
async function start() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Conexión a PostgreSQL exitosa');
    }
    catch (error) {
        console.error('❌ Error al conectar con PostgreSQL', error);
        process.exit(1);
    }
    const app = createApp();
    app.listen(env.PORT, () => {
        console.log(`🚀 Backend escuchando en http://localhost:${env.PORT}`);
    });
}
start().catch((error) => {
    console.error('❌ No fue posible iniciar el servidor', error);
    process.exit(1);
});

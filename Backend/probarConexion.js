
require('dotenv').config();

const pool = require('./src/database/conexion');

async function probarConexion() {
    try {
        const resultado = await pool.query('SELECT NOW()');

        console.log('¡Conexión exitosa con PostgreSQL!');
        console.log('Fecha y hora del servidor:', resultado.rows[0].now);
    } catch (error) {
        console.error('Error al conectar con PostgreSQL:', error.message);
    } finally {
        await pool.end();
    }
}

probarConexion();

const pool = require('../database/conexion');

async function obtenerFechaBaseDatos() {
    try {
        const resultado = await pool.query('SELECT NOW()');

        return resultado.rows[0].now;
    } catch (error) {
        console.error('Error al obtener la fecha de la base de datos:', error.message);
        throw error;
    }
}

module.exports = {
    obtenerFechaBaseDatos,
};

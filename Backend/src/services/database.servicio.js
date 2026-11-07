const pool = require('../database/conexion');

async function obtenerFechaBaseDatos() {
  const resultado = await pool.query('SELECT NOW()');

  return resultado.rows[0].now;
}

module.exports = {
  obtenerFechaBaseDatos,
};

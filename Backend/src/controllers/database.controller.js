const databaseService = require('../services/database.servicio');

async function consultarFecha(req, res) {
  const fecha = await databaseService.obtenerFechaBaseDatos();

  res.json({
    mensaje: 'Conexión con PostgreSQL exitosa',
    fecha,
  });
}

module.exports = {
  consultarFecha,
};

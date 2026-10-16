const databaseService = require('../services/database.servicio');

async function consultarFecha(req, res) {
    try {
        const fecha = await databaseService.obtenerFechaBaseDatos();

        res.json({
            mensaje: 'Conexión con PostgreSQL exitosa',
            fecha,
        });
    } catch (error) {
        console.error('Error en el controlador de base de datos:', error.message);

        res.status(500).json({
            mensaje: 'No fue posible consultar la base de datos',
        });
    }
}

module.exports = {
    consultarFecha,
};
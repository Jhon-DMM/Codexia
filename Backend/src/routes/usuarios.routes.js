const express = require('express');

const usuariosController = require('../controllers/usuarios.controller');
const requerirAutenticacion = require('../middleware/autenticacion');

const router = express.Router();

router.post('/registro', usuariosController.registrarUsuario);
router.post('/login', usuariosController.iniciarSesion);
router.post('/logout', requerirAutenticacion, usuariosController.cerrarSesion);
router.get('/me', requerirAutenticacion, usuariosController.obtenerMiCuenta);
router.patch('/me', requerirAutenticacion, usuariosController.actualizarMiNombre);
router.delete('/me', requerirAutenticacion, usuariosController.eliminarMiCuenta);
router.get('/me/cuota', requerirAutenticacion, usuariosController.obtenerMiCuota);
router.get('/me/estadisticas', requerirAutenticacion, usuariosController.obtenerEstadisticasMiCuenta);

module.exports = router;

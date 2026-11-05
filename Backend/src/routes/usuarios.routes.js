const express = require('express');

const usuariosController = require('../controllers/usuarios.controller');
const requerirAutenticacion = require('../middleware/autenticacion');
const soporteController = require('../controllers/soporte.controller');

const router = express.Router();

router.post('/registro', usuariosController.registrarUsuario);
router.post('/registro/verificar-correo', usuariosController.verificarCorreoRegistro);
router.post('/registro/reenviar-codigo', usuariosController.reenviarCodigoRegistro);
router.post('/login', usuariosController.iniciarSesion);
router.post('/logout', requerirAutenticacion, usuariosController.cerrarSesion);
router.get('/me', requerirAutenticacion, usuariosController.obtenerMiCuenta);
router.patch('/me', requerirAutenticacion, usuariosController.actualizarMiNombre);
router.delete('/me', requerirAutenticacion, usuariosController.eliminarMiCuenta);
router.get('/me/cuota', requerirAutenticacion, usuariosController.obtenerMiCuota);
router.get(
  '/me/estadisticas',
  requerirAutenticacion,
  usuariosController.obtenerEstadisticasMiCuenta,
);
router.get('/me/soporte', requerirAutenticacion, soporteController.listarMias);
router.post('/me/soporte', requerirAutenticacion, soporteController.crear);
router.get(
  '/me/eliminacion-programada',
  requerirAutenticacion,
  usuariosController.obtenerMiEliminacionProgramada,
);

module.exports = router;

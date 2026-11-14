const express = require('express');
const adminController = require('../controllers/admin.controller');
const requerirAutenticacion = require('../middleware/autenticacion');
const requerirAdmin = require('../middleware/admin');
const requerirSuperadmin = require('../middleware/superadmin');

const router = express.Router();
router.use(requerirAutenticacion, requerirAdmin);
router.get('/me', adminController.miAcceso);
router.get('/resumen', adminController.resumen);
router.get('/clientes', adminController.clientes);
router.get('/eliminaciones', adminController.listarEliminaciones);
router.post('/eliminaciones', adminController.programarEliminacion);
router.delete('/eliminaciones/:id', adminController.cancelarEliminacion);
router.post('/verificar-password', adminController.verificarPasswordAdmin);
router.patch('/clientes/:id/estado', adminController.actualizarEstadoCliente);
router.get('/roles/cuentas', requerirSuperadmin, adminController.listarCuentasConRol);
router.patch('/roles/cuentas/:id', requerirSuperadmin, adminController.cambiarRolCuenta);
router.get('/auditoria', adminController.auditoria);
router.get('/salud', adminController.salud);
router.get('/soporte', adminController.solicitudesSoporte);
router.patch('/soporte/:id', adminController.responderSoporte);

module.exports = router;

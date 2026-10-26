const express = require('express');
const asistenteController = require('../controllers/asistente.controller');
const requerirAutenticacion = require('../middleware/autenticacion');

const router = express.Router();

router.use(requerirAutenticacion);
router.post('/conversaciones', asistenteController.crearConversacion);
router.get('/conversaciones', asistenteController.listarConversaciones);
router.patch('/conversaciones/:id', asistenteController.renombrarConversacion);
router.patch('/conversaciones/:id/fijar', asistenteController.fijarConversacion);
router.delete('/conversaciones/:id', asistenteController.eliminarConversacion);
router.get('/conversaciones/:id', asistenteController.obtenerConversacion);
router.post('/', asistenteController.procesarMensaje);

module.exports = router;

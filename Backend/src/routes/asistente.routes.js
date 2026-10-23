const express = require('express');
const asistenteController = require('../controllers/asistente.controller');
const requerirAutenticacion = require('../middleware/autenticacion');

const router = express.Router();

router.use(requerirAutenticacion);
router.post('/conversaciones', asistenteController.crearConversacion);
router.get('/conversaciones', asistenteController.listarConversaciones);
router.get('/conversaciones/:id', asistenteController.obtenerConversacion);
router.post('/', asistenteController.procesarMensaje);

module.exports = router;

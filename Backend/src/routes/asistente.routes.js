const express = require('express');
const asistenteController = require('../controllers/asistente.controller');

const router = express.Router();

router.post('/asistente', asistenteController.procesarMensaje);
router.post('/asistente/reiniciar', asistenteController.reiniciarConversacion);

module.exports = router;

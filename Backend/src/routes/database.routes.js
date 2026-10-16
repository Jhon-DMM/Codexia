const express = require('express');
const databaseController = require('../controllers/database.controller');

const router = express.Router();

router.get('/fecha', databaseController.consultarFecha);

module.exports = router;
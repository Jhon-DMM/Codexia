require('dotenv').config();

const express = require('express');
const cors = require('cors');

const asistenteRoutes = require('./routes/asistente.routes');
const databaseRoutes = require('./routes/database.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(asistenteRoutes);

app.use('/api/database', databaseRoutes);
app.use('/api/usuarios', usuariosRoutes);

module.exports = app;

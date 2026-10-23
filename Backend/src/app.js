require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const asistenteRoutes = require('./routes/asistente.routes');
const databaseRoutes = require('./routes/database.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

const origenesPermitidos = (process.env.FRONTEND_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((origen) => origen.trim());

app.use(cors({ origin: (origen, callback) => {
  if (!origen || origenesPermitidos.includes(origen)) return callback(null, true);
  const error = new Error('Origen no permitido por CORS');
  error.status = 403;
  return callback(error);
}, credentials: true }));
app.use(express.json({ limit: '32kb' }));

app.use('/api/asistente', asistenteRoutes);

app.use('/api/database', databaseRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use(express.static(path.join(__dirname, '../../Frontend')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Error en la solicitud:', error.message);
  const status = error.status || 500;
  return res.status(status).json({
    mensaje: status === 413 ? 'La solicitud es demasiado grande' : 'No fue posible completar la solicitud',
  });
});

module.exports = app;

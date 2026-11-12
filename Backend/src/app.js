require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const asistenteRoutes = require('./routes/asistente.routes');
const databaseRoutes = require('./routes/database.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const adminRoutes = require('./routes/admin.routes');
const identificarSolicitud = require('./middleware/identificador-solicitud');
const { manejadorErrores } = require('./middleware/manejador-errores');

const app = express();

const saltosProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
app.set('trust proxy', saltosProxy);
app.use(identificarSolicitud);

const esProduccion = process.env.NODE_ENV === 'production';
const origenesPredeterminados = esProduccion
  ? []
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
const origenesConfigurados = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
const origenesPermitidos = new Set([...origenesPredeterminados, ...origenesConfigurados]);

function esOrigenLocal(origen) {
  if (esProduccion) return false;
  try {
    const url = new URL(origen);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    );
  } catch (error) {
    return false;
  }
}

app.use(
  '/api',
  cors({
    origin: (origen, callback) => {
      if (!origen || origenesPermitidos.has(origen) || esOrigenLocal(origen))
        return callback(null, true);
      const error = new Error(`Origen no permitido por CORS: ${origen}`);
      error.status = 403;
      error.codigoPublico = 'ORIGEN_NO_PERMITIDO';
      error.exponer = false;
      return callback(error);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.use('/api/asistente', asistenteRoutes);

app.use('/api/database', databaseRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res, next) => {
  const error = new Error('Ruta de API no encontrada');
  error.status = 404;
  error.codigoPublico = 'RUTA_NO_ENCONTRADA';
  error.mensajePublico = 'La ruta solicitada no existe.';
  next(error);
});
// Servir el frontend únicamente en producción
if (process.env.NODE_ENV === 'production') {
  const frontendConstruido = path.join(__dirname, '../../Frontend/dist');
  app.use(express.static(frontendConstruido));
}

app.use(manejadorErrores);

module.exports = app;

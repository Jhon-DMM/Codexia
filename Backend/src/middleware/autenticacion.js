const usuariosService = require('../services/usuarios.servicio');
const { obtenerTokenSesion } = require('../config/sesion.config');

async function requerirAutenticacion(req, res, next) {
  const token = obtenerTokenSesion(req);

  if (!token) {
    return res.status(401).json({ mensaje: 'Inicia sesión para continuar' });
  }

  try {
    const usuario = await usuariosService.obtenerUsuarioPorToken(token);
    if (!usuario) return res.status(401).json({ mensaje: 'Tu sesión venció. Inicia sesión de nuevo.' });
    req.usuario = usuario;
    req.tokenSesion = token;
    return next();
  } catch (error) {
    console.error('Error al validar la sesión:', error.message);
    return res.status(500).json({ mensaje: 'No fue posible validar la sesión' });
  }
}

module.exports = requerirAutenticacion;

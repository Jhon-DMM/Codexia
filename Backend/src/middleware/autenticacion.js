const usuariosService = require('../services/usuarios.servicio');
const { obtenerTokenSesion, COOKIE_NAME, opcionesCookie } = require('../config/sesion.config');
const {
  MENSAJE_PILOTO_FINALIZADO,
  PILOTO_ACTIVO,
  pilotoFinalizado,
} = require('../config/piloto.config');

async function requerirAutenticacion(req, res, next) {
  const token = obtenerTokenSesion(req);

  if (!token) {
    return res.status(401).json({ mensaje: 'Inicia sesión para continuar' });
  }

  try {
    const usuario = await usuariosService.obtenerUsuarioPorToken(token);
    if (!usuario)
      return res.status(401).json({ mensaje: 'Tu sesión venció. Inicia sesión de nuevo.' });
    if (usuario.estado === 'suspendido') {
      await usuariosService.cerrarSesion(token);
      const { maxAge, ...opcionesBorrado } = opcionesCookie();
      res.clearCookie(COOKIE_NAME, opcionesBorrado);
      return res.status(403).json({
        codigo: 'CUENTA_SUSPENDIDA',
        mensaje: 'Esta cuenta está suspendida. Contacta con soporte.',
      });
    }
    if (PILOTO_ACTIVO && usuario.rol !== 'admin' && pilotoFinalizado(usuario.piloto_inicio_en)) {
      await usuariosService.eliminarDatosPilotoUsuario(usuario.id);
      const { maxAge, ...opcionesBorrado } = opcionesCookie();
      res.clearCookie(COOKIE_NAME, opcionesBorrado);
      return res
        .status(410)
        .json({ codigo: 'PILOTO_FINALIZADO', mensaje: MENSAJE_PILOTO_FINALIZADO });
    }
    req.usuario = usuario;
    req.tokenSesion = token;
    return next();
  } catch (error) {
    console.error('Error al validar la sesión:', error.message);
    return res.status(500).json({ mensaje: 'No fue posible validar la sesión' });
  }
}

module.exports = requerirAutenticacion;

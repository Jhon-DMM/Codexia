function requerirAdmin(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.usuario?.rol)) {
    return res.status(403).json({ mensaje: 'No tienes permisos para acceder a esta sección' });
  }
  return next();
}

module.exports = requerirAdmin;

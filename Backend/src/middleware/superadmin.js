function requerirSuperadmin(req, res, next) {
  if (req.usuario?.rol !== 'superadmin') {
    return res.status(403).json({ mensaje: 'Solo el superadmin puede administrar roles.' });
  }
  return next();
}

module.exports = requerirSuperadmin;

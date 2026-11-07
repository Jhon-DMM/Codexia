const { randomUUID } = require('node:crypto');

function identificarSolicitud(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = identificarSolicitud;

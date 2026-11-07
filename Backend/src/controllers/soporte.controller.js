const soporteService = require('../services/soporte.servicio');

async function crear(req, res) {
  try {
    const solicitud = await soporteService.crearSolicitud(req.usuario.id, {
      ...(req.body || {}),
      evidencia: {
        aceptaPrivacidad: req.body?.aceptaPrivacidadSoporte === 'true',
        ip: req.ip || null,
        agenteUsuario: (req.get('user-agent') || '').slice(0, 512) || null,
      },
    });
    return res.status(201).json({ solicitud });
  } catch (error) {
    if (error.status && error.status < 500)
      return res.status(error.status).json({ mensaje: error.message });
    throw error;
  }
}

async function listarMias(req, res) {
  return res.json({ solicitudes: await soporteService.listarSolicitudesUsuario(req.usuario.id) });
}

module.exports = { crear, listarMias };

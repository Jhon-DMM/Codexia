const { obtenerEstado, registrarError } = require('../utils/registro-errores');

const CODIGOS_POR_ESTADO = {
  400: 'SOLICITUD_INVALIDA',
  401: 'NO_AUTENTICADO',
  403: 'NO_AUTORIZADO',
  404: 'NO_ENCONTRADO',
  409: 'CONFLICTO',
  410: 'RECURSO_VENCIDO',
  413: 'SOLICITUD_DEMASIADO_GRANDE',
  422: 'DATOS_INVALIDOS',
  429: 'LIMITE_ALCANZADO',
  502: 'SERVICIO_EXTERNO_ERROR',
  503: 'SERVICIO_NO_DISPONIBLE',
  504: 'TIEMPO_AGOTADO',
};

function mensajeSeguro(error, estado) {
  if (error?.type === 'entity.too.large' || estado === 413) {
    return 'La solicitud es demasiado grande.';
  }
  if (error?.type === 'entity.parse.failed') {
    return 'El formato de la solicitud no es válido.';
  }
  if (error?.codigoPublico === 'ORIGEN_NO_PERMITIDO') {
    return 'El origen de esta solicitud no está autorizado.';
  }
  if (typeof error?.mensajePublico === 'string') return error.mensajePublico;
  if (estado < 500 && error?.exponer !== false && typeof error?.message === 'string') {
    return error.message;
  }
  return 'No fue posible completar la solicitud. Inténtalo de nuevo.';
}

function manejadorErrores(error, req, res, next) {
  if (res.headersSent) return next(error);

  const estado = obtenerEstado(error);
  if (estado >= 500 || error?.registrar === true) {
    registrarError(error, { req, contexto: 'solicitud_http' });
  }

  return res.status(estado).json({
    codigo: error?.codigoPublico || CODIGOS_POR_ESTADO[estado] || 'ERROR_INTERNO',
    mensaje: mensajeSeguro(error, estado),
    requestId: req.id || null,
  });
}

module.exports = { manejadorErrores, mensajeSeguro };

function obtenerEstado(error) {
  const estado = Number(error?.status || error?.statusCode);
  return Number.isInteger(estado) && estado >= 400 && estado <= 599 ? estado : 500;
}

function registrarError(error, { req, requestId, contexto, nivel = 'error' } = {}) {
  const causa = error?.cause;
  const evento = {
    evento: 'error_aplicacion',
    requestId: requestId || req?.id || null,
    contexto: contexto || null,
    metodo: req?.method || null,
    ruta: req?.originalUrl?.split('?')[0] || req?.path || null,
    estado: obtenerEstado(error),
    tipo: error?.name || 'Error',
    codigo: typeof error?.code === 'string' ? error.code.slice(0, 80) : null,
    mensaje: typeof error?.message === 'string' ? error.message.slice(0, 400) : 'Error sin mensaje',
    traza: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 8).join('\n') : null,
    causaTipo: causa?.name || null,
    causaCodigo: typeof causa?.code === 'string' ? causa.code.slice(0, 80) : null,
    causaMensaje:
      typeof causa?.message === 'string' ? causa.message.slice(0, 400) : null,
    proveedorRequestId: causa?.requestID || error?.requestID || null,
    causaTraza:
      typeof causa?.stack === 'string' ? causa.stack.split('\n').slice(0, 5).join('\n') : null,
  };

  const escribir = nivel === 'warn' ? console.warn : console.error;
  escribir(`[Codexia] ${JSON.stringify(evento)}`);
}

module.exports = { obtenerEstado, registrarError };

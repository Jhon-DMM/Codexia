// Almacén en memoria para los historiales de conversación.
// Cada conversación se identifica por un conversationId (string).
// El valor es un array de mensajes con la forma { role, content }.
//
// NOTA: este almacén es volátil. Se borra al reiniciar el servidor.
// migrar este store a una base de datos... en algun momento

const conversaciones = new Map();

// Límite de mensajes que se mantienen por conversación para no
// exceder el contexto del modelo. Los mensajes más antiguos se descartan.
const MAX_MENSAJES = 20;

const obtenerConversacion = (conversationId) => {
  if (!conversaciones.has(conversationId)) {
    conversaciones.set(conversationId, {
      historial: [],
      mensajesCliente: new Map()
    });
  }

  return conversaciones.get(conversationId);
};

const recortarHistorial = (historial) => {
  if (historial.length > MAX_MENSAJES) {
    historial.splice(0, historial.length - MAX_MENSAJES);
  }
};

/**
 * Devuelve el historial de mensajes de una conversación.
 */
const obtenerHistorial = (conversationId) => {
  return obtenerConversacion(conversationId).historial;
};

/**
 * Recupera el estado de un mensaje del cliente para aplicar idempotencia.
 */
const obtenerRegistroMensaje = (conversationId, clientMessageId) => {
  if (!conversaciones.has(conversationId)) {
    return null;
  }

  return conversaciones.get(conversationId).mensajesCliente.get(clientMessageId) || null;
};

/**
 * Marca un mensaje como en proceso para que los reintentos reutilicen
 * la misma operación mientras la respuesta está en curso.
 */
const registrarMensajeEnProceso = (conversationId, clientMessageId, mensaje, promise) => {
  const conversacion = obtenerConversacion(conversationId);
  const registro = {
    status: 'processing',
    userMessage: mensaje,
    assistantMessage: null,
    promise
  };

  conversacion.mensajesCliente.set(clientMessageId, registro);
  return registro;
};

/**
 * Persiste el resultado final del mensaje y lo agrega al historial
 * de la conversación una sola vez.
 */
const completarMensaje = (conversationId, clientMessageId, mensaje, respuesta) => {
  const conversacion = obtenerConversacion(conversationId);
  const historial = conversacion.historial;
  const registro = conversacion.mensajesCliente.get(clientMessageId) || {};

  historial.push({ role: 'user', content: mensaje });
  historial.push({ role: 'assistant', content: respuesta });
  recortarHistorial(historial);

  conversacion.mensajesCliente.set(clientMessageId, {
    ...registro,
    status: 'completed',
    userMessage: mensaje,
    assistantMessage: respuesta,
    promise: null
  });

  return respuesta;
};

/**
 * Permite que un mensaje fallido pueda reintentarse con el mismo id.
 */
const marcarMensajeConError = (conversationId, clientMessageId) => {
  const conversacion = obtenerConversacion(conversationId);
  const registro = conversacion.mensajesCliente.get(clientMessageId);

  if (!registro) {
    return;
  }

  conversacion.mensajesCliente.set(clientMessageId, {
    ...registro,
    status: 'error',
    assistantMessage: null,
    promise: null
  });
};

/**
 * Elimina una conversación y su historial.
 */
const borrarConversacion = (conversationId) => {
  conversaciones.delete(conversationId);
};

module.exports = {
  obtenerHistorial,
  obtenerRegistroMensaje,
  registrarMensajeEnProceso,
  completarMensaje,
  marcarMensajeConError,
  borrarConversacion
};

const conversacionesService = require('../services/conversaciones.servicio');
const { mensajeSeguro } = require('../middleware/manejador-errores');
const { obtenerEstado, registrarError } = require('../utils/registro-errores');

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validarIdConversacion = (id, res) => {
  if (UUID_VALIDO.test(id || '')) return true;
  res.status(400).json({ mensaje: 'La conversación indicada no es válida' });
  return false;
};

const procesarMensaje = async (req, res) => {
  const { mensaje, conversationId, clientMessageId } = req.body || {};
  const parametros = {
    usuarioId: req.usuario.id,
    conversacionId: conversationId,
    clientMessageId,
    mensaje,
    requestId: req.id,
  };

  if (req.get('accept')?.includes('text/event-stream')) {
    return procesarMensajeEnFlujo(req, res, parametros);
  }

  const resultado = await conversacionesService.procesarMensaje({
    ...parametros,
  });

  if (resultado.limiteAlcanzado) {
    return res.status(429).json({
      mensaje: `Has alcanzado tu límite de ${resultado.cuota.limite} mensajes diarios. Podrás volver a escribir mañana.`,
      cuota: resultado.cuota,
    });
  }
  if (resultado.procesando) {
    return res.status(202).json({ estado: 'procesando', cuota: resultado.cuota });
  }

  return res.json({
    conversationId,
    mensaje: resultado.mensaje,
    cuota: resultado.cuota,
    tituloPendiente: resultado.tituloPendiente || false,
  });
};

async function procesarMensajeEnFlujo(req, res, parametros) {
  const cancelacion = new AbortController();
  let flujoIniciado = false;

  const cancelarSiSeDesconecta = () => {
    if (!res.writableEnded) cancelacion.abort();
  };

  res.once('close', cancelarSiSeDesconecta);

  try {
    const resultado = await conversacionesService.procesarMensaje({
      ...parametros,
      signal: cancelacion.signal,
      onToken: async (texto) => {
        if (res.destroyed || !res.writable) throw new Error('El cliente cerró la conexión');

        if (!flujoIniciado) {
          res.status(200);
          res.set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.flushHeaders();
          flujoIniciado = true;
        }

        res.write(`event: token\ndata: ${JSON.stringify({ texto })}\n\n`);
      },
    });

    if (resultado.limiteAlcanzado) {
      return res.status(429).json({
        mensaje: `Has alcanzado tu límite de ${resultado.cuota.limite} mensajes diarios. Podrás volver a escribir mañana.`,
        cuota: resultado.cuota,
      });
    }
    if (resultado.procesando) {
      return res.status(202).json({ estado: 'procesando', cuota: resultado.cuota });
    }

    if (!flujoIniciado) {
      return res.json({
        conversationId: parametros.conversacionId,
        mensaje: resultado.mensaje,
        cuota: resultado.cuota,
        tituloPendiente: resultado.tituloPendiente || false,
      });
    }

    res.write(
      `event: fin\ndata: ${JSON.stringify({
        cuota: resultado.cuota,
        tituloPendiente: resultado.tituloPendiente || false,
      })}\n\n`,
    );
    return res.end();
  } catch (error) {
    if (cancelacion.signal.aborted || res.destroyed) return;
    if (!flujoIniciado) throw error;

    const estado = obtenerEstado(error);
    if (estado >= 500 || error.registrar === true) {
      registrarError(error, { req, contexto: 'flujo_respuesta_asistente' });
    }

    res.write(
      `event: error\ndata: ${JSON.stringify({
        codigo: error.codigoPublico || null,
        mensaje: mensajeSeguro(error, estado),
      })}\n\n`,
    );
    return res.end();
  } finally {
    res.off('close', cancelarSiSeDesconecta);
  }
}

const crearConversacion = async (req, res) => {
  const conversacion = await conversacionesService.crearConversacion(req.usuario.id);
  return res
    .status(201)
    .json({ conversationId: conversacion.id, creadaEn: conversacion.creada_en });
};

const listarConversaciones = async (req, res) => {
  const conversaciones = await conversacionesService.listarConversaciones(req.usuario.id);
  return res.json({ conversaciones });
};

const obtenerConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  let antesDeId = null;
  if (req.query.antesDe !== undefined) {
    if (!/^[1-9]\d*$/.test(req.query.antesDe || '')) {
      return res.status(400).json({ mensaje: 'El cursor de mensajes no es válido' });
    }
    antesDeId = Number(req.query.antesDe);
    if (!Number.isSafeInteger(antesDeId)) {
      return res.status(400).json({ mensaje: 'El cursor de mensajes no es válido' });
    }
  }
  const conversacion = await conversacionesService.obtenerConversacion(
    req.usuario.id,
    req.params.id,
    { antesDeId },
  );
  if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
  return res.json({ conversacion });
};

const renombrarConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  try {
    const conversacion = await conversacionesService.renombrarConversacion(
      req.usuario.id,
      req.params.id,
      req.body?.titulo,
    );
    if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
    return res.json({ conversacion });
  } catch (error) {
    if (error.status && error.status < 500)
      return res.status(error.status).json({ mensaje: error.message });
    throw error;
  }
};

const fijarConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  try {
    const conversacion = await conversacionesService.fijarConversacion(
      req.usuario.id,
      req.params.id,
      req.body?.fijada,
    );
    if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
    return res.json({ conversacion });
  } catch (error) {
    if (error.status && error.status < 500)
      return res.status(error.status).json({ mensaje: error.message });
    throw error;
  }
};

const eliminarConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  const eliminada = await conversacionesService.eliminarConversacion(req.usuario.id, req.params.id);
  if (!eliminada) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
  return res.status(204).end();
};

const eliminarTodasLasConversaciones = async (req, res) => {
  const eliminadas = await conversacionesService.eliminarTodasLasConversaciones(req.usuario.id);
  return res.json({ eliminadas });
};

module.exports = {
  procesarMensaje,
  crearConversacion,
  listarConversaciones,
  obtenerConversacion,
  renombrarConversacion,
  fijarConversacion,
  eliminarConversacion,
  eliminarTodasLasConversaciones,
};

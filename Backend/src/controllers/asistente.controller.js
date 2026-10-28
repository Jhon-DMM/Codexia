const conversacionesService = require('../services/conversaciones.servicio');

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validarIdConversacion = (id, res) => {
  if (UUID_VALIDO.test(id || '')) return true;
  res.status(400).json({ mensaje: 'La conversación indicada no es válida' });
  return false;
};

const procesarMensaje = async (req, res) => {
  try {
    const { mensaje, conversationId, clientMessageId } = req.body || {};
    const resultado = await conversacionesService.procesarMensaje({
      usuarioId: req.usuario.id,
      conversacionId: conversationId,
      clientMessageId,
      mensaje,
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

    return res.json({ conversationId, mensaje: resultado.mensaje, cuota: resultado.cuota });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    console.error('Error en el controlador de asistente:', error.message);
    return res.status(500).json({ mensaje: 'No fue posible procesar el mensaje' });
  }
};

const crearConversacion = async (req, res) => {
  const conversacion = await conversacionesService.crearConversacion(req.usuario.id);
  return res.status(201).json({ conversationId: conversacion.id, creadaEn: conversacion.creada_en });
};

const listarConversaciones = async (req, res) => {
  const conversaciones = await conversacionesService.listarConversaciones(req.usuario.id);
  return res.json({ conversaciones });
};

const obtenerConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  const conversacion = await conversacionesService.obtenerConversacion(req.usuario.id, req.params.id);
  if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
  return res.json({ conversacion });
};

const renombrarConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  try {
    const conversacion = await conversacionesService.renombrarConversacion(req.usuario.id, req.params.id, req.body?.titulo);
    if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
    return res.json({ conversacion });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
    throw error;
  }
};

const fijarConversacion = async (req, res) => {
  if (!validarIdConversacion(req.params.id, res)) return;
  try {
    const conversacion = await conversacionesService.fijarConversacion(req.usuario.id, req.params.id, req.body?.fijada);
    if (!conversacion) return res.status(404).json({ mensaje: 'No encontramos esa conversación' });
    return res.json({ conversacion });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ mensaje: error.message });
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

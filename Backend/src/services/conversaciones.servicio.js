const { randomUUID } = require('crypto');
const pool = require('../database/conexion');
const asistenteService = require('./asistente.servicio');

const MAX_CARACTERES_MENSAJE = 4000;
const MAX_MENSAJES_CONTEXTO = 20;
const LIMITE_CONFIGURADO = Number(process.env.ASISTENTE_LIMITE_DIARIO);
const LIMITE_DIARIO = Number.isInteger(LIMITE_CONFIGURADO) && LIMITE_CONFIGURADO > 0
  ? LIMITE_CONFIGURADO
  : 30;

async function crearConversacion(usuarioId) {
  const resultado = await pool.query(
    `INSERT INTO conversaciones (id, usuario_id)
     VALUES ($1, $2)
     RETURNING id, creada_en`,
    [randomUUID(), usuarioId]
  );
  return resultado.rows[0];
}

async function listarConversaciones(usuarioId) {
  const resultado = await pool.query(
    `SELECT c.id, c.titulo, c.creada_en, c.actualizada_en,
            (SELECT COUNT(*)::integer FROM chats m WHERE m.conversacion_id = c.id) AS cantidad_mensajes
     FROM conversaciones c
     WHERE c.usuario_id = $1
     ORDER BY c.actualizada_en DESC, c.id DESC`,
    [usuarioId]
  );
  return resultado.rows;
}

async function obtenerConversacion(usuarioId, conversacionId) {
  const cliente = await pool.connect();
  try {
    const resultado = await cliente.query(
      `SELECT id, creada_en FROM conversaciones
       WHERE id = $1 AND usuario_id = $2`,
      [conversacionId, usuarioId]
    );
    if (!resultado.rowCount) return null;

    const mensajes = await cliente.query(
      `SELECT id, rol, contenido, client_message_id, creado_en
       FROM chats WHERE conversacion_id = $1 ORDER BY id`,
      [conversacionId]
    );
    return { ...resultado.rows[0], mensajes: mensajes.rows };
  } finally {
    cliente.release();
  }
}

async function obtenerCuotaTransaccion(cliente, usuarioId) {
  const resultado = await cliente.query(
    `SELECT cantidad FROM uso_asistente
     WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
    [usuarioId]
  );
  const usado = resultado.rows[0]?.cantidad || 0;
  return { usado, limite: LIMITE_DIARIO, restante: Math.max(0, LIMITE_DIARIO - usado) };
}

async function procesarMensaje({ usuarioId, conversacionId, clientMessageId, mensaje }) {
  if (typeof mensaje !== 'string' || !mensaje.trim()) {
    const error = new Error('Escribe un mensaje antes de enviarlo');
    error.status = 400;
    throw error;
  }
  if (mensaje.length > MAX_CARACTERES_MENSAJE) {
    const error = new Error(`El mensaje no puede superar ${MAX_CARACTERES_MENSAJE} caracteres`);
    error.status = 400;
    throw error;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversacionId || '')) {
    const error = new Error('La conversación indicada no es válida');
    error.status = 400;
    throw error;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientMessageId || '')) {
    const error = new Error('El identificador del mensaje no es válido');
    error.status = 400;
    throw error;
  }

  const cliente = await pool.connect();
  let cuotaReservada = false;
  let fechaCuotaReservada = null;
  let historial = [];
  let cuota = null;

  try {
    await cliente.query('BEGIN');
    const conversacion = await cliente.query(
      `SELECT id FROM conversaciones
       WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [conversacionId, usuarioId]
    );
    if (!conversacion.rowCount) {
      const error = new Error('No encontramos esa conversación');
      error.status = 404;
      throw error;
    }

    const mensajePrevio = await cliente.query(
      `SELECT id FROM chats
       WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'usuario'`,
      [conversacionId, clientMessageId]
    );
    if (mensajePrevio.rowCount) {
      const respuestaPrevia = await cliente.query(
        `SELECT contenido FROM chats
         WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'asistente'`,
        [conversacionId, clientMessageId]
      );
      cuota = await obtenerCuotaTransaccion(cliente, usuarioId);
      await cliente.query('COMMIT');
      return respuestaPrevia.rowCount
        ? { mensaje: respuestaPrevia.rows[0].contenido, cuota, repetido: true }
        : { procesando: true, cuota };
    }

    const mensajesPrevios = await cliente.query(
      `SELECT rol, contenido FROM chats
       WHERE conversacion_id = $1 ORDER BY id DESC LIMIT $2`,
      [conversacionId, MAX_MENSAJES_CONTEXTO]
    );
    historial = mensajesPrevios.rows.reverse().map(({ rol, contenido }) => ({
      role: rol === 'usuario' ? 'user' : 'assistant',
      content: contenido,
    }));

    const reserva = await cliente.query(
      `INSERT INTO uso_asistente (usuario_id, fecha, cantidad)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (usuario_id, fecha) DO UPDATE
       SET cantidad = uso_asistente.cantidad + 1
       WHERE uso_asistente.cantidad < $2
       RETURNING cantidad, fecha`,
      [usuarioId, LIMITE_DIARIO]
    );
    if (!reserva.rowCount) {
      cuota = await obtenerCuotaTransaccion(cliente, usuarioId);
      await cliente.query('ROLLBACK');
      return { limiteAlcanzado: true, cuota };
    }

    cuotaReservada = true;
    fechaCuotaReservada = reserva.rows[0].fecha;
    cuota = { usado: reserva.rows[0].cantidad, limite: LIMITE_DIARIO, restante: LIMITE_DIARIO - reserva.rows[0].cantidad };
    await cliente.query(
      `INSERT INTO chats (conversacion_id, rol, contenido, client_message_id)
       VALUES ($1, 'usuario', $2, $3)`,
      [conversacionId, mensaje.trim(), clientMessageId]
    );
    await cliente.query(
      `UPDATE conversaciones
       SET titulo = CASE WHEN titulo = 'Nueva conversación' THEN LEFT($2, 120) ELSE titulo END,
           actualizada_en = NOW()
       WHERE id = $1`,
      [conversacionId, mensaje.trim()]
    );
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }

  try {
    const respuesta = await asistenteService.obtenerRespuestaGroq(mensaje.trim(), historial);
    await pool.query(
      `INSERT INTO chats (conversacion_id, rol, contenido, client_message_id)
       VALUES ($1, 'asistente', $2, $3)`,
      [conversacionId, respuesta, clientMessageId]
    );
    await pool.query('UPDATE conversaciones SET actualizada_en = NOW() WHERE id = $1', [conversacionId]);
    return { mensaje: respuesta, cuota };
  } catch (error) {
    if (cuotaReservada) {
      const clienteReembolso = await pool.connect();
      try {
        await clienteReembolso.query('BEGIN');
        await clienteReembolso.query(
          `DELETE FROM chats
           WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'usuario'`,
          [conversacionId, clientMessageId]
        );
        await clienteReembolso.query(
          `UPDATE uso_asistente SET cantidad = GREATEST(0, cantidad - 1)
           WHERE usuario_id = $1 AND fecha = $2`,
          [usuarioId, fechaCuotaReservada]
        );
        await clienteReembolso.query('COMMIT');
      } catch (errorReembolso) {
        await clienteReembolso.query('ROLLBACK').catch(() => {});
        console.error('No se pudo devolver la cuota del mensaje fallido:', errorReembolso.message);
      } finally {
        clienteReembolso.release();
      }
    }
    throw error;
  }
}

module.exports = { crearConversacion, listarConversaciones, obtenerConversacion, procesarMensaje, LIMITE_DIARIO };

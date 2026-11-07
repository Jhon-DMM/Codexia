const { randomUUID } = require('crypto');
const pool = require('../database/conexion');
const asistenteService = require('./asistente.servicio');
const { registrarError } = require('../utils/registro-errores');

const MAX_CARACTERES_MENSAJE = 4000;
const MAX_MENSAJES_CONTEXTO = 20;
const MENSAJES_POR_RESUMEN = 20;
const MAX_LOTES_RESUMEN_POR_TRABAJO = 3;
const MENSAJES_POR_PAGINA = 50;
const trabajosResumen = new Map();
const LIMITE_CONFIGURADO = Number(process.env.ASISTENTE_LIMITE_DIARIO);
const LIMITE_DIARIO =
  Number.isInteger(LIMITE_CONFIGURADO) && LIMITE_CONFIGURADO > 0 ? LIMITE_CONFIGURADO : 30;

function crearTituloAlternativo(consulta) {
  const palabras = String(consulta || '')
    .normalize('NFC')
    .replace(
      /^(?:hola[,:]?\s+)?(?:por favor\s+)?(?:me gustaría que|me gustaria que|quisiera que|quiero que|puedes|podrías|podrias|ayúdame a|ayudame a|necesito que|necesito|deseo que|haz que)\s+/i,
      '',
    )
    .split(/\s+/)
    .map((palabra) => palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const titulo = palabras
    .slice(0, 6)
    .join(' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!titulo) return 'Nueva conversación';
  const breve =
    titulo.length <= 60
      ? titulo
      : titulo
          .slice(0, 60)
          .replace(/\s+\S*$/, '')
          .trim();
  return breve.charAt(0).toLocaleUpperCase('es') + breve.slice(1);
}

async function completarTituloConversacion(conversacionId, consulta, requestId) {
  let titulo;

  try {
    titulo = await asistenteService.generarTituloConversacion(consulta);
  } catch (error) {
    registrarError(error, {
      requestId,
      contexto: 'generacion_titulo_conversacion',
      nivel: 'warn',
    });
    titulo = crearTituloAlternativo(consulta);
  }

  try {
    await pool.query(
      `UPDATE conversaciones
       SET titulo = CASE WHEN titulo = 'Nueva conversación' THEN $2 ELSE titulo END,
           actualizada_en = NOW()
       WHERE id = $1`,
      [conversacionId, titulo],
    );
  } catch (error) {
    registrarError(error, {
      requestId,
      contexto: 'guardar_titulo_conversacion',
    });
  }
}

async function actualizarResumenConversacion(usuarioId, conversacionId, requestId) {
  for (let lote = 0; lote < MAX_LOTES_RESUMEN_POR_TRABAJO; lote += 1) {
    const conversacion = await pool.query(
      `SELECT resumen_contexto, resumen_hasta_chat_id
       FROM conversaciones
       WHERE id = $1 AND usuario_id = $2`,
      [conversacionId, usuarioId],
    );
    if (!conversacion.rowCount) return;

    const { resumen_contexto: resumenPrevio, resumen_hasta_chat_id: cursor } =
      conversacion.rows[0];
    // El OFFSET deja fuera los 20 mensajes recientes que se envían completos a Groq.
    const corte = await pool.query(
      `SELECT id
       FROM chats
       WHERE conversacion_id = $1
       ORDER BY id DESC
       OFFSET $2 LIMIT 1`,
      [conversacionId, MAX_MENSAJES_CONTEXTO],
    );
    if (!corte.rowCount || (cursor !== null && cursor >= corte.rows[0].id)) return;

    const mensajes = await pool.query(
      `SELECT id, rol, contenido
       FROM chats
       WHERE conversacion_id = $1
         AND ($2::integer IS NULL OR id > $2)
         AND id <= $3
       ORDER BY id ASC
       LIMIT $4`,
      [conversacionId, cursor, corte.rows[0].id, MENSAJES_POR_RESUMEN],
    );
    if (!mensajes.rowCount) return;

    const resumen = await asistenteService.generarResumenConversacion(
      resumenPrevio,
      mensajes.rows,
    );
    const nuevoCursor = mensajes.rows[mensajes.rows.length - 1].id;
    await pool.query(
      `UPDATE conversaciones
       SET resumen_contexto = $3, resumen_hasta_chat_id = $4
       WHERE id = $1 AND usuario_id = $2
         AND resumen_hasta_chat_id IS NOT DISTINCT FROM $5`,
      [conversacionId, usuarioId, resumen, nuevoCursor, cursor],
    );

    if (mensajes.rowCount < MENSAJES_POR_RESUMEN) return;
  }
}

function programarResumenConversacion(usuarioId, conversacionId, requestId) {
  const clave = `${usuarioId}:${conversacionId}`;
  const anterior = trabajosResumen.get(clave) || Promise.resolve();
  const trabajo = anterior
    .catch(() => {})
    .then(() => actualizarResumenConversacion(usuarioId, conversacionId, requestId))
    .catch((error) => {
      registrarError(error, {
        requestId,
        contexto: 'generacion_resumen_conversacion',
        nivel: 'warn',
      });
    });

  trabajosResumen.set(clave, trabajo);
  void trabajo.then(() => {
    if (trabajosResumen.get(clave) === trabajo) trabajosResumen.delete(clave);
  });
  return trabajo;
}

async function crearConversacion(usuarioId) {
  const resultado = await pool.query(
    `INSERT INTO conversaciones (id, usuario_id)
     VALUES ($1, $2)
     RETURNING id, creada_en`,
    [randomUUID(), usuarioId],
  );
  return resultado.rows[0];
}

async function listarConversaciones(usuarioId) {
  const resultado = await pool.query(
    `SELECT c.id, c.titulo, c.fijada, c.creada_en, c.actualizada_en,
            (SELECT COUNT(*)::integer FROM chats m WHERE m.conversacion_id = c.id) AS cantidad_mensajes
     FROM conversaciones c
     WHERE c.usuario_id = $1
     ORDER BY c.fijada DESC, c.actualizada_en DESC, c.id DESC`,
    [usuarioId],
  );
  return resultado.rows;
}

async function renombrarConversacion(usuarioId, conversacionId, titulo) {
  const nombre = typeof titulo === 'string' ? titulo.trim() : '';
  if (!nombre || nombre.length > 120) {
    const error = new Error('El nombre debe tener entre 1 y 120 caracteres');
    error.status = 400;
    throw error;
  }
  const resultado = await pool.query(
    `UPDATE conversaciones SET titulo = $3
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, titulo, fijada`,
    [conversacionId, usuarioId, nombre],
  );
  return resultado.rows[0] || null;
}

async function fijarConversacion(usuarioId, conversacionId, fijada) {
  if (typeof fijada !== 'boolean') {
    const error = new Error('El estado de fijado no es válido');
    error.status = 400;
    throw error;
  }
  const resultado = await pool.query(
    `UPDATE conversaciones SET fijada = $3
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, titulo, fijada`,
    [conversacionId, usuarioId, fijada],
  );
  return resultado.rows[0] || null;
}

async function eliminarConversacion(usuarioId, conversacionId) {
  const resultado = await pool.query(
    `DELETE FROM conversaciones WHERE id = $1 AND usuario_id = $2 RETURNING id`,
    [conversacionId, usuarioId],
  );
  return Boolean(resultado.rowCount);
}

async function eliminarTodasLasConversaciones(usuarioId) {
  const resultado = await pool.query('DELETE FROM conversaciones WHERE usuario_id = $1', [
    usuarioId,
  ]);
  return resultado.rowCount;
}

async function obtenerConversacion(usuarioId, conversacionId, { antesDeId = null } = {}) {
  const cliente = await pool.connect();
  try {
    const resultado = await cliente.query(
      `SELECT id, creada_en FROM conversaciones
       WHERE id = $1 AND usuario_id = $2`,
      [conversacionId, usuarioId],
    );
    if (!resultado.rowCount) return null;

    const mensajes = antesDeId
      ? await cliente.query(
          `SELECT id, rol, contenido, client_message_id, creado_en
           FROM chats
           WHERE conversacion_id = $1 AND id < $2
           ORDER BY id DESC
           LIMIT $3`,
          [conversacionId, antesDeId, MENSAJES_POR_PAGINA + 1],
        )
      : await cliente.query(
          `SELECT id, rol, contenido, client_message_id, creado_en
           FROM chats
           WHERE conversacion_id = $1
           ORDER BY id DESC
           LIMIT $2`,
          [conversacionId, MENSAJES_POR_PAGINA + 1],
        );
    const hayMasMensajes = mensajes.rows.length > MENSAJES_POR_PAGINA;
    const pagina = mensajes.rows.slice(0, MENSAJES_POR_PAGINA).reverse();

    return {
      ...resultado.rows[0],
      mensajes: pagina,
      hayMasMensajes,
      cursorAnterior: hayMasMensajes ? pagina[0]?.id || null : null,
    };
  } finally {
    cliente.release();
  }
}

async function obtenerCuotaTransaccion(cliente, usuarioId) {
  const resultado = await cliente.query(
    `SELECT cantidad FROM uso_asistente
     WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
    [usuarioId],
  );
  const usado = resultado.rows[0]?.cantidad || 0;
  return { usado, limite: LIMITE_DIARIO, restante: Math.max(0, LIMITE_DIARIO - usado) };
}

async function procesarMensaje({
  usuarioId,
  conversacionId,
  clientMessageId,
  mensaje,
  requestId,
  signal,
  onToken,
}) {
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
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      conversacionId || '',
    )
  ) {
    const error = new Error('La conversación indicada no es válida');
    error.status = 400;
    throw error;
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientMessageId || '',
    )
  ) {
    const error = new Error('El identificador del mensaje no es válido');
    error.status = 400;
    throw error;
  }

  // No generamos resúmenes si el usuario ya agotó su cuota diaria.
  const usoActual = await pool.query(
    `SELECT cantidad FROM uso_asistente
     WHERE usuario_id = $1 AND fecha = CURRENT_DATE`,
    [usuarioId],
  );
  if ((usoActual.rows[0]?.cantidad || 0) < LIMITE_DIARIO) {
    await programarResumenConversacion(usuarioId, conversacionId, requestId);
  }

  const cliente = await pool.connect();
  let cuotaReservada = false;
  let fechaCuotaReservada = null;
  let historial = [];
  let resumenContexto = '';
  let cuota = null;
  let generarTitulo = false;

  try {
    await cliente.query('BEGIN');
    const conversacion = await cliente.query(
      `SELECT id, titulo, resumen_contexto FROM conversaciones
       WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [conversacionId, usuarioId],
    );
    if (!conversacion.rowCount) {
      const error = new Error('No encontramos esa conversación');
      error.status = 404;
      throw error;
    }
    const tituloPendiente = conversacion.rows[0].titulo === 'Nueva conversación';
    resumenContexto = conversacion.rows[0].resumen_contexto || '';

    const mensajePrevio = await cliente.query(
      `SELECT id FROM chats
       WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'usuario'`,
      [conversacionId, clientMessageId],
    );
    if (mensajePrevio.rowCount) {
      const respuestaPrevia = await cliente.query(
        `SELECT contenido FROM chats
         WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'asistente'`,
        [conversacionId, clientMessageId],
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
      [conversacionId, MAX_MENSAJES_CONTEXTO],
    );
    historial = mensajesPrevios.rows.reverse().map(({ rol, contenido }) => ({
      role: rol === 'usuario' ? 'user' : 'assistant',
      content: contenido,
    }));
    generarTitulo = tituloPendiente && historial.length === 0;

    const reserva = await cliente.query(
      `INSERT INTO uso_asistente (usuario_id, fecha, cantidad)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (usuario_id, fecha) DO UPDATE
       SET cantidad = uso_asistente.cantidad + 1
       WHERE uso_asistente.cantidad < $2
       RETURNING cantidad, fecha`,
      [usuarioId, LIMITE_DIARIO],
    );
    if (!reserva.rowCount) {
      cuota = await obtenerCuotaTransaccion(cliente, usuarioId);
      await cliente.query('ROLLBACK');
      return { limiteAlcanzado: true, cuota };
    }

    cuotaReservada = true;
    fechaCuotaReservada = reserva.rows[0].fecha;
    cuota = {
      usado: reserva.rows[0].cantidad,
      limite: LIMITE_DIARIO,
      restante: LIMITE_DIARIO - reserva.rows[0].cantidad,
    };
    await cliente.query(
      `INSERT INTO chats (conversacion_id, rol, contenido, client_message_id)
       VALUES ($1, 'usuario', $2, $3)`,
      [conversacionId, mensaje.trim(), clientMessageId],
    );
    await cliente.query('UPDATE conversaciones SET actualizada_en = NOW() WHERE id = $1', [
      conversacionId,
    ]);
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }

  try {
    const respuesta = onToken
      ? await asistenteService.transmitirRespuestaGroq(mensaje.trim(), historial, {
          signal,
          onToken,
          resumenContexto,
        })
      : await asistenteService.obtenerRespuestaGroq(mensaje.trim(), historial, resumenContexto);
    await pool.query(
      `INSERT INTO chats (conversacion_id, rol, contenido, client_message_id)
       VALUES ($1, 'asistente', $2, $3)`,
      [conversacionId, respuesta, clientMessageId],
    );
    if (generarTitulo) {
      void completarTituloConversacion(conversacionId, mensaje.trim(), requestId);
    }
    void programarResumenConversacion(usuarioId, conversacionId, requestId);
    return { mensaje: respuesta, cuota, tituloPendiente: generarTitulo };
  } catch (error) {
    if (cuotaReservada) {
      const clienteReembolso = await pool.connect();
      try {
        await clienteReembolso.query('BEGIN');
        await clienteReembolso.query(
          `DELETE FROM chats
           WHERE conversacion_id = $1 AND client_message_id = $2 AND rol = 'usuario'`,
          [conversacionId, clientMessageId],
        );
        await clienteReembolso.query(
          `UPDATE uso_asistente SET cantidad = GREATEST(0, cantidad - 1)
           WHERE usuario_id = $1 AND fecha = $2`,
          [usuarioId, fechaCuotaReservada],
        );
        await clienteReembolso.query('COMMIT');
      } catch (errorReembolso) {
        await clienteReembolso.query('ROLLBACK').catch(() => {});
        registrarError(errorReembolso, {
          requestId,
          contexto: 'reembolso_cuota_mensaje',
        });
      } finally {
        clienteReembolso.release();
      }
    }
    throw error;
  }
}

module.exports = {
  crearConversacion,
  listarConversaciones,
  obtenerConversacion,
  renombrarConversacion,
  fijarConversacion,
  eliminarConversacion,
  eliminarTodasLasConversaciones,
  procesarMensaje,
  LIMITE_DIARIO,
};

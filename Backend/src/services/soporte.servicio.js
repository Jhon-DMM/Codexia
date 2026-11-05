const pool = require('../database/conexion');
const { obtenerDocumentosLegales } = require('../config/documentos-legales');

const CATEGORIAS = new Set(['general', 'privacidad', 'facturacion']);

async function crearSolicitud(usuarioId, { categoria, asunto, mensaje, evidencia }) {
  if (!CATEGORIAS.has(categoria) || typeof asunto !== 'string' || typeof mensaje !== 'string') {
    const error = new Error('Completa la categoría, el asunto y el mensaje.');
    error.status = 400;
    throw error;
  }
  if (!evidencia?.aceptaPrivacidad) {
    const error = new Error('Debes aceptar el tratamiento de los datos de esta solicitud.');
    error.status = 400;
    throw error;
  }
  const asuntoLimpio = asunto.trim();
  const mensajeLimpio = mensaje.trim();
  if (!asuntoLimpio || asuntoLimpio.length > 120 || !mensajeLimpio || mensajeLimpio.length > 4000) {
    const error = new Error(
      'El asunto debe tener hasta 120 caracteres y el mensaje entre 1 y 4000.',
    );
    error.status = 400;
    throw error;
  }
  const privacidad = obtenerDocumentosLegales().find(
    (documento) => documento.tipo === 'privacidad',
  );
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId]);
    const conteo = await cliente.query(
      `SELECT COUNT(*)::integer AS cantidad FROM solicitudes_soporte
       WHERE usuario_id = $1 AND creada_en >= NOW() - INTERVAL '1 day'`,
      [usuarioId],
    );
    if (conteo.rows[0].cantidad >= 10) {
      const error = new Error('Alcanzaste el límite diario de solicitudes de soporte.');
      error.status = 429;
      throw error;
    }
    const resultado = await cliente.query(
      `INSERT INTO solicitudes_soporte
         (usuario_id, categoria, asunto, mensaje, privacidad_version, privacidad_sha256, ip, agente_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, categoria, asunto, mensaje, estado, respuesta, creada_en, actualizada_en`,
      [
        usuarioId,
        categoria,
        asuntoLimpio,
        mensajeLimpio,
        privacidad.version,
        privacidad.sha256,
        evidencia.ip,
        evidencia.agenteUsuario,
      ],
    );
    await cliente.query('COMMIT');
    return resultado.rows[0];
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function listarSolicitudesUsuario(usuarioId) {
  const resultado = await pool.query(
    `SELECT id, categoria, asunto, mensaje, estado, respuesta, creada_en, actualizada_en
     FROM solicitudes_soporte WHERE usuario_id = $1 ORDER BY actualizada_en DESC LIMIT 50`,
    [usuarioId],
  );
  return resultado.rows;
}

async function listarSolicitudesAdmin({ estado = '', limite = 50 }) {
  const resultado = await pool.query(
    `SELECT s.id, s.usuario_id, u.nombre AS usuario_nombre, u.correo AS usuario_correo,
       s.categoria, s.asunto, s.mensaje, s.estado, s.respuesta, s.creada_en, s.actualizada_en
     FROM solicitudes_soporte s JOIN usuarios u ON u.id = s.usuario_id
     WHERE ($1 = '' OR s.estado = $1)
     ORDER BY CASE WHEN s.estado = 'abierta' THEN 0 WHEN s.estado = 'respondida' THEN 1 ELSE 2 END,
       s.actualizada_en DESC LIMIT $2`,
    [estado, limite],
  );
  return resultado.rows;
}

async function responderSolicitud({ admin, solicitudId, respuesta, estado }) {
  if (
    !['respondida', 'cerrada'].includes(estado) ||
    typeof respuesta !== 'string' ||
    respuesta.trim().length > 4000 ||
    (estado === 'respondida' && !respuesta.trim())
  ) {
    const error = new Error('La respuesta o el estado no son válidos.');
    error.status = 400;
    throw error;
  }
  const resultado = await pool.query(
    `UPDATE solicitudes_soporte SET respuesta = $2, estado = $3, admin_id = $4,
       respondida_en = NOW(), actualizada_en = NOW()
     WHERE id = $1 RETURNING id, estado, respuesta, actualizada_en`,
    [solicitudId, respuesta.trim() || null, estado, admin.id],
  );
  return resultado.rows[0] || null;
}

module.exports = {
  crearSolicitud,
  listarSolicitudesUsuario,
  listarSolicitudesAdmin,
  responderSolicitud,
};

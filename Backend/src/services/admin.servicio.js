const pool = require('../database/conexion');
const { LIMITE_DIARIO } = require('./conversaciones.servicio');
const soporteService = require('./soporte.servicio');
const eliminacionesService = require('./eliminaciones.servicio');

async function obtenerResumen() {
  const resultado = await pool.query(
    `SELECT
       (SELECT COUNT(*)::integer FROM usuarios WHERE rol = 'cliente') AS clientes,
       (SELECT COUNT(*)::integer FROM usuarios WHERE rol = 'cliente' AND estado = 'activo') AS clientes_activos,
       (SELECT COUNT(*)::integer FROM usuarios WHERE rol = 'cliente' AND creado_en >= NOW() - INTERVAL '30 days') AS registros_30_dias,
       (SELECT COUNT(*)::integer FROM conversaciones) AS conversaciones,
       (SELECT COUNT(*)::integer FROM chats WHERE rol = 'usuario' AND creado_en >= CURRENT_DATE) AS mensajes_hoy,
       (SELECT COUNT(*)::integer FROM chats WHERE rol = 'usuario' AND creado_en >= NOW() - INTERVAL '30 days') AS mensajes_30_dias,
       (SELECT COUNT(*)::integer FROM usuarios WHERE rol = 'cliente' AND estado = 'suspendido') AS suspendidos`,
  );
  return { ...resultado.rows[0], limiteDiarioActual: LIMITE_DIARIO };
}

async function listarClientes({ busqueda = '', limite = 25, offset = 0 }) {
  const resultado = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.estado, u.creado_en,
       COALESCE(hoy.cantidad, 0)::integer AS mensajes_hoy,
       COALESCE(totales.mensajes, 0)::integer AS mensajes_totales,
       COALESCE(conversaciones.cantidad, 0)::integer AS conversaciones,
       ultima_sesion.ultima_sesion,
       eliminacion.id AS eliminacion_programada_id,
       eliminacion.motivo AS eliminacion_programada_motivo,
       eliminacion.detalles AS eliminacion_programada_detalles,
       eliminacion.eliminar_en AS eliminacion_programada_en
     FROM usuarios u
     LEFT JOIN uso_asistente hoy ON hoy.usuario_id = u.id AND hoy.fecha = CURRENT_DATE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(cantidad), 0)::integer AS mensajes FROM uso_asistente WHERE usuario_id = u.id
     ) totales ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::integer AS cantidad FROM conversaciones WHERE usuario_id = u.id
     ) conversaciones ON TRUE
     LEFT JOIN LATERAL (
       SELECT MAX(creada_en) AS ultima_sesion FROM sesiones WHERE usuario_id = u.id
     ) ultima_sesion ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, motivo, detalles, eliminar_en FROM eliminaciones_cuenta
       WHERE usuario_id = u.id AND estado = 'programada' ORDER BY creada_en DESC LIMIT 1
     ) eliminacion ON TRUE
     WHERE u.rol = 'cliente'
       AND ($1 = '' OR u.nombre ILIKE '%' || $1 || '%' OR u.correo ILIKE '%' || $1 || '%')
     ORDER BY u.creado_en DESC
     LIMIT $2 OFFSET $3`,
    [busqueda, limite, offset],
  );
  const conteo = await pool.query(
    `SELECT COUNT(*)::integer AS total FROM usuarios
     WHERE rol = 'cliente' AND ($1 = '' OR nombre ILIKE '%' || $1 || '%' OR correo ILIKE '%' || $1 || '%')`,
    [busqueda],
  );
  return { clientes: resultado.rows, total: conteo.rows[0].total, limite, offset };
}

async function registrarAuditoria({
  actor,
  accion,
  objetivoTipo,
  objetivoId = null,
  detalles = {},
  req,
}) {
  await pool.query(
    `INSERT INTO admin_auditoria
      (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles, ip, agente_usuario)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [
      actor.id,
      actor.correo,
      accion,
      objetivoTipo,
      objetivoId,
      JSON.stringify(detalles),
      req.ip || null,
      (req.get('user-agent') || '').slice(0, 512) || null,
    ],
  );
}

async function cambiarEstadoCliente({ admin, clienteId, estado, req }) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `UPDATE usuarios SET estado = $2
       WHERE id = $1 AND rol = 'cliente'
       RETURNING id, nombre, correo, estado`,
      [clienteId, estado],
    );
    if (!resultado.rowCount) {
      await cliente.query('ROLLBACK');
      return null;
    }
    if (estado === 'suspendido') {
      await cliente.query('DELETE FROM sesiones WHERE usuario_id = $1', [clienteId]);
    }
    await cliente.query(
      `INSERT INTO admin_auditoria
        (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles, ip, agente_usuario)
       VALUES ($1, $2, $3, 'cliente', $4, $5::jsonb, $6, $7)`,
      [
        admin.id,
        admin.correo,
        estado === 'suspendido' ? 'cliente_suspendido' : 'cliente_reactivado',
        String(clienteId),
        JSON.stringify({ estado }),
        req.ip || null,
        (req.get('user-agent') || '').slice(0, 512) || null,
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

async function listarAuditoria({
  limite = 50,
  offset = 0,
  categoria = '',
  accion = '',
  actor = '',
  desde = '',
  hasta = '',
}) {
  const condiciones = [];
  const parametros = [];
  const agregar = (valor, condicion) => {
    parametros.push(valor);
    condiciones.push(condicion.replace('?', `$${parametros.length}`));
  };

  if (categoria === 'consultas') {
    condiciones.push("accion IN ('clientes_consultados', 'solicitudes_soporte_consultadas')");
  } else if (categoria === 'cambios') {
    condiciones.push("accion NOT IN ('clientes_consultados', 'solicitudes_soporte_consultadas')");
  }
  if (accion) agregar(accion, 'accion = ?');
  if (actor) agregar(`%${actor}%`, 'actor_correo ILIKE ?');
  if (desde) agregar(desde, 'creado_en >= ?::date');
  if (hasta) agregar(hasta, "creado_en < (?::date + INTERVAL '1 day')");

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const resultadoConteo = await pool.query(
    `SELECT COUNT(*)::integer AS total FROM admin_auditoria ${where}`,
    parametros,
  );
  const parametrosPagina = [...parametros, limite, offset];
  const resultado = await pool.query(
    `SELECT id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles, creado_en
     FROM admin_auditoria ${where} ORDER BY creado_en DESC, id DESC
     LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosPagina,
  );
  return { eventos: resultado.rows, total: resultadoConteo.rows[0].total, limite, offset };
}

async function obtenerSalud() {
  const inicio = Date.now();
  await pool.query('SELECT 1');
  return {
    api: 'disponible',
    baseDatos: 'disponible',
    proveedorIA: process.env.GROQ_API_KEY ? 'configurado' : 'sin configurar',
    respuestaBaseDatosMs: Date.now() - inicio,
    entorno: process.env.NODE_ENV || 'development',
  };
}

async function listarSolicitudesSoporte({ estado = '', limite = 50 }) {
  return soporteService.listarSolicitudesAdmin({ estado, limite });
}

async function responderSolicitudSoporte({ admin, id, respuesta, estado, req }) {
  const solicitud = await soporteService.responderSolicitud({
    admin,
    solicitudId: id,
    respuesta,
    estado,
  });
  if (solicitud) {
    await registrarAuditoria({
      actor: admin,
      accion: estado === 'respondida' ? 'soporte_respondido' : 'soporte_cerrado',
      objetivoTipo: 'solicitud_soporte',
      objetivoId: String(id),
      req,
    });
  }
  return solicitud;
}

async function programarEliminacionesCuenta({
  admin,
  usuarioIds,
  motivo,
  detalles,
  demoraHoras,
  password,
  req,
}) {
  if (typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 1024) {
    const error = new Error('Escribe tu contraseña admin para confirmar la operación.');
    error.status = 400;
    throw error;
  }
  const valida = await eliminacionesService.verificarPasswordAdmin(admin.id, password);
  if (!valida) {
    const error = new Error('La contraseña admin no es correcta.');
    error.status = 403;
    throw error;
  }
  return eliminacionesService.programarEliminaciones({
    admin,
    usuarioIds,
    motivo,
    detalles,
    demoraHoras,
    req,
  });
}

async function listarEliminacionesProgramadas() {
  return eliminacionesService.listarEliminacionesProgramadas();
}

async function cancelarEliminacionCuenta({ admin, id, req }) {
  return eliminacionesService.cancelarEliminacion({ admin, id, req });
}

async function verificarPasswordAdmin(adminId, password) {
  return eliminacionesService.verificarPasswordAdmin(adminId, password);
}

module.exports = {
  obtenerResumen,
  listarClientes,
  cambiarEstadoCliente,
  listarAuditoria,
  obtenerSalud,
  registrarAuditoria,
  listarSolicitudesSoporte,
  responderSolicitudSoporte,
  programarEliminacionesCuenta,
  listarEliminacionesProgramadas,
  cancelarEliminacionCuenta,
  verificarPasswordAdmin,
};

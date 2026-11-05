const { createHash, randomUUID } = require('crypto');
const pool = require('../database/conexion');

const PLAZOS_HORAS_PERMITIDOS = new Set([0, 1, 12, 24, 72]);

function hashCorreo(correo) {
  return createHash('sha256').update(String(correo).trim().toLowerCase()).digest('hex');
}

function validarSolicitud({ usuarioIds, motivo, detalles, demoraHoras }) {
  if (
    !Array.isArray(usuarioIds) ||
    !usuarioIds.length ||
    usuarioIds.length > 100 ||
    usuarioIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)
  ) {
    const error = new Error('Selecciona entre 1 y 100 cuentas de cliente.');
    error.status = 400;
    throw error;
  }
  const ids = [...new Set(usuarioIds.map(Number))];
  if (ids.length !== usuarioIds.length) {
    const error = new Error('La selección contiene cuentas repetidas.');
    error.status = 400;
    throw error;
  }
  if (
    typeof motivo !== 'string' ||
    !motivo.trim() ||
    motivo.trim().length > 500 ||
    typeof detalles !== 'string' ||
    detalles.trim().length < 20 ||
    detalles.trim().length > 8000
  ) {
    const error = new Error(
      'Indica un motivo de hasta 500 caracteres y detalles de entre 20 y 8000 caracteres.',
    );
    error.status = 400;
    throw error;
  }
  const horas = Number(demoraHoras);
  if (!PLAZOS_HORAS_PERMITIDOS.has(horas)) {
    const error = new Error('El plazo debe ser inmediato, 1, 12, 24 o 72 horas.');
    error.status = 400;
    throw error;
  }
  return { ids, motivo: motivo.trim(), detalles: detalles.trim(), demoraHoras: horas };
}

async function programarEliminaciones({ admin, usuarioIds, motivo, detalles, demoraHoras, req }) {
  const solicitud = validarSolicitud({ usuarioIds, motivo, detalles, demoraHoras });
  const cliente = await pool.connect();
  const fechaEliminacion = new Date(Date.now() + solicitud.demoraHoras * 60 * 60 * 1000);
  const loteId = solicitud.ids.length > 1 ? randomUUID() : null;
  try {
    await cliente.query('BEGIN');
    const usuarios = await cliente.query(
      `SELECT id, nombre, correo, rol, password_hash FROM usuarios
       WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE`,
      [solicitud.ids],
    );
    if (usuarios.rowCount !== solicitud.ids.length) {
      const error = new Error(
        'Una o más cuentas ya no existen. Actualiza la lista e inténtalo de nuevo.',
      );
      error.status = 409;
      throw error;
    }
    if (
      usuarios.rows.some(
        (usuario) => usuario.rol !== 'cliente' || Number(usuario.id) === Number(admin.id),
      )
    ) {
      const error = new Error(
        'La herramienta permite eliminar cuentas de clientes, no cuentas administrativas.',
      );
      error.status = 400;
      throw error;
    }
    const yaProgramadas = await cliente.query(
      `SELECT usuario_id FROM eliminaciones_cuenta
       WHERE usuario_id = ANY($1::integer[]) AND estado = 'programada'`,
      [solicitud.ids],
    );
    if (yaProgramadas.rowCount) {
      const error = new Error('Una o más cuentas ya tienen una eliminación programada.');
      error.status = 409;
      throw error;
    }

    const creadas = [];
    for (const usuario of usuarios.rows) {
      const registro = await cliente.query(
        `INSERT INTO eliminaciones_cuenta
           (usuario_id, correo_hash, admin_id, admin_correo, motivo, detalles, modo, lote_id, eliminar_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, usuario_id, motivo, detalles, modo, lote_id, estado, creada_en, eliminar_en`,
        [
          usuario.id,
          hashCorreo(usuario.correo),
          admin.id,
          admin.correo,
          solicitud.motivo,
          solicitud.detalles,
          loteId ? 'multiple' : 'individual',
          loteId,
          fechaEliminacion,
        ],
      );
      const eliminacion = registro.rows[0];
      creadas.push({ ...eliminacion, nombre: usuario.nombre, correo: usuario.correo });
      if (solicitud.demoraHoras === 0) {
        await cliente.query(
          `UPDATE eliminaciones_cuenta SET aviso_password_hash = $2 WHERE id = $1`,
          [eliminacion.id, usuario.password_hash],
        );
        await cliente.query(`DELETE FROM usuarios WHERE id = $1`, [usuario.id]);
        await cliente.query(
          `UPDATE eliminaciones_cuenta SET estado = 'ejecutada', ejecutada_en = NOW()
           WHERE id = $1`,
          [eliminacion.id],
        );
      }
    }

    await cliente.query(
      `INSERT INTO admin_auditoria
        (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles, ip, agente_usuario)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        admin.id,
        admin.correo,
        solicitud.demoraHoras === 0 ? 'cuentas_eliminadas' : 'eliminacion_programada',
        loteId ? 'lote_cuentas' : 'cuenta',
        loteId || String(creadas[0].id),
        JSON.stringify({ cantidad: creadas.length, demoraHoras: solicitud.demoraHoras }),
        req.ip || null,
        (req.get('user-agent') || '').slice(0, 512) || null,
      ],
    );
    await cliente.query('COMMIT');
    return {
      cantidad: creadas.length,
      eliminaciones: creadas.map(
        ({ id, usuario_id, nombre, correo, motivo, detalles, estado, eliminar_en }) => ({
          id,
          usuario_id,
          nombre,
          correo,
          motivo,
          detalles,
          estado: solicitud.demoraHoras === 0 ? 'ejecutada' : estado,
          eliminar_en,
        }),
      ),
    };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function listarEliminacionesProgramadas() {
  const resultado = await pool.query(
    `SELECT e.id, e.usuario_id, u.nombre, u.correo, e.motivo, e.detalles,
       e.modo, e.lote_id, e.creada_en, e.eliminar_en
     FROM eliminaciones_cuenta e LEFT JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.estado = 'programada' ORDER BY e.eliminar_en ASC LIMIT 500`,
  );
  return resultado.rows;
}

async function cancelarEliminacion({ admin, id, req }) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `UPDATE eliminaciones_cuenta SET estado = 'cancelada', cancelada_en = NOW()
       WHERE id = $1 AND estado = 'programada'
       RETURNING id, usuario_id, lote_id`,
      [id],
    );
    if (!resultado.rowCount) {
      await cliente.query('ROLLBACK');
      return null;
    }
    await cliente.query(
      `INSERT INTO admin_auditoria
        (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles, ip, agente_usuario)
       VALUES ($1, $2, 'eliminacion_cancelada', 'eliminacion_cuenta', $3, $4::jsonb, $5, $6)`,
      [
        admin.id,
        admin.correo,
        String(id),
        JSON.stringify({ usuarioId: resultado.rows[0].usuario_id }),
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

async function ejecutarEliminacionesVencidas() {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const vencidas = await cliente.query(
      `SELECT id, usuario_id FROM eliminaciones_cuenta
       WHERE estado = 'programada' AND eliminar_en <= NOW()
       ORDER BY eliminar_en LIMIT 100 FOR UPDATE SKIP LOCKED`,
    );
    for (const eliminacion of vencidas.rows) {
      if (eliminacion.usuario_id) {
        const usuario = await cliente.query('SELECT password_hash FROM usuarios WHERE id = $1', [
          eliminacion.usuario_id,
        ]);
        if (usuario.rowCount) {
          await cliente.query(
            `UPDATE eliminaciones_cuenta SET aviso_password_hash = $2 WHERE id = $1`,
            [eliminacion.id, usuario.rows[0].password_hash],
          );
          await cliente.query('DELETE FROM usuarios WHERE id = $1', [eliminacion.usuario_id]);
        }
      }
      await cliente.query(
        `UPDATE eliminaciones_cuenta SET estado = 'ejecutada', ejecutada_en = NOW()
         WHERE id = $1 AND estado = 'programada'`,
        [eliminacion.id],
      );
    }
    await cliente.query('COMMIT');
    return vencidas.rowCount;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function obtenerEliminacionProgramada(usuarioId) {
  const resultado = await pool.query(
    `SELECT id, motivo, detalles, eliminar_en, creada_en
     FROM eliminaciones_cuenta WHERE usuario_id = $1 AND estado = 'programada'
     ORDER BY creada_en DESC LIMIT 1`,
    [usuarioId],
  );
  return resultado.rows[0] || null;
}

async function obtenerAvisoEliminacionPorCorreo(correo) {
  const resultado = await pool.query(
    `SELECT motivo, detalles, ejecutada_en, aviso_password_hash
     FROM eliminaciones_cuenta WHERE correo_hash = $1 AND estado = 'ejecutada'
     ORDER BY ejecutada_en DESC NULLS LAST, creada_en DESC LIMIT 1`,
    [hashCorreo(correo)],
  );
  return resultado.rows[0] || null;
}

async function verificarPasswordAdmin(adminId, password) {
  const resultado = await pool.query(
    `SELECT password_hash FROM usuarios WHERE id = $1 AND rol = 'admin' AND estado = 'activo'`,
    [adminId],
  );
  if (!resultado.rowCount) return false;
  const { verificarPassword } = require('./usuarios.servicio');
  return verificarPassword(resultado.rows[0].password_hash, password);
}

module.exports = {
  programarEliminaciones,
  listarEliminacionesProgramadas,
  cancelarEliminacion,
  ejecutarEliminacionesVencidas,
  obtenerEliminacionProgramada,
  obtenerAvisoEliminacionPorCorreo,
  verificarPasswordAdmin,
};

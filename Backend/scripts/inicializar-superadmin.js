require('dotenv').config();

const pool = require('../src/database/conexion');

async function inicializarSuperadmin() {
  const correo = (process.argv[2] || process.env.INITIAL_SUPERADMIN_EMAIL)?.trim().toLowerCase();
  if (!correo) {
    console.info('No se configuró INITIAL_SUPERADMIN_EMAIL; se omite la inicialización.');
    return;
  }
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    console.error('Uso: npm run superadmin:inicializar -- correo@dominio.com');
    process.exitCode = 1;
    return;
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('codexia-inicial-superadmin'))");
    const existente = await cliente.query(
      "SELECT id, correo FROM usuarios WHERE rol = 'superadmin' LIMIT 1",
    );
    if (existente.rowCount) {
      if (existente.rows[0].correo.toLowerCase() === correo) {
        await cliente.query('COMMIT');
        console.info(`El superadmin ${correo} ya está inicializado.`);
        return;
      }
      await cliente.query('ROLLBACK');
      console.error('Ya existe un superadmin. Usa la consola para administrar roles.');
      process.exitCode = 1;
      return;
    }

    const resultado = await cliente.query(
      `UPDATE usuarios SET rol = 'superadmin', estado = 'activo', correo_verificado = TRUE
       WHERE LOWER(correo) = $1
       RETURNING id, nombre, correo`,
      [correo],
    );
    if (!resultado.rowCount) {
      await cliente.query('ROLLBACK');
      console.error('No hay una cuenta registrada con ese correo. Crea primero la cuenta.');
      process.exitCode = 1;
      return;
    }

    const superadmin = resultado.rows[0];
    await cliente.query(
      `INSERT INTO admin_auditoria
        (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles)
       VALUES ($1, $2, 'superadmin_inicializado', 'cuenta', $3, '{"metodo":"consola local"}'::jsonb)`,
      [superadmin.id, superadmin.correo, String(superadmin.id)],
    );
    await cliente.query('COMMIT');
    console.log(`Superadmin inicializado para ${superadmin.correo}.`);
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    console.error(`No se pudo inicializar el superadmin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await pool.end();
  }
}

inicializarSuperadmin();

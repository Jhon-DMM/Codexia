require('dotenv').config();

const pool = require('../src/database/conexion');

async function promoverAdmin() {
  const correo = process.argv[2]?.trim().toLowerCase();
  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    console.error('Uso: npm run admin:promover -- correo@dominio.com');
    process.exitCode = 1;
    return;
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `UPDATE usuarios SET rol = 'admin', estado = 'activo'
       WHERE LOWER(correo) = $1
       RETURNING id, nombre, correo, rol`,
      [correo],
    );
    if (!resultado.rowCount) {
      await cliente.query('ROLLBACK');
      console.error('No existe una cuenta con ese correo. Crea la cuenta e inténtalo de nuevo.');
      process.exitCode = 1;
      return;
    }
    await cliente.query(
      `INSERT INTO admin_auditoria (actor_id, actor_correo, accion, objetivo_tipo, objetivo_id, detalles)
       VALUES ($1, $2, 'rol_admin_asignado', 'cuenta', $3, '{"metodo":"consola local"}'::jsonb)`,
      [resultado.rows[0].id, resultado.rows[0].correo, String(resultado.rows[0].id)],
    );
    await cliente.query('COMMIT');
    console.log(`Rol admin asignado a ${resultado.rows[0].correo}.`);
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    console.error(`No se pudo asignar el rol admin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    cliente.release();
    await pool.end();
  }
}

promoverAdmin();

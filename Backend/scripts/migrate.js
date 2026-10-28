require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/database/conexion');

async function ejecutarMigracion() {
  const rutasMigraciones = [
    '001_esquema_inicial.sql',
    '002_conversaciones_fijadas.sql',
    '003_limite_intentos_login.sql',
    '004_escalada_bloqueo_login.sql',
    '005_aceptaciones_legales.sql',
  ].map((archivo) => path.join(__dirname, '..', 'database', 'migrations', archivo));
  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    for (const rutaMigracion of rutasMigraciones) {
      await client.query(fs.readFileSync(rutaMigracion, 'utf8'));
    }
    await client.query('COMMIT');
    console.log('Esquema y actualizaciones aplicados correctamente. Los datos existentes se conservaron.');
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (errorRollback) { /* La conexión puede haberse cerrado. */ }
    }
    const detalle = [error.code, error.message, error.cause?.message].filter(Boolean).join(' · ');
    console.error(`No se pudo aplicar el esquema: ${detalle || String(error)}`);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

ejecutarMigracion();

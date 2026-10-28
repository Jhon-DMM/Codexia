const pool = require('../database/conexion');
const bcrypt = require('bcrypt');
const argon2 = require('argon2');
const { createHash, randomBytes } = require('crypto');
const { obtenerDocumentosLegales } = require('../config/documentos-legales');

const DURACION_SESION_DIAS = 7;
const INTENTOS_LOGIN_MAXIMOS = 3;
const VENTANA_INTENTOS_MINUTOS = 15;
const MAX_PASSWORD_BYTES = 1024;
const OPCIONES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
let hashArgon2Invalido;

function obtenerHashArgon2Invalido() {
  if (!hashArgon2Invalido) {
    hashArgon2Invalido = argon2.hash(randomBytes(32).toString('hex'), OPCIONES_ARGON2);
  }
  return hashArgon2Invalido;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function registrarUsuario({ nombre, correo, password, evidenciaLegal }) {
  const nombreNormalizado = nombre.trim();
  const correoNormalizado = correo.trim().toLowerCase();
  const passwordHash = await argon2.hash(password, OPCIONES_ARGON2);
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const resultadoInsercion = await cliente.query(
        `INSERT INTO usuarios (nombre, correo, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, nombre, correo, creado_en`,
        [nombreNormalizado, correoNormalizado, passwordHash]
    );
    const usuario = resultadoInsercion.rows[0];
    await registrarAceptacionesLegales(usuario.id, evidenciaLegal, cliente);
    const sesion = await crearSesion(usuario.id, cliente);
    await cliente.query('COMMIT');
    return { usuario, sesion };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
        const errorDuplicado = new Error('El correo ya está registrado');
        errorDuplicado.code = 'CORREO_DUPLICADO';
        throw errorDuplicado;
    }
    throw error;
  } finally {
    cliente.release();
  }
}

async function registrarAceptacionesLegales(usuarioId, evidencia, cliente = pool) {
  const documentos = obtenerDocumentosLegales();
  for (const documento of documentos) {
    await cliente.query(
      `INSERT INTO aceptaciones_legales
         (usuario_id, documento, version, documento_sha256, mecanismo, ip, agente_usuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (usuario_id, documento, version) DO NOTHING`,
      [
        usuarioId,
        documento.tipo,
        documento.version,
        documento.sha256,
        evidencia.mecanismo,
        evidencia.ip || null,
        evidencia.agenteUsuario || null,
      ]
    );
  }
}

function crearEvidenciaLegal(req, mecanismo) {
  return {
    mecanismo,
    ip: req.ip || null,
    agenteUsuario: (req.get('user-agent') || '').slice(0, 512) || null,
  };
}

async function iniciarSesion({ correo, password, evidenciaLegal }) {
  const resultado = await pool.query(
    `SELECT id, nombre, correo, password_hash
     FROM usuarios
     WHERE correo = $1`,
    [correo.trim().toLowerCase()]
  );
  const usuario = resultado.rows[0];

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return null;

  if (!usuario) {
    await argon2.verify(await obtenerHashArgon2Invalido(), password);
    return null;
  }

  const hashArgon2 = usuario.password_hash.startsWith('$argon2id$');
  const hashBcrypt = /^\$2[aby]\$/.test(usuario.password_hash);
  let passwordValida = false;

  if (hashArgon2) {
    passwordValida = await argon2.verify(usuario.password_hash, password);
  } else if (hashBcrypt && Buffer.byteLength(password, 'utf8') <= 72) {
    passwordValida = await bcrypt.compare(password, usuario.password_hash);
  }

  if (!passwordValida) return null;

  if (hashBcrypt) {
    const nuevoHash = await argon2.hash(password, OPCIONES_ARGON2);
    await pool.query(
      `UPDATE usuarios SET password_hash = $2
       WHERE id = $1 AND password_hash = $3`,
      [usuario.id, nuevoHash, usuario.password_hash]
    );
  }

  await registrarAceptacionesLegales(usuario.id, evidenciaLegal);

  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo };
}

async function verificarPassword(passwordHash, password) {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return false;
  if (passwordHash.startsWith('$argon2id$')) return argon2.verify(passwordHash, password);
  if (/^\$2[aby]\$/.test(passwordHash) && Buffer.byteLength(password, 'utf8') <= 72) {
    return bcrypt.compare(password, passwordHash);
  }
  return false;
}

async function obtenerBloqueoLogin(claveHash) {
  const resultado = await pool.query(
    `SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (bloqueada_hasta - NOW()))))::integer AS segundos
     FROM intentos_login
     WHERE clave_hash = $1 AND bloqueada_hasta > NOW()`,
    [claveHash]
  );
  return resultado.rows[0]?.segundos || 0;
}

async function registrarIntentoLoginFallido(claveHash) {
  const resultado = await pool.query(
    `INSERT INTO intentos_login (clave_hash, intentos, ventana_iniciada_en, bloqueada_hasta)
     VALUES ($1, 1, NOW(), NULL)
     ON CONFLICT (clave_hash) DO UPDATE SET
       intentos = CASE
         WHEN intentos_login.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 minute')
           OR (intentos_login.bloqueada_hasta IS NOT NULL AND intentos_login.bloqueada_hasta <= NOW())
         THEN 1 ELSE intentos_login.intentos + 1 END,
       ventana_iniciada_en = CASE
         WHEN intentos_login.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 minute')
           OR (intentos_login.bloqueada_hasta IS NOT NULL AND intentos_login.bloqueada_hasta <= NOW())
         THEN NOW() ELSE intentos_login.ventana_iniciada_en END,
       nivel_bloqueo = CASE
         WHEN intentos_login.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 minute')
           OR (intentos_login.bloqueada_hasta IS NOT NULL AND intentos_login.bloqueada_hasta <= NOW())
         THEN intentos_login.nivel_bloqueo
         WHEN intentos_login.intentos + 1 >= $3
         THEN LEAST(4, intentos_login.nivel_bloqueo + 1)
         ELSE intentos_login.nivel_bloqueo END,
       bloqueada_hasta = CASE
         WHEN intentos_login.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 minute')
           OR (intentos_login.bloqueada_hasta IS NOT NULL AND intentos_login.bloqueada_hasta <= NOW())
         THEN NULL
         WHEN intentos_login.intentos + 1 >= $3
         THEN NOW() + CASE LEAST(4, intentos_login.nivel_bloqueo + 1)
           WHEN 1 THEN INTERVAL '15 minutes'
           WHEN 2 THEN INTERVAL '30 minutes'
           WHEN 3 THEN INTERVAL '1 hour'
           ELSE INTERVAL '24 hours' END
         ELSE NULL END
     RETURNING intentos, nivel_bloqueo,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM (bloqueada_hasta - NOW()))))::integer AS segundos`,
    [claveHash, VENTANA_INTENTOS_MINUTOS, INTENTOS_LOGIN_MAXIMOS]
  );
  const fila = resultado.rows[0];

  // La tabla solo necesita conservar intentos recientes; la limpieza ocasional evita acumular hashes antiguos.
  if (Math.random() < 0.01) {
    await pool.query(
      `DELETE FROM intentos_login
       WHERE nivel_bloqueo = 0
         AND ventana_iniciada_en < NOW() - INTERVAL '1 day'
         AND (bloqueada_hasta IS NULL OR bloqueada_hasta <= NOW())`
    );
  }

  return {
    intentos: fila.intentos,
    nivelBloqueo: fila.nivel_bloqueo,
    segundos: fila.segundos || 0,
    restantes: Math.max(0, INTENTOS_LOGIN_MAXIMOS - fila.intentos),
  };
}

async function limpiarIntentosLogin(claveHash) {
  await pool.query('DELETE FROM intentos_login WHERE clave_hash = $1', [claveHash]);
}

async function actualizarNombre(usuarioId, nombre) {
  const resultado = await pool.query(
    `UPDATE usuarios SET nombre = $2
     WHERE id = $1
     RETURNING id, nombre, correo`,
    [usuarioId, nombre.trim()]
  );
  return resultado.rows[0] || null;
}

async function crearSesion(usuarioId, cliente = pool) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const resultado = await cliente.query(
    `INSERT INTO sesiones (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))
     RETURNING expira_en`,
    [usuarioId, tokenHash, DURACION_SESION_DIAS]
  );

  return { token, expiraEn: resultado.rows[0].expira_en };
}

async function obtenerUsuarioPorToken(token) {
  const resultado = await pool.query(
    `SELECT u.id, u.nombre, u.correo
     FROM sesiones s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expira_en > NOW()`,
    [hashToken(token)]
  );

  return resultado.rows[0] || null;
}

async function cerrarSesion(token) {
  await pool.query('DELETE FROM sesiones WHERE token_hash = $1', [hashToken(token)]);
}

async function eliminarCuenta(usuarioId, password) {
  const resultado = await pool.query(
    'SELECT password_hash FROM usuarios WHERE id = $1',
    [usuarioId]
  );
  const usuario = resultado.rows[0];
  if (!usuario || !(await verificarPassword(usuario.password_hash, password))) return false;

  const eliminacion = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 RETURNING id',
    [usuarioId]
  );
  return eliminacion.rowCount > 0;
}

async function obtenerCuotaDiaria(usuarioId, limite) {
  const resultado = await pool.query(
    `SELECT COALESCE((
       SELECT cantidad FROM uso_asistente
       WHERE usuario_id = $1 AND fecha = CURRENT_DATE
     ), 0)::integer AS usado,
     $2::integer AS limite,
     GREATEST(0, $2 - COALESCE((
       SELECT cantidad FROM uso_asistente
       WHERE usuario_id = $1 AND fecha = CURRENT_DATE
     ), 0))::integer AS restante`,
    [usuarioId, limite]
  );

  return resultado.rows[0];
}

async function obtenerTotalMensajes(usuarioId) {
  const resultado = await pool.query(
    `SELECT COALESCE(SUM(cantidad), 0)::integer AS total
     FROM uso_asistente
     WHERE usuario_id = $1`,
    [usuarioId]
  );
  return resultado.rows[0].total;
}

module.exports = {
  registrarUsuario,
  iniciarSesion,
  crearEvidenciaLegal,
  obtenerBloqueoLogin,
  registrarIntentoLoginFallido,
  limpiarIntentosLogin,
  actualizarNombre,
  crearSesion,
  obtenerUsuarioPorToken,
  cerrarSesion,
  eliminarCuenta,
  obtenerCuotaDiaria,
  obtenerTotalMensajes,
};

const pool = require('../database/conexion');
const bcrypt = require('bcrypt');
const { createHash, randomBytes } = require('crypto');

const DURACION_SESION_DIAS = 7;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function registrarUsuario({ nombre, correo, password }) {

  const nombreNormalizado = nombre.trim();
  const correoNormalizado = correo.trim().toLowerCase();

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const resultadoInsercion = await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, nombre, correo, creado_en`,
        [nombreNormalizado, correoNormalizado, passwordHash]
    );

    return resultadoInsercion.rows[0];

  } catch (error) {
    if (error.code === '23505') {
        const errorDuplicado = new Error('El correo ya está registrado');
        errorDuplicado.code = 'CORREO_DUPLICADO';
        throw errorDuplicado;
    }

    throw error;
  }

}

async function iniciarSesion({ correo, password }) {
  const resultado = await pool.query(
    `SELECT id, nombre, correo, password_hash
     FROM usuarios
     WHERE correo = $1`,
    [correo.trim().toLowerCase()]
  );
  const usuario = resultado.rows[0];

  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    return null;
  }

  return { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo };
}

async function crearSesion(usuarioId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const resultado = await pool.query(
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

module.exports = {
  registrarUsuario,
  iniciarSesion,
  crearSesion,
  obtenerUsuarioPorToken,
  cerrarSesion,
  obtenerCuotaDiaria,
};

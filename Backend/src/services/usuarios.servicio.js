const pool = require('../database/conexion');
const bcrypt = require('bcrypt');

async function registrarUsuario({ nombre, correo, password }) {

  const nombreNormalizado = nombre.trim();
  const correoNormalizado = correo.trim().toLowerCase();

  const resultado = await pool.query(
    `SELECT id
     FROM usuarios
     WHERE LOWER(correo) = $1`,
    [correoNormalizado]
  );

  if (resultado.rowCount > 0) {
    const error = new Error('El correo ya está registrado');
    error.code = 'CORREO_DUPLICADO';
    throw error;
  }

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

module.exports = {
  registrarUsuario,
};

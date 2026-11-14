const pool = require('../database/conexion');
const bcrypt = require('bcrypt');
const argon2 = require('argon2');
const { createHash, randomBytes, randomInt, timingSafeEqual } = require('crypto');
const { obtenerDocumentosLegales } = require('../config/documentos-legales');
const {
  DURACION_PILOTO_DIAS,
  PILOTO_ACTIVO,
  pilotoFinalizado,
} = require('../config/piloto.config');
const {
  MAXIMO_SOLICITUDES_LOGIN_IP,
  VENTANA_LOGIN_IP_SEGUNDOS,
  MAXIMO_REGISTROS_IP,
  VENTANA_REGISTRO_IP_SEGUNDOS,
} = require('../config/limites-login.config');
const { crearClaveHashLimiteLogin } = require('../config/limites-login.config');
const { EMAIL_VERIFICATION_REQUIRED } = require('../config/correo.config');

const DURACION_SESION_DIAS = 7;
const INTENTOS_LOGIN_MAXIMOS = 3;
const VENTANA_INTENTOS_MINUTOS = 15;
const MAX_PASSWORD_BYTES = 1024;
const DURACION_CODIGO_CORREO_MINUTOS = 10;
const MAXIMO_INTENTOS_CODIGO_CORREO = 5;
const ESPERA_REENVIO_CODIGO_SEGUNDOS = 60;
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
         RETURNING id, nombre, correo, rol, estado, creado_en, piloto_inicio_en`,
      [nombreNormalizado, correoNormalizado, passwordHash],
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

function generarCodigoVerificacionCorreo() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashCodigoVerificacionCorreo(usuarioId, codigo) {
  return crearClaveHashLimiteLogin('codigo-verificacion-correo', `${usuarioId}:${codigo}`);
}

async function registrarUsuarioPendiente({ nombre, correo, password, evidenciaLegal }) {
  const nombreNormalizado = nombre.trim();
  const correoNormalizado = correo.trim().toLowerCase();
  const passwordHash = await argon2.hash(password, OPCIONES_ARGON2);
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const resultadoInsercion = await cliente.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, correo_verificado)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, nombre, correo, rol, estado, creado_en, piloto_inicio_en`,
      [nombreNormalizado, correoNormalizado, passwordHash],
    );
    const usuario = resultadoInsercion.rows[0];
    const codigo = generarCodigoVerificacionCorreo();
    await registrarAceptacionesLegales(usuario.id, evidenciaLegal, cliente);
    await cliente.query(
      `INSERT INTO codigos_verificacion_correo
         (usuario_id, codigo_hash, vence_en, reenviar_despues_en)
       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'), NOW() + ($4 * INTERVAL '1 second'))`,
      [
        usuario.id,
        hashCodigoVerificacionCorreo(usuario.id, codigo),
        DURACION_CODIGO_CORREO_MINUTOS,
        ESPERA_REENVIO_CODIGO_SEGUNDOS,
      ],
    );
    await cliente.query('COMMIT');
    return { usuario, codigo };
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

async function verificarCorreoPendiente({ correo, codigo }) {
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `SELECT u.id, u.nombre, u.correo, u.rol, u.estado, u.piloto_inicio_en,
              c.codigo_hash, c.intentos,
              (c.vence_en <= NOW()) AS codigo_vencido
       FROM usuarios u
       JOIN codigos_verificacion_correo c ON c.usuario_id = u.id
       WHERE LOWER(u.correo) = $1 AND u.correo_verificado = FALSE
       FOR UPDATE OF u, c`,
      [correo.trim().toLowerCase()],
    );
    const registro = resultado.rows[0];

    if (
      !registro ||
      registro.intentos >= MAXIMO_INTENTOS_CODIGO_CORREO ||
      registro.codigo_vencido
    ) {
      await cliente.query('COMMIT');
      return { verificado: false, intentosRestantes: 0 };
    }

    const hashEsperado = Buffer.from(registro.codigo_hash);
    const hashRecibido = Buffer.from(hashCodigoVerificacionCorreo(registro.id, codigo));
    const codigoCorrecto =
      hashEsperado.length === hashRecibido.length && timingSafeEqual(hashEsperado, hashRecibido);

    if (!codigoCorrecto) {
      const actualizado = await cliente.query(
        `UPDATE codigos_verificacion_correo
         SET intentos = intentos + 1
         WHERE usuario_id = $1
         RETURNING intentos`,
        [registro.id],
      );
      await cliente.query('COMMIT');
      const intentosRestantes = Math.max(
        0,
        MAXIMO_INTENTOS_CODIGO_CORREO - actualizado.rows[0].intentos,
      );
      return { verificado: false, intentosRestantes };
    }

    await cliente.query('UPDATE usuarios SET correo_verificado = TRUE WHERE id = $1', [
      registro.id,
    ]);
    await cliente.query('DELETE FROM codigos_verificacion_correo WHERE usuario_id = $1', [
      registro.id,
    ]);
    const sesion = await crearSesion(registro.id, cliente);
    await cliente.query('COMMIT');

    return {
      verificado: true,
      usuario: {
        id: registro.id,
        nombre: registro.nombre,
        correo: registro.correo,
        rol: registro.rol,
        piloto_inicio_en: registro.piloto_inicio_en,
      },
      sesion,
    };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function reenviarCodigoVerificacionCorreo(correo) {
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      `SELECT u.id, u.correo,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.reenviar_despues_en - NOW()))))::integer AS espera,
              CASE
                WHEN c.ventana_reenvios_en <= NOW() - INTERVAL '1 hour' THEN 0
                ELSE c.reenvios_en_ventana
              END AS reenvios_en_ventana,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
                c.ventana_reenvios_en + INTERVAL '1 hour' - NOW()
              ))))::integer AS espera_ventana
       FROM usuarios u
       JOIN codigos_verificacion_correo c ON c.usuario_id = u.id
       WHERE LOWER(u.correo) = $1 AND u.correo_verificado = FALSE
       FOR UPDATE OF u, c`,
      [correo.trim().toLowerCase()],
    );
    const registro = resultado.rows[0];

    if (!registro || registro.espera > 0 || registro.reenvios_en_ventana >= 5) {
      await cliente.query('COMMIT');
      const reintentarEn = !registro
        ? ESPERA_REENVIO_CODIGO_SEGUNDOS
        : registro.espera > 0
          ? registro.espera
          : registro.espera_ventana;
      return { enviado: false, reintentarEn };
    }

    const codigo = generarCodigoVerificacionCorreo();
    await cliente.query(
      `UPDATE codigos_verificacion_correo
       SET codigo_hash = $2,
           vence_en = NOW() + ($3 * INTERVAL '1 minute'),
           intentos = 0,
           reenviar_despues_en = NOW() + ($4 * INTERVAL '1 second'),
           reenvios_en_ventana = CASE
             WHEN ventana_reenvios_en <= NOW() - INTERVAL '1 hour' THEN 1
             ELSE reenvios_en_ventana + 1
           END,
           ventana_reenvios_en = CASE
             WHEN ventana_reenvios_en <= NOW() - INTERVAL '1 hour' THEN NOW()
             ELSE ventana_reenvios_en
           END,
           creado_en = NOW()
       WHERE usuario_id = $1`,
      [
        registro.id,
        hashCodigoVerificacionCorreo(registro.id, codigo),
        DURACION_CODIGO_CORREO_MINUTOS,
        ESPERA_REENVIO_CODIGO_SEGUNDOS,
      ],
    );
    await cliente.query('COMMIT');
    return {
      enviado: true,
      correo: registro.correo,
      codigo,
      reintentarEn: ESPERA_REENVIO_CODIGO_SEGUNDOS,
    };
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
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
      ],
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

async function iniciarSesion({ correo, password }) {
  const resultado = await pool.query(
    `SELECT id, nombre, correo, password_hash, rol, estado, correo_verificado, piloto_inicio_en
     FROM usuarios
     WHERE correo = $1`,
    [correo.trim().toLowerCase()],
  );
  const usuario = resultado.rows[0];

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) return null;

  if (!usuario) {
    const avisoEliminacion =
      await require('./eliminaciones.servicio').obtenerAvisoEliminacionPorCorreo(correo);
    if (
      avisoEliminacion?.aviso_password_hash &&
      (await verificarPassword(avisoEliminacion.aviso_password_hash, password))
    ) {
      return { cuentaEliminada: avisoEliminacion };
    }
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

  if (usuario.estado === 'suspendido') return { cuentaSuspendida: true };
  if (!usuario.correo_verificado && EMAIL_VERIFICATION_REQUIRED) {
    return { correoNoVerificado: true };
  }

  if (
    PILOTO_ACTIVO &&
    !['admin', 'superadmin'].includes(usuario.rol) &&
    pilotoFinalizado(usuario.piloto_inicio_en)
  ) {
    await eliminarDatosPilotoUsuario(usuario.id);
    return { pilotoFinalizado: true };
  }

  if (hashBcrypt) {
    const nuevoHash = await argon2.hash(password, OPCIONES_ARGON2);
    await pool.query(
      `UPDATE usuarios SET password_hash = $2
       WHERE id = $1 AND password_hash = $3`,
      [usuario.id, nuevoHash, usuario.password_hash],
    );
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    piloto_inicio_en: usuario.piloto_inicio_en,
  };
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
    [claveHash],
  );
  return resultado.rows[0]?.segundos || 0;
}

async function registrarIntentoLoginPorIp(claveHash) {
  const resultado = await pool.query(
    `INSERT INTO limites_login_ip (clave_hash, intentos, ventana_iniciada_en)
     VALUES ($1, 1, NOW())
     ON CONFLICT (clave_hash) DO UPDATE SET
       intentos = CASE
         WHEN limites_login_ip.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 second')
         THEN 1
         ELSE limites_login_ip.intentos + 1
       END,
       ventana_iniciada_en = CASE
         WHEN limites_login_ip.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 second')
         THEN NOW()
         ELSE limites_login_ip.ventana_iniciada_en
       END,
       actualizado_en = NOW()
     RETURNING intentos,
       GREATEST(
         1,
         CEIL(EXTRACT(EPOCH FROM (
           ventana_iniciada_en + ($2 * INTERVAL '1 second') - NOW()
         )))
       )::integer AS segundos`,
    [claveHash, VENTANA_LOGIN_IP_SEGUNDOS],
  );

  if (Math.random() < 0.01) {
    await pool.query(
      `DELETE FROM limites_login_ip
       WHERE actualizado_en < NOW() - INTERVAL '1 day'`,
    );
  }

  const intento = resultado.rows[0];
  const limitado = intento.intentos > MAXIMO_SOLICITUDES_LOGIN_IP;

  return {
    limitado,
    intentos: intento.intentos,
    maximo: MAXIMO_SOLICITUDES_LOGIN_IP,
    reintentarEn: limitado ? intento.segundos : 0,
  };
}

async function registrarIntentoRegistroPorIp(claveHash) {
  const resultado = await pool.query(
    `INSERT INTO limites_registro_ip (clave_hash, intentos, ventana_iniciada_en)
     VALUES ($1, 1, NOW())
     ON CONFLICT (clave_hash) DO UPDATE SET
       intentos = CASE
         WHEN limites_registro_ip.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 second')
         THEN 1
         ELSE limites_registro_ip.intentos + 1
       END,
       ventana_iniciada_en = CASE
         WHEN limites_registro_ip.ventana_iniciada_en <= NOW() - ($2 * INTERVAL '1 second')
         THEN NOW()
         ELSE limites_registro_ip.ventana_iniciada_en
       END,
       actualizado_en = NOW()
     RETURNING intentos,
       GREATEST(
         1,
         CEIL(EXTRACT(EPOCH FROM (
           ventana_iniciada_en + ($2 * INTERVAL '1 second') - NOW()
         )))
       )::integer AS segundos`,
    [claveHash, VENTANA_REGISTRO_IP_SEGUNDOS],
  );

  if (Math.random() < 0.01) {
    await pool.query(
      `DELETE FROM limites_registro_ip
       WHERE actualizado_en < NOW() - INTERVAL '7 days'`,
    );
  }

  const intento = resultado.rows[0];
  const limitado = intento.intentos > MAXIMO_REGISTROS_IP;

  return {
    limitado,
    intentos: intento.intentos,
    maximo: MAXIMO_REGISTROS_IP,
    reintentarEn: limitado ? intento.segundos : 0,
  };
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
       CASE
         WHEN bloqueada_hasta > NOW()
         THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (bloqueada_hasta - NOW()))))::integer
         ELSE 0
       END AS segundos`,
    [claveHash, VENTANA_INTENTOS_MINUTOS, INTENTOS_LOGIN_MAXIMOS],
  );
  const fila = resultado.rows[0];

  // La tabla solo necesita conservar intentos recientes; la limpieza ocasional evita acumular hashes antiguos.
  if (Math.random() < 0.01) {
    await pool.query(
      `DELETE FROM intentos_login
       WHERE nivel_bloqueo = 0
         AND ventana_iniciada_en < NOW() - INTERVAL '1 day'
         AND (bloqueada_hasta IS NULL OR bloqueada_hasta <= NOW())`,
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
    [usuarioId, nombre.trim()],
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
    [usuarioId, tokenHash, DURACION_SESION_DIAS],
  );

  return { token, expiraEn: resultado.rows[0].expira_en };
}

async function obtenerUsuarioPorToken(token) {
  const resultado = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.estado, u.piloto_inicio_en
     FROM sesiones s
     JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = $1 AND s.expira_en > NOW()`,
    [hashToken(token)],
  );

  return resultado.rows[0] || null;
}

async function eliminarDatosPilotoUsuario(usuarioId) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('DELETE FROM aceptaciones_legales WHERE usuario_id = $1', [usuarioId]);
    const resultado = await cliente.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [
      usuarioId,
    ]);
    await cliente.query('COMMIT');
    return resultado.rowCount > 0;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function eliminarDatosPilotoVencidos() {
  if (!PILOTO_ACTIVO) return 0;
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const expirados = await cliente.query(
      `SELECT id FROM usuarios
       WHERE rol NOT IN ('admin', 'superadmin')
         AND piloto_inicio_en <= NOW() - ($1 * INTERVAL '1 day')
       FOR UPDATE SKIP LOCKED`,
      [DURACION_PILOTO_DIAS],
    );
    const ids = expirados.rows.map(({ id }) => id);
    if (ids.length) {
      await cliente.query(
        `UPDATE eliminaciones_cuenta SET estado = 'cancelada', cancelada_en = NOW()
         WHERE usuario_id = ANY($1::integer[]) AND estado = 'programada'`,
        [ids],
      );
      await cliente.query(
        'DELETE FROM aceptaciones_legales WHERE usuario_id = ANY($1::integer[])',
        [ids],
      );
      await cliente.query('DELETE FROM usuarios WHERE id = ANY($1::integer[])', [ids]);
    }
    await cliente.query(
      `DELETE FROM aceptaciones_legales
       WHERE aceptado_en <= NOW() - ($1 * INTERVAL '1 day')`,
      [DURACION_PILOTO_DIAS],
    );
    await cliente.query(
      `DELETE FROM intentos_login
       WHERE ventana_iniciada_en < NOW() - INTERVAL '1 day'
         AND (bloqueada_hasta IS NULL OR bloqueada_hasta <= NOW())`,
    );
    await cliente.query('COMMIT');
    return ids.length;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function cerrarSesion(token) {
  await pool.query('DELETE FROM sesiones WHERE token_hash = $1', [hashToken(token)]);
}

async function eliminarCuenta(usuarioId, password) {
  const resultado = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [
    usuarioId,
  ]);
  const usuario = resultado.rows[0];
  if (!usuario || !(await verificarPassword(usuario.password_hash, password))) return false;

  const eliminacion = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [
    usuarioId,
  ]);
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
    [usuarioId, limite],
  );

  return resultado.rows[0];
}

async function obtenerTotalMensajes(usuarioId) {
  const resultado = await pool.query(
    `SELECT COALESCE(SUM(cantidad), 0)::integer AS total
     FROM uso_asistente
     WHERE usuario_id = $1`,
    [usuarioId],
  );
  return resultado.rows[0].total;
}

module.exports = {
  registrarUsuario,
  registrarUsuarioPendiente,
  verificarCorreoPendiente,
  reenviarCodigoVerificacionCorreo,
  iniciarSesion,
  crearEvidenciaLegal,
  obtenerBloqueoLogin,
  registrarIntentoLoginPorIp,
  registrarIntentoRegistroPorIp,
  registrarIntentoLoginFallido,
  limpiarIntentosLogin,
  actualizarNombre,
  crearSesion,
  obtenerUsuarioPorToken,
  eliminarDatosPilotoUsuario,
  eliminarDatosPilotoVencidos,
  cerrarSesion,
  eliminarCuenta,
  obtenerCuotaDiaria,
  obtenerTotalMensajes,
  verificarPassword,
};

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');

// Estas pruebas fijan la base de datos y solo deben ejecutarse contra codexia_test.
require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'codexia_test';
process.env.ASISTENTE_LIMITE_DIARIO = '2';

if (process.env.DB_NAME !== 'codexia_test') {
  throw new Error('Las pruebas de base de datos solo pueden usar codexia_test.');
}

const pool = require('../src/database/conexion');
const usuariosService = require('../src/services/usuarios.servicio');
const conversacionesService = require('../src/services/conversaciones.servicio');
const asistenteService = require('../src/services/asistente.servicio');
const adminService = require('../src/services/admin.servicio');
const { crearClaveHashLimiteLogin } = require('../src/config/limites-login.config');

let usuarioId;
let otroUsuarioId;

before(async () => {
  const marca = randomUUID();
  const usuarios = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash)
     VALUES ('Pruebas integración', $1, 'hash-no-utilizado'),
            ('Otro usuario de prueba', $2, 'hash-no-utilizado')
     RETURNING id`,
    [`integracion-${marca}@example.test`, `integracion-otro-${marca}@example.test`],
  );
  usuarioId = usuarios.rows[0].id;
  otroUsuarioId = usuarios.rows[1].id;
});

after(async () => {
  if (usuarioId && otroUsuarioId) {
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1::integer[])', [
      [usuarioId, otroUsuarioId],
    ]);
  }
  await pool.end();
});

test('una sesión se guarda como hash y puede revocarse', async () => {
  const sesion = await usuariosService.crearSesion(usuarioId);
  const usuario = await usuariosService.obtenerUsuarioPorToken(sesion.token);
  const guardada = await pool.query('SELECT token_hash FROM sesiones WHERE usuario_id = $1', [
    usuarioId,
  ]);

  assert.equal(usuario.id, usuarioId);
  assert.equal(usuario.correo.startsWith('integracion-'), true);
  assert.equal(guardada.rowCount, 1);
  assert.equal(guardada.rows[0].token_hash.length, 64);
  assert.notEqual(guardada.rows[0].token_hash, sesion.token);

  await usuariosService.cerrarSesion(sesion.token);
  assert.equal(await usuariosService.obtenerUsuarioPorToken(sesion.token), null);

  const revocada = await pool.query('SELECT token_hash FROM sesiones WHERE usuario_id = $1', [
    usuarioId,
  ]);
  assert.equal(revocada.rowCount, 0);
});

test('el registro guarda la cuenta, las aceptaciones y la sesión en PostgreSQL', async () => {
  const correo = `registro-${randomUUID()}@example.test`;
  const evidenciaLegal = {
    mecanismo: 'registro',
    ip: '127.0.0.1',
    agenteUsuario: 'Prueba automatizada de integración',
  };
  const registro = await usuariosService.registrarUsuario({
    nombre: 'Cuenta de integración',
    correo,
    password: 'ClaveDePrueba123',
    evidenciaLegal,
  });

  try {
    assert.equal(registro.usuario.correo, correo);
    assert.equal(registro.usuario.rol, 'cliente');
    assert.ok(registro.sesion.token);

    const aceptaciones = await pool.query(
      `SELECT documento, mecanismo, ip, agente_usuario
       FROM aceptaciones_legales
       WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    assert.equal(aceptaciones.rowCount, 2);
    assert.ok(aceptaciones.rows.every((fila) => fila.mecanismo === 'registro'));
    assert.ok(aceptaciones.rows.every((fila) => fila.ip === '127.0.0.1'));

    const usuarioAutenticado = await usuariosService.obtenerUsuarioPorToken(registro.sesion.token);
    assert.equal(usuarioAutenticado.id, registro.usuario.id);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [registro.usuario.id]);
  }
});

test('el registro revierte la cuenta si no puede guardar la evidencia legal', async () => {
  const correo = `registro-fallido-${randomUUID()}@example.test`;

  await assert.rejects(
    usuariosService.registrarUsuario({
      nombre: 'Registro que debe revertirse',
      correo,
      password: 'ClaveDePrueba123',
      evidenciaLegal: {
        mecanismo: 'registro',
        ip: 'esto-no-es-una-ip',
        agenteUsuario: 'Prueba de rollback',
      },
    }),
  );

  const usuario = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
  assert.equal(usuario.rowCount, 0);
});

test('registro pendiente verifica el código, registra los consentimientos y abre sesión', async () => {
  const correo = `verificacion-${randomUUID()}@example.test`;
  const registro = await usuariosService.registrarUsuarioPendiente({
    nombre: 'Cuenta pendiente',
    correo: correo.toUpperCase(),
    password: 'ClaveSegura123',
    evidenciaLegal: {
      mecanismo: 'registro',
      ip: '127.0.0.1',
      agenteUsuario: 'Prueba de verificación de correo',
    },
  });

  try {
    assert.equal(registro.usuario.correo, correo);
    assert.equal(registro.codigo.length, 6);

    const antes = await pool.query(
      `SELECT u.correo_verificado, c.codigo_hash, c.intentos
       FROM usuarios u
       JOIN codigos_verificacion_correo c ON c.usuario_id = u.id
       WHERE u.id = $1`,
      [registro.usuario.id],
    );
    assert.equal(antes.rows[0].correo_verificado, false);
    assert.equal(antes.rows[0].codigo_hash.length, 64);
    assert.notEqual(antes.rows[0].codigo_hash.trim(), registro.codigo);
    assert.equal(antes.rows[0].intentos, 0);

    const aceptaciones = await pool.query(
      `SELECT documento, mecanismo FROM aceptaciones_legales WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    assert.equal(aceptaciones.rowCount, 2);
    assert.ok(aceptaciones.rows.every((fila) => fila.mecanismo === 'registro'));

    const resultadoIncorrecto = await usuariosService.verificarCorreoPendiente({
      correo: correo.toUpperCase(),
      codigo: registro.codigo === '000000' ? '000001' : '000000',
    });
    assert.equal(resultadoIncorrecto.verificado, false);
    assert.equal(resultadoIncorrecto.intentosRestantes, 4);

    const verificacion = await usuariosService.verificarCorreoPendiente({
      correo: correo.toUpperCase(),
      codigo: registro.codigo,
    });
    assert.equal(verificacion.verificado, true);
    assert.equal(verificacion.usuario.correo, correo);

    const usuarioVerificado = await pool.query(
      `SELECT correo_verificado FROM usuarios WHERE id = $1`,
      [registro.usuario.id],
    );
    const codigoEliminado = await pool.query(
      `SELECT usuario_id FROM codigos_verificacion_correo WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    assert.equal(usuarioVerificado.rows[0].correo_verificado, true);
    assert.equal(codigoEliminado.rowCount, 0);
    assert.ok(verificacion.sesion.token);
    assert.equal(
      (await usuariosService.obtenerUsuarioPorToken(verificacion.sesion.token)).id,
      registro.usuario.id,
    );
  } finally {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [registro.usuario.id]);
  }
});

test('el código vence y cinco intentos incorrectos impiden verificar la cuenta', async () => {
  const correo = `codigo-vencimiento-${randomUUID()}@example.test`;
  const registro = await usuariosService.registrarUsuarioPendiente({
    nombre: 'Cuenta sin verificar',
    correo,
    password: 'ClaveSegura123',
    evidenciaLegal: { mecanismo: 'registro', ip: '127.0.0.1', agenteUsuario: 'Prueba' },
  });

  try {
    await pool.query(
      `UPDATE codigos_verificacion_correo SET vence_en = NOW() - INTERVAL '1 second'
       WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    const vencido = await usuariosService.verificarCorreoPendiente({
      correo,
      codigo: registro.codigo,
    });
    assert.equal(vencido.verificado, false);
    assert.equal(vencido.intentosRestantes, 0);

    await pool.query(
      `UPDATE codigos_verificacion_correo
       SET vence_en = NOW() + INTERVAL '10 minutes', intentos = 0
       WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    const codigoIncorrecto = registro.codigo === '999999' ? '999998' : '999999';

    for (const intentosRestantes of [4, 3, 2, 1, 0]) {
      const intento = await usuariosService.verificarCorreoPendiente({
        correo,
        codigo: codigoIncorrecto,
      });
      assert.equal(intento.verificado, false);
      assert.equal(intento.intentosRestantes, intentosRestantes);
    }

    const agotado = await usuariosService.verificarCorreoPendiente({
      correo,
      codigo: registro.codigo,
    });
    assert.equal(agotado.verificado, false);
    assert.equal(agotado.intentosRestantes, 0);

    const usuario = await pool.query(
      `SELECT correo_verificado FROM usuarios WHERE id = $1`,
      [registro.usuario.id],
    );
    assert.equal(usuario.rows[0].correo_verificado, false);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [registro.usuario.id]);
  }
});

test('reenviar el código respeta el intervalo y reemplaza el código anterior', async () => {
  const correo = `codigo-reenvio-${randomUUID()}@example.test`;
  const registro = await usuariosService.registrarUsuarioPendiente({
    nombre: 'Cuenta con reenvío',
    correo,
    password: 'ClaveSegura123',
    evidenciaLegal: { mecanismo: 'registro', ip: '127.0.0.1', agenteUsuario: 'Prueba' },
  });

  try {
    const espera = await usuariosService.reenviarCodigoVerificacionCorreo(correo);
    assert.equal(espera.enviado, false);
    assert.ok(espera.reintentarEn > 0);

    await pool.query(
      `UPDATE codigos_verificacion_correo
       SET reenviar_despues_en = NOW() - INTERVAL '1 second'
       WHERE usuario_id = $1`,
      [registro.usuario.id],
    );
    const reenvio = await usuariosService.reenviarCodigoVerificacionCorreo(correo);
    assert.equal(reenvio.enviado, true);
    assert.equal(reenvio.codigo.length, 6);
    assert.notEqual(reenvio.codigo, registro.codigo);

    const codigoAnterior = await usuariosService.verificarCorreoPendiente({
      correo,
      codigo: registro.codigo,
    });
    assert.equal(codigoAnterior.verificado, false);
    assert.equal(codigoAnterior.intentosRestantes, 4);

    const codigoNuevo = await usuariosService.verificarCorreoPendiente({
      correo,
      codigo: reenvio.codigo,
    });
    assert.equal(codigoNuevo.verificado, true);
    assert.equal(codigoNuevo.usuario.correo, correo);
  } finally {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [registro.usuario.id]);
  }
});

test('el bloqueo de login escala de 15 minutos a 30, 60 y 1440 minutos', async () => {
  const { createHash } = require('node:crypto');
  const claveHash = createHash('sha256').update(randomUUID()).digest('hex');

  try {
    const duracionesEsperadas = [900, 1800, 3600, 86400];

    for (const duracionSegundos of duracionesEsperadas) {
      const primerIntento = await usuariosService.registrarIntentoLoginFallido(claveHash);
      const segundoIntento = await usuariosService.registrarIntentoLoginFallido(claveHash);
      const tercerIntento = await usuariosService.registrarIntentoLoginFallido(claveHash);

      assert.equal(primerIntento.restantes, 2);
      assert.equal(segundoIntento.restantes, 1);
      assert.equal(tercerIntento.restantes, 0);
      assert.equal(tercerIntento.nivelBloqueo, duracionesEsperadas.indexOf(duracionSegundos) + 1);
      assert.ok(Math.abs(tercerIntento.segundos - duracionSegundos) <= 1);
      assert.ok((await usuariosService.obtenerBloqueoLogin(claveHash)) > 0);

      // Avanza el reloj de la prueba al vencimiento del bloqueo, sin esperar en tiempo real.
      await pool.query(
        `UPDATE intentos_login
         SET bloqueada_hasta = NOW() - INTERVAL '1 second'
         WHERE clave_hash = $1`,
        [claveHash],
      );
    }
  } finally {
    await usuariosService.limpiarIntentosLogin(claveHash);
  }
});

test('la confirmación de contraseña admin bloquea tras tres fallos y escala los plazos', async () => {
  const correo = `admin-pruebas-${randomUUID()}@example.test`;
  const passwordCorrecta = 'AdminPruebaSegura123';
  const passwordHash = await argon2.hash(passwordCorrecta, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const insercion = await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
     VALUES ('Admin de integración', $1, $2, 'admin', 'activo')
     RETURNING id`,
    [correo, passwordHash],
  );
  const adminId = insercion.rows[0].id;
  const claveHash = crearClaveHashLimiteLogin('verificacion-password-admin', adminId);
  const duracionesEsperadas = [900, 1800, 3600, 86400];

  try {
    for (let nivel = 0; nivel < duracionesEsperadas.length; nivel += 1) {
      for (let intento = 1; intento <= 3; intento += 1) {
        await assert.rejects(
          adminService.verificarPasswordAdmin(adminId, 'ContraseñaIncorrecta123'),
          (error) => {
            const ultimoIntento = intento === 3;
            assert.equal(
              error.status,
              ultimoIntento ? 429 : 403,
              `nivel ${nivel + 1}, intento ${intento}`,
            );
            assert.equal(error.intentosRestantes, ultimoIntento ? 0 : 3 - intento);
            if (ultimoIntento) {
              assert.ok(
                Math.abs(error.reintentarEn - duracionesEsperadas[nivel]) <= 1,
              );
            }
            return true;
          },
        );
      }

      await pool.query(
        `UPDATE intentos_login
         SET bloqueada_hasta = NOW() - INTERVAL '1 second'
         WHERE clave_hash = $1`,
        [claveHash],
      );
    }

    assert.equal(await adminService.verificarPasswordAdmin(adminId, passwordCorrecta), true);
    assert.equal(await usuariosService.obtenerBloqueoLogin(claveHash), 0);
  } finally {
    await usuariosService.limpiarIntentosLogin(claveHash);
    await pool.query('DELETE FROM usuarios WHERE id = $1', [adminId]);
  }
});

test('las conversaciones respetan propietario, cambios y borrado en cascada', async () => {
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  const renombrada = await conversacionesService.renombrarConversacion(
    usuarioId,
    conversacion.id,
    'Prueba de persistencia',
  );

  assert.equal(renombrada.titulo, 'Prueba de persistencia');
  assert.equal(
    await conversacionesService.renombrarConversacion(
      otroUsuarioId,
      conversacion.id,
      'Acceso ajeno',
    ),
    null,
  );

  const fijada = await conversacionesService.fijarConversacion(usuarioId, conversacion.id, true);
  assert.equal(fijada.fijada, true);

  await pool.query(
    `INSERT INTO chats (conversacion_id, rol, contenido)
     VALUES ($1, 'usuario', 'mensaje de integración')`,
    [conversacion.id],
  );
  assert.equal(await conversacionesService.eliminarConversacion(usuarioId, conversacion.id), true);

  const mensajesRestantes = await pool.query('SELECT id FROM chats WHERE conversacion_id = $1', [
    conversacion.id,
  ]);
  assert.equal(mensajesRestantes.rowCount, 0);
});

test('la conversación carga mensajes por páginas antiguas sin duplicar ni omitir filas', async () => {
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  await pool.query(
    `INSERT INTO chats (conversacion_id, rol, contenido)
     SELECT $1,
            CASE WHEN numero % 2 = 0 THEN 'asistente' ELSE 'usuario' END,
            'mensaje-' || numero
     FROM generate_series(1, 113) AS numero`,
    [conversacion.id],
  );

  const primera = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id);
  const segunda = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id, {
    antesDeId: primera.cursorAnterior,
  });
  const tercera = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id, {
    antesDeId: segunda.cursorAnterior,
  });
  const todas = [...primera.mensajes, ...segunda.mensajes, ...tercera.mensajes];

  assert.equal(primera.mensajes.length, 50);
  assert.equal(primera.mensajes[0].contenido, 'mensaje-64');
  assert.equal(primera.mensajes.at(-1).contenido, 'mensaje-113');
  assert.equal(primera.hayMasMensajes, true);
  assert.equal(segunda.mensajes.length, 50);
  assert.equal(segunda.hayMasMensajes, true);
  assert.equal(tercera.mensajes.length, 13);
  assert.equal(tercera.mensajes[0].contenido, 'mensaje-1');
  assert.equal(tercera.hayMasMensajes, false);
  assert.equal(new Set(todas.map((mensaje) => mensaje.id)).size, 113);
  assert.equal(await conversacionesService.obtenerConversacion(otroUsuarioId, conversacion.id), null);
});

test('procesar un mensaje persiste ambos turnos y un reintento no duplica uso', async (t) => {
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  const clientMessageId = randomUUID();
  let llamadasIA = 0;

  t.mock.method(asistenteService, 'obtenerRespuestaGroq', async () => {
    llamadasIA += 1;
    return 'Respuesta integrada';
  });
  t.mock.method(asistenteService, 'generarTituloConversacion', async () => 'Título de prueba');

  const solicitud = {
    usuarioId,
    conversacionId: conversacion.id,
    clientMessageId,
    mensaje: 'Ayúdame con una prueba',
  };
  const primera = await conversacionesService.procesarMensaje(solicitud);
  const repetida = await conversacionesService.procesarMensaje(solicitud);
  const detalle = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id);
  const total = await usuariosService.obtenerTotalMensajes(usuarioId);

  assert.equal(primera.mensaje, 'Respuesta integrada');
  assert.equal(repetida.repetido, true);
  assert.equal(repetida.mensaje, 'Respuesta integrada');
  assert.equal(llamadasIA, 1);
  assert.equal(total, 1);
  assert.equal(detalle.mensajes.length, 2);
  assert.equal(detalle.mensajes[0].rol, 'usuario');
  assert.equal(detalle.mensajes[1].rol, 'asistente');
});

test('la transmisión progresiva guarda la respuesta completa y reserva una sola cuota', async (t) => {
  await pool.query('DELETE FROM uso_asistente WHERE usuario_id = $1', [usuarioId]);
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  const fragmentos = [];
  t.mock.method(asistenteService, 'transmitirRespuestaGroq', async (mensaje, historial, opciones) => {
    assert.equal(mensaje, 'Prueba de streaming');
    assert.deepEqual(historial, []);
    await opciones.onToken('Respuesta ');
    await opciones.onToken('progresiva');
    return 'Respuesta progresiva';
  });
  t.mock.method(asistenteService, 'generarTituloConversacion', async () => 'Título progresivo');

  const resultado = await conversacionesService.procesarMensaje({
    usuarioId,
    conversacionId: conversacion.id,
    clientMessageId: randomUUID(),
    mensaje: 'Prueba de streaming',
    signal: new AbortController().signal,
    onToken: async (fragmento) => fragmentos.push(fragmento),
  });
  const detalle = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id);
  const cuota = await usuariosService.obtenerCuotaDiaria(usuarioId, 2);

  assert.equal(resultado.mensaje, 'Respuesta progresiva');
  assert.deepEqual(fragmentos, ['Respuesta ', 'progresiva']);
  assert.equal(detalle.mensajes.length, 2);
  assert.equal(detalle.mensajes[0].rol, 'usuario');
  assert.equal(detalle.mensajes[1].contenido, 'Respuesta progresiva');
  assert.equal(cuota.usado, 1);
});

test('si falla una transmisión, se borran el turno incompleto y la cuota reservada', async (t) => {
  await pool.query('DELETE FROM uso_asistente WHERE usuario_id = $1', [usuarioId]);
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  const fragmentos = [];
  t.mock.method(asistenteService, 'transmitirRespuestaGroq', async (mensaje, historial, opciones) => {
    await opciones.onToken('Fragmento que no se debe guardar');
    throw new Error('Fallo de transmisión simulado');
  });

  await assert.rejects(
    conversacionesService.procesarMensaje({
      usuarioId,
      conversacionId: conversacion.id,
      clientMessageId: randomUUID(),
      mensaje: 'Prueba fallida',
      signal: new AbortController().signal,
      onToken: async (fragmento) => fragmentos.push(fragmento),
    }),
    /Fallo de transmisión simulado/,
  );

  const detalle = await conversacionesService.obtenerConversacion(usuarioId, conversacion.id);
  const cuota = await usuariosService.obtenerCuotaDiaria(usuarioId, 2);
  assert.deepEqual(fragmentos, ['Fragmento que no se debe guardar']);
  assert.equal(detalle.mensajes.length, 0);
  assert.equal(cuota.usado, 0);
});

test('la cuota diaria es transaccional y un fallo de IA devuelve la cuota reservada', async (t) => {
  // Cada caso comienza con una cuota limpia aunque las pruebas compartan el usuario temporal.
  await pool.query('DELETE FROM uso_asistente WHERE usuario_id = $1', [usuarioId]);
  const conversacion = await conversacionesService.crearConversacion(usuarioId);
  const primerMensaje = {
    usuarioId,
    conversacionId: conversacion.id,
    clientMessageId: randomUUID(),
    mensaje: 'Primer mensaje',
  };

  let fallarIA = false;
  t.mock.method(asistenteService, 'obtenerRespuestaGroq', async () => {
    if (fallarIA) throw new Error('Fallo de IA simulado');
    return 'Respuesta';
  });
  t.mock.method(asistenteService, 'generarTituloConversacion', async () => 'Título de cuota');

  const primero = await conversacionesService.procesarMensaje(primerMensaje);
  const segundo = await conversacionesService.procesarMensaje({
    ...primerMensaje,
    clientMessageId: randomUUID(),
    mensaje: 'Segundo mensaje',
  });
  const excedido = await conversacionesService.procesarMensaje({
    ...primerMensaje,
    clientMessageId: randomUUID(),
    mensaje: 'Tercer mensaje',
  });

  assert.equal(primero.cuota.restante, 1);
  assert.equal(segundo.cuota.restante, 0);
  assert.equal(excedido.limiteAlcanzado, true);
  assert.equal(excedido.cuota.usado, 2);

  const otraConversacion = await conversacionesService.crearConversacion(usuarioId);
  await pool.query('DELETE FROM uso_asistente WHERE usuario_id = $1', [usuarioId]);
  const antesDelFallo = await usuariosService.obtenerTotalMensajes(usuarioId);
  fallarIA = true;

  await assert.rejects(
    conversacionesService.procesarMensaje({
      usuarioId,
      conversacionId: otraConversacion.id,
      clientMessageId: randomUUID(),
      mensaje: 'Debe reembolsar el uso',
    }),
    /Fallo de IA simulado/,
  );

  const despuesDelFallo = await usuariosService.obtenerTotalMensajes(usuarioId);
  const cuotaActual = await usuariosService.obtenerCuotaDiaria(usuarioId, 2);
  const mensajesFallidos = await conversacionesService.obtenerConversacion(
    usuarioId,
    otraConversacion.id,
  );

  assert.equal(despuesDelFallo, antesDelFallo);
  assert.equal(cuotaActual.usado, 0);
  assert.equal(mensajesFallidos.mensajes.length, 0);
});

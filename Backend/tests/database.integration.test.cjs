const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { randomUUID } = require('node:crypto');

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

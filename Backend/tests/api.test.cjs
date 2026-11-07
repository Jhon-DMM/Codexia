const assert = require('node:assert/strict');
const { after, before, mock, test } = require('node:test');

// These tests replace the data services, so they never connect to PostgreSQL or Groq.
process.env.NODE_ENV = 'test';
process.env.PILOTO_ACTIVO = 'true';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'codexia_tests_only';
process.env.DB_USER = 'codexia_tests_only';
process.env.DB_PASSWORD = 'not-used-by-these-tests';
process.env.GROQ_API_KEY = 'test-key-not-used';
process.env.GROQ_MODEL = 'test-model-not-used';

const app = require('../src/app');
const usuariosService = require('../src/services/usuarios.servicio');
const conversacionesService = require('../src/services/conversaciones.servicio');
const soporteService = require('../src/services/soporte.servicio');
const adminService = require('../src/services/admin.servicio');

let server;
let apiUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;

  const cerrado = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections();
  await cerrado;
});

async function solicitar(ruta, { metodo = 'GET', cuerpo, cookie, accept } = {}) {
  const headers = {};

  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (accept) headers.Accept = accept;

  return fetch(`${apiUrl}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

function simularSesion(t, usuario, token = 'token-de-prueba') {
  mock.method(usuariosService, 'obtenerUsuarioPorToken', async (tokenRecibido) => {
    assert.equal(tokenRecibido, token);
    return usuario;
  });

  return `codexia_session=${token}`;
}

test('el login rechaza credenciales incompletas antes de consultar servicios', async () => {
  const respuesta = await solicitar('/api/usuarios/login', {
    metodo: 'POST',
    cuerpo: { correo: '', password: '' },
  });

  assert.equal(respuesta.status, 400);
  assert.match((await respuesta.json()).mensaje, /obligatorios/i);
});

test('el login fallido registra el intento y responde con intentos restantes', async (t) => {
  mock.method(usuariosService, 'registrarIntentoLoginPorIp', async () => ({
    limitado: false,
    reintentarEn: 0,
  }));
  mock.method(usuariosService, 'obtenerBloqueoLogin', async () => 0);
  mock.method(usuariosService, 'iniciarSesion', async () => null);
  mock.method(usuariosService, 'registrarIntentoLoginFallido', async () => ({
    segundos: 0,
    restantes: 2,
  }));

  const respuesta = await solicitar('/api/usuarios/login', {
    metodo: 'POST',
    cuerpo: { correo: 'persona@example.test', password: 'Incorrecta123' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 401);
  assert.equal(resultado.intentosRestantes, 2);
  assert.match(resultado.mensaje, /no son correctos/i);
});

test('el tercer intento fallido bloquea el login y devuelve la espera', async (t) => {
  mock.method(usuariosService, 'registrarIntentoLoginPorIp', async () => ({
    limitado: false,
    reintentarEn: 0,
  }));
  mock.method(usuariosService, 'obtenerBloqueoLogin', async () => 0);
  mock.method(usuariosService, 'iniciarSesion', async () => null);
  mock.method(usuariosService, 'registrarIntentoLoginFallido', async () => ({
    segundos: 900,
    restantes: 0,
  }));

  const respuesta = await solicitar('/api/usuarios/login', {
    metodo: 'POST',
    cuerpo: { correo: 'persona@example.test', password: 'Incorrecta123' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 429);
  assert.equal(resultado.intentosRestantes, 0);
  assert.equal(resultado.reintentarEn, 900);
});

test('el login correcto crea una cookie HttpOnly y devuelve la cuenta', async (t) => {
  const usuario = {
    id: 41,
    nombre: 'Ada Lovelace',
    correo: 'ada@example.test',
    rol: 'cliente',
    piloto_inicio_en: new Date().toISOString(),
  };

  mock.method(usuariosService, 'registrarIntentoLoginPorIp', async () => ({
    limitado: false,
    reintentarEn: 0,
  }));
  mock.method(usuariosService, 'obtenerBloqueoLogin', async () => 0);
  mock.method(usuariosService, 'iniciarSesion', async () => usuario);
  mock.method(usuariosService, 'limpiarIntentosLogin', async () => {});
  mock.method(usuariosService, 'crearSesion', async () => ({
    token: 'sesion-de-prueba',
    expiraEn: new Date(Date.now() + 60_000).toISOString(),
  }));

  const respuesta = await solicitar('/api/usuarios/login', {
    metodo: 'POST',
    cuerpo: { correo: usuario.correo, password: 'Correcta123' },
  });
  const resultado = await respuesta.json();
  const cookie = respuesta.headers.get('set-cookie') || '';

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.usuario.correo, usuario.correo);
  assert.match(cookie, /codexia_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('una cuenta se registra solo después de validar datos y consentimientos', async (t) => {
  const usuario = {
    id: 42,
    nombre: 'Grace Hopper',
    correo: 'grace@example.test',
    rol: 'cliente',
    piloto_inicio_en: new Date().toISOString(),
  };

  mock.method(usuariosService, 'registrarIntentoRegistroPorIp', async () => ({
    limitado: false,
    reintentarEn: 0,
  }));
  mock.method(usuariosService, 'registrarUsuarioPendiente', async () => ({
    usuario,
    codigo: '123456',
  }));

  const respuesta = await solicitar('/api/usuarios/registro', {
    metodo: 'POST',
    cuerpo: {
      nombre: usuario.nombre,
      correo: usuario.correo,
      password: 'Segura123',
      aceptaTerminos: 'true',
      aceptaPrivacidad: 'true',
      confirmaMayorEdad: 'true',
    },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 202);
  assert.equal(resultado.requiereVerificacion, true);
  assert.equal(resultado.correo, usuario.correo);
  assert.equal(respuesta.headers.get('set-cookie'), null);
});

test('la verificación rechaza códigos con formato incorrecto sin consultar el servicio', async (t) => {
  const verificar = mock.method(usuariosService, 'verificarCorreoPendiente', async () => {
    throw new Error('No debería consultar un código con formato inválido');
  });

  const respuesta = await solicitar('/api/usuarios/registro/verificar-correo', {
    metodo: 'POST',
    cuerpo: { correo: 'persona@example.test', codigo: '12ab' },
  });

  assert.equal(respuesta.status, 400);
  assert.equal(verificar.mock.callCount(), 0);
  assert.equal(respuesta.headers.get('set-cookie'), null);
});

test('un código correcto verifica la cuenta y crea una sesión segura', async (t) => {
  const usuario = {
    id: 43,
    nombre: 'Ada Lovelace',
    correo: 'ada@example.test',
    rol: 'cliente',
    piloto_inicio_en: new Date().toISOString(),
  };
  mock.method(usuariosService, 'verificarCorreoPendiente', async (datos) => {
    assert.deepEqual(datos, { correo: usuario.correo, codigo: '123456' });
    return {
      verificado: true,
      usuario,
      sesion: {
        token: 'sesion-verificada-de-prueba',
        expiraEn: new Date(Date.now() + 60_000).toISOString(),
      },
    };
  });

  const respuesta = await solicitar('/api/usuarios/registro/verificar-correo', {
    metodo: 'POST',
    cuerpo: { correo: ' ADA@EXAMPLE.TEST ', codigo: '123456' },
  });
  const resultado = await respuesta.json();
  const cookie = respuesta.headers.get('set-cookie') || '';

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.usuario.correo, usuario.correo);
  assert.equal(resultado.usuario.piloto_activo, true);
  assert.match(cookie, /codexia_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('un código incorrecto no crea sesión y devuelve los intentos disponibles', async (t) => {
  mock.method(usuariosService, 'verificarCorreoPendiente', async () => ({
    verificado: false,
    intentosRestantes: 4,
  }));

  const respuesta = await solicitar('/api/usuarios/registro/verificar-correo', {
    metodo: 'POST',
    cuerpo: { correo: 'persona@example.test', codigo: '000000' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.equal(resultado.intentosRestantes, 4);
  assert.equal(respuesta.headers.get('set-cookie'), null);
});

test('reenviar código responde igual si no hay un registro pendiente', async (t) => {
  mock.method(usuariosService, 'registrarIntentoRegistroPorIp', async () => ({
    limitado: false,
    reintentarEn: 0,
  }));
  mock.method(usuariosService, 'reenviarCodigoVerificacionCorreo', async () => ({
    enviado: false,
    reintentarEn: 60,
  }));

  const respuesta = await solicitar('/api/usuarios/registro/reenviar-codigo', {
    metodo: 'POST',
    cuerpo: { correo: 'desconocido@example.test' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 202);
  assert.match(resultado.mensaje, /si hay una cuenta pendiente/i);
  assert.equal(respuesta.headers.get('set-cookie'), null);
});

test('las rutas privadas rechazan solicitudes sin sesión', async () => {
  const respuesta = await solicitar('/api/asistente/conversaciones');

  assert.equal(respuesta.status, 401);
  assert.match((await respuesta.json()).mensaje, /inicia sesión/i);
});

test('cerrar sesión revoca el token y elimina la cookie', async (t) => {
  const usuario = {
    id: 53,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  };
  const cookie = simularSesion(t, usuario, 'token-para-cerrar');
  mock.method(usuariosService, 'cerrarSesion', async () => {});

  const respuesta = await solicitar('/api/usuarios/logout', { metodo: 'POST', cookie });

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);
});

test('un usuario autenticado puede crear una conversación', async (t) => {
  const usuario = {
    id: 51,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  };
  const cookie = simularSesion(t, usuario);

  mock.method(conversacionesService, 'crearConversacion', async () => ({
    id: 'd9428888-122b-4b74-a6a5-08e8e2e2390a',
    creada_en: new Date().toISOString(),
  }));

  const respuesta = await solicitar('/api/asistente/conversaciones', {
    metodo: 'POST',
    cookie,
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 201);
  assert.equal(resultado.conversationId, 'd9428888-122b-4b74-a6a5-08e8e2e2390a');
});

test('un usuario autenticado puede enviar un mensaje y recibir su cuota', async (t) => {
  const usuario = {
    id: 54,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  };
  const cookie = simularSesion(t, usuario);
  const conversationId = 'd9428888-122b-4b74-a6a5-08e8e2e2390a';
  const clientMessageId = 'f4bfdfd1-e8c0-4558-a16c-10b0b0ecb7a7';

  mock.method(conversacionesService, 'procesarMensaje', async () => ({
    mensaje: 'Respuesta de prueba',
    cuota: { usado: 1, limite: 30, restante: 29 },
  }));

  const respuesta = await solicitar('/api/asistente', {
    metodo: 'POST',
    cookie,
    cuerpo: { conversationId, clientMessageId, mensaje: 'Hola' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.mensaje, 'Respuesta de prueba');
  assert.equal(resultado.cuota.restante, 29);
});

test('el límite diario del asistente se representa como HTTP 429', async (t) => {
  const cookie = simularSesion(t, {
    id: 55,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });

  mock.method(conversacionesService, 'procesarMensaje', async () => ({
    limiteAlcanzado: true,
    cuota: { usado: 30, limite: 30, restante: 0 },
  }));

  const respuesta = await solicitar('/api/asistente', {
    metodo: 'POST',
    cookie,
    cuerpo: {
      conversationId: 'd9428888-122b-4b74-a6a5-08e8e2e2390a',
      clientMessageId: 'f4bfdfd1-e8c0-4558-a16c-10b0b0ecb7a7',
      mensaje: 'Un mensaje adicional',
    },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 429);
  assert.equal(resultado.cuota.restante, 0);
});

test('un usuario puede enviar una solicitud de soporte con consentimiento', async (t) => {
  const usuario = {
    id: 56,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  };
  const cookie = simularSesion(t, usuario);

  mock.method(soporteService, 'crearSolicitud', async (usuarioId, datos) => ({
    id: 81,
    usuarioId,
    asunto: datos.asunto,
    estado: 'abierta',
  }));

  const respuesta = await solicitar('/api/usuarios/me/soporte', {
    metodo: 'POST',
    cookie,
    cuerpo: {
      categoria: 'general',
      asunto: 'Ayuda con la cuenta',
      mensaje: 'Necesito actualizar algunos datos.',
      aceptaPrivacidadSoporte: 'true',
    },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 201);
  assert.equal(resultado.solicitud.estado, 'abierta');
});

test('un usuario sin rol admin no puede acceder al panel administrativo', async (t) => {
  const cookie = simularSesion(t, {
    id: 52,
    nombre: 'Cliente',
    correo: 'cliente@example.test',
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });

  const respuesta = await solicitar('/api/admin/me', { cookie });

  assert.equal(respuesta.status, 403);
  assert.match((await respuesta.json()).mensaje, /no tienes permisos/i);
});

test('un administrador autenticado puede verificar su acceso al panel', async (t) => {
  const usuario = {
    id: 1,
    nombre: 'Administradora',
    correo: 'admin@example.test',
    rol: 'admin',
    estado: 'activo',
  };
  const cookie = simularSesion(t, usuario, 'token-admin-de-prueba');

  const respuesta = await solicitar('/api/admin/me', { cookie });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.usuario.rol, 'admin');
});

test('un administrador puede usar el asistente aunque el plazo del piloto haya vencido', async (t) => {
  const usuario = {
    id: 1,
    nombre: 'Administradora',
    correo: 'admin@example.test',
    rol: 'admin',
    estado: 'activo',
    piloto_inicio_en: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const cookie = simularSesion(t, usuario, 'token-admin-piloto-vencido');

  mock.method(conversacionesService, 'crearConversacion', async () => ({
    id: 'd9428888-122b-4b74-a6a5-08e8e2e2390a',
    creada_en: new Date().toISOString(),
  }));

  const respuesta = await solicitar('/api/asistente/conversaciones', {
    metodo: 'POST',
    cookie,
  });

  assert.equal(respuesta.status, 201);
});

test('un administrador puede responder una solicitud de soporte', async (t) => {
  const usuario = {
    id: 1,
    nombre: 'Administradora',
    correo: 'admin@example.test',
    rol: 'admin',
    estado: 'activo',
  };
  const cookie = simularSesion(t, usuario, 'token-admin-soporte');

  mock.method(adminService, 'responderSolicitudSoporte', async ({ id, respuesta: texto }) => ({
    id,
    respuesta: texto,
    estado: 'respondida',
  }));

  const respuesta = await solicitar('/api/admin/soporte/81', {
    metodo: 'PATCH',
    cookie,
    cuerpo: { respuesta: 'Ya actualizamos los datos.', estado: 'respondida' },
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.solicitud.estado, 'respondida');
  assert.equal(resultado.solicitud.respuesta, 'Ya actualizamos los datos.');
});

test('un error inesperado devuelve un mensaje seguro y registra el mismo identificador', async (t) => {
  const cookie = simularSesion(t, {
    id: 57,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });
  const registros = [];
  t.mock.method(conversacionesService, 'listarConversaciones', async () => {
    throw new Error('detalle interno que no debe llegar al cliente');
  });
  t.mock.method(console, 'error', (...argumentos) => registros.push(argumentos.join(' ')));

  const respuesta = await solicitar('/api/asistente/conversaciones', { cookie });
  const resultado = await respuesta.json();
  const requestId = respuesta.headers.get('x-request-id');

  assert.equal(respuesta.status, 500);
  assert.equal(resultado.codigo, 'ERROR_INTERNO');
  assert.match(resultado.mensaje, /no fue posible completar/i);
  assert.doesNotMatch(resultado.mensaje, /detalle interno/i);
  assert.ok(requestId);
  assert.equal(resultado.requestId, requestId);
  assert.ok(registros.some((registro) => registro.includes(requestId)));
  assert.ok(registros.some((registro) => registro.includes('detalle interno')));
});

test('una ruta API inexistente devuelve 404 con código y requestId', async () => {
  const respuesta = await solicitar('/api/ruta-que-no-existe');
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 404);
  assert.equal(resultado.codigo, 'RUTA_NO_ENCONTRADA');
  assert.equal(resultado.requestId, respuesta.headers.get('x-request-id'));
});

test('un JSON mal formado devuelve un error legible sin exponer detalles', async () => {
  const respuesta = await fetch(`${apiUrl}/api/usuarios/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"correo":',
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.match(resultado.mensaje, /formato.*no es válido/i);
  assert.equal(resultado.requestId, respuesta.headers.get('x-request-id'));
});

test('un cuerpo demasiado grande devuelve 413 con mensaje claro', async () => {
  const respuesta = await fetch(`${apiUrl}/api/usuarios/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dato: 'x'.repeat(33 * 1024) }),
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 413);
  assert.match(resultado.mensaje, /demasiado grande/i);
  assert.equal(resultado.requestId, respuesta.headers.get('x-request-id'));
});

test('un origen CORS no permitido recibe un mensaje seguro', async () => {
  const respuesta = await fetch(`${apiUrl}/api/usuarios/login`, {
    method: 'POST',
    headers: { Origin: 'https://origen-no-autorizado.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'persona@example.test', password: 'Clave123' }),
  });
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 403);
  assert.equal(resultado.codigo, 'ORIGEN_NO_PERMITIDO');
  assert.match(resultado.mensaje, /origen.*no está autorizado/i);
  assert.equal(resultado.requestId, respuesta.headers.get('x-request-id'));
});

test('el asistente transmite fragmentos y finaliza con cuota y estado del título', async (t) => {
  const cookie = simularSesion(t, {
    id: 58,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });
  const fragments = [];
  mock.method(conversacionesService, 'procesarMensaje', async ({ onToken, signal }) => {
    assert.equal(signal instanceof AbortSignal, true);
    await onToken('Respuesta ');
    fragments.push('Respuesta ');
    await onToken('progresiva');
    fragments.push('progresiva');
    return {
      mensaje: 'Respuesta progresiva',
      cuota: { usado: 2, limite: 30, restante: 28 },
      tituloPendiente: true,
    };
  });

  const respuesta = await solicitar('/api/asistente', {
    metodo: 'POST',
    cookie,
    accept: 'text/event-stream',
    cuerpo: {
      conversationId: 'd9428888-122b-4b74-a6a5-08e8e2e2390a',
      clientMessageId: 'f4bfdfd1-e8c0-4558-a16c-10b0b0ecb7a7',
      mensaje: 'Hola',
    },
  });
  const cuerpo = await respuesta.text();

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('content-type') || '', /text\/event-stream/i);
  assert.equal(fragments.join(''), 'Respuesta progresiva');
  assert.match(cuerpo, /event: token\ndata: \{"texto":"Respuesta "\}/);
  assert.match(cuerpo, /event: token\ndata: \{"texto":"progresiva"\}/);
  assert.match(cuerpo, /event: fin\ndata: .*"usado":2.*"tituloPendiente":true/);
});

test('un error después de iniciar la transmisión se envía como evento seguro', async (t) => {
  const cookie = simularSesion(t, {
    id: 59,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });
  const registros = [];
  mock.method(conversacionesService, 'procesarMensaje', async ({ onToken }) => {
    await onToken('Texto parcial');
    const error = new Error('Detalle privado del proveedor');
    error.status = 502;
    error.registrar = true;
    error.mensajePublico = 'El asistente no está disponible.';
    throw error;
  });
  mock.method(console, 'error', (...argumentos) => registros.push(argumentos.join(' ')));

  const respuesta = await solicitar('/api/asistente', {
    metodo: 'POST',
    cookie,
    accept: 'text/event-stream',
    cuerpo: {
      conversationId: 'd9428888-122b-4b74-a6a5-08e8e2e2390a',
      clientMessageId: 'f4bfdfd1-e8c0-4558-a16c-10b0b0ecb7a7',
      mensaje: 'Hola',
    },
  });
  const cuerpo = await respuesta.text();

  assert.equal(respuesta.status, 200);
  assert.match(cuerpo, /event: token/);
  assert.match(cuerpo, /event: error\ndata: .*El asistente no está disponible/);
  assert.doesNotMatch(cuerpo, /Detalle privado del proveedor/);
  assert.equal(registros.length, 1);
  assert.ok(registros[0].includes(respuesta.headers.get('x-request-id')));
});

test('la ruta de conversación acepta un cursor numérico para cargar mensajes anteriores', async (t) => {
  const conversacionId = 'd9428888-122b-4b74-a6a5-08e8e2e2390a';
  const cookie = simularSesion(t, {
    id: 60,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });
  mock.method(conversacionesService, 'obtenerConversacion', async (usuarioId, id, opciones) => {
    assert.equal(usuarioId, 60);
    assert.equal(id, conversacionId);
    assert.deepEqual(opciones, { antesDeId: 42 });
    return {
      id,
      mensajes: [{ id: 41, rol: 'usuario', contenido: 'Mensaje anterior' }],
      hayMasMensajes: true,
      cursorAnterior: 41,
    };
  });

  const respuesta = await solicitar(
    `/api/asistente/conversaciones/${conversacionId}?antesDe=42`,
    { cookie },
  );
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(resultado.conversacion.mensajes[0].id, 41);
  assert.equal(resultado.conversacion.hayMasMensajes, true);
  assert.equal(resultado.conversacion.cursorAnterior, 41);
});

test('la ruta rechaza un cursor de mensajes que no sea entero positivo', async (t) => {
  const conversacionId = 'd9428888-122b-4b74-a6a5-08e8e2e2390a';
  const cookie = simularSesion(t, {
    id: 61,
    rol: 'cliente',
    estado: 'activo',
    piloto_inicio_en: new Date().toISOString(),
  });
  const consulta = mock.method(conversacionesService, 'obtenerConversacion', async () => {
    throw new Error('No debe consultar la conversación con un cursor inválido');
  });

  const respuesta = await solicitar(
    `/api/asistente/conversaciones/${conversacionId}?antesDe=0`,
    { cookie },
  );
  const resultado = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.match(resultado.mensaje, /cursor.*no es válido/i);
  assert.equal(consulta.mock.callCount(), 0);
});

const usuariosService = require('../services/usuarios.servicio');
const { COOKIE_NAME, opcionesCookie, obtenerTokenSesion } = require('../config/sesion.config');
const { MENSAJE_PILOTO_FINALIZADO } = require('../config/piloto.config');
const { PILOTO_ACTIVO } = require('../config/piloto.config');
const { crearClaveHashLimiteLogin } = require('../config/limites-login.config');

const MAX_PASSWORD_BYTES = 1024;

function describirTiempoBloqueo(segundos) {
  const minutos = Math.ceil(segundos / 60);
  if (minutos >= 60) {
    const horas = Math.ceil(minutos / 60);
    return `${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }
  return `${minutos} min`;
}

async function registrarUsuario(req, res) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        mensaje:
          'El registro requiere configurar el envío de correo antes de habilitarse en producción.',
      });
    }

    const { nombre, correo, password } = req.body || {};

    if (
      typeof nombre !== 'string' ||
      typeof correo !== 'string' ||
      typeof password !== 'string' ||
      !nombre.trim() ||
      !correo.trim() ||
      !password
    ) {
      return res.status(400).json({
        mensaje: 'El nombre, el correo y la contraseña son obligatorios',
      });
    }

    if (req.body?.aceptaTerminos !== 'true' || req.body?.aceptaPrivacidad !== 'true') {
      return res.status(400).json({
        mensaje:
          'Debes aceptar los términos y autorizar el tratamiento de datos para crear la cuenta',
      });
    }

    if (req.body?.confirmaMayorEdad !== 'true') {
      return res
        .status(400)
        .json({ mensaje: 'La prueba piloto está limitada a personas de 18 años o más' });
    }

    const correoNormalizado = correo.trim().toLowerCase();

    const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoCorreo.test(correoNormalizado)) {
      return res.status(400).json({
        mensaje: 'El correo electrónico no tiene un formato válido',
      });
    }

    if (nombre.trim().length > 100) {
      return res.status(400).json({
        mensaje: 'El nombre no puede superar los 100 caracteres',
      });
    }

    if (correoNormalizado.length > 254) {
      return res.status(400).json({
        mensaje: 'El correo no puede superar los 254 caracteres',
      });
    }

    const passwordSegura =
      password.length >= 8 &&
      /\p{Lu}/u.test(password) &&
      /\p{Ll}/u.test(password) &&
      /\p{N}/u.test(password);
    if (!passwordSegura || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return res.status(400).json({
        mensaje:
          'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número, y no superar los 1024 bytes',
      });
    }

    const ipCliente = req.ip || req.socket?.remoteAddress || 'ip-desconocida';
    const limiteRegistro = await usuariosService.registrarIntentoRegistroPorIp(
      crearClaveHashLimiteLogin('registro-ip', ipCliente),
    );
    if (limiteRegistro.limitado) {
      res.set('Retry-After', String(limiteRegistro.reintentarEn));
      return res.status(429).json({
        codigo: 'LIMITE_REGISTRO_IP',
        mensaje:
          'Se alcanzó el límite temporal de creación de cuentas desde esta conexión. Inténtalo más tarde.',
        reintentarEn: limiteRegistro.reintentarEn,
      });
    }

    const { usuario, codigo } = await usuariosService.registrarUsuarioPendiente({
      nombre,
      correo: correoNormalizado,
      password,
      evidenciaLegal: usuariosService.crearEvidenciaLegal(req, 'registro'),
    });
    console.info(`[Codexia] Código local de verificación: ${codigo}`);

    return res.status(202).json({
      mensaje: 'Cuenta pendiente de verificación',
      requiereVerificacion: true,
      correo: usuario.correo,
      expiracionCodigoMinutos: 10,
      reintentarEn: 60,
    });
  } catch (error) {
    if (error.code === 'CORREO_DUPLICADO') {
      return res.status(409).json({
        mensaje: 'Este correo electrónico ya está registrado',
      });
    }

    throw error;
  }
}

async function verificarCorreoRegistro(req, res) {
  const { correo, codigo } = req.body || {};
  if (
    typeof correo !== 'string' ||
    !correo.trim() ||
    correo.trim().length > 254 ||
    typeof codigo !== 'string' ||
    !/^\d{6}$/.test(codigo)
  ) {
    return res
      .status(400)
      .json({ mensaje: 'Escribe un correo válido y el código de seis dígitos.' });
  }

  const resultado = await usuariosService.verificarCorreoPendiente({
    correo: correo.trim().toLowerCase(),
    codigo,
  });
  if (!resultado.verificado) {
    return res.status(400).json({
      codigo: 'CODIGO_VERIFICACION_INVALIDO',
      mensaje: 'El código no es correcto o venció. Puedes solicitar uno nuevo.',
      intentosRestantes: resultado.intentosRestantes,
    });
  }

  res.cookie(COOKIE_NAME, resultado.sesion.token, opcionesCookie());
  resultado.usuario.piloto_activo = PILOTO_ACTIVO;
  return res.json({
    mensaje: 'Correo verificado correctamente',
    usuario: resultado.usuario,
    expiraEn: resultado.sesion.expiraEn,
  });
}

async function reenviarCodigoRegistro(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      mensaje: 'El envío de correo todavía no está configurado en producción.',
    });
  }

  const { correo } = req.body || {};
  if (typeof correo !== 'string' || !correo.trim() || correo.trim().length > 254) {
    return res.status(400).json({ mensaje: 'Escribe el correo usado al crear la cuenta.' });
  }

  const ipCliente = req.ip || req.socket?.remoteAddress || 'ip-desconocida';
  const limite = await usuariosService.registrarIntentoRegistroPorIp(
    crearClaveHashLimiteLogin('registro-ip', ipCliente),
  );
  if (limite.limitado) {
    res.set('Retry-After', String(limite.reintentarEn));
    return res.status(429).json({
      mensaje: 'Se alcanzó el límite temporal de solicitudes. Inténtalo más tarde.',
      reintentarEn: limite.reintentarEn,
    });
  }

  const resultado = await usuariosService.reenviarCodigoVerificacionCorreo(correo);
  if (resultado.enviado && process.env.NODE_ENV !== 'production') {
    console.info(`[Codexia] Código local de verificación: ${resultado.codigo}`);
  }
  return res.status(202).json({
    mensaje: 'Si hay una cuenta pendiente para ese correo, enviaremos un nuevo código.',
    reintentarEn: 60,
  });
}

async function iniciarSesion(req, res) {
  const { correo, password } = req.body || {};
  if (typeof correo !== 'string' || typeof password !== 'string' || !correo.trim() || !password) {
    return res.status(400).json({ mensaje: 'El correo y la contraseña son obligatorios' });
  }
  if (correo.trim().length > 254) {
    return res.status(400).json({ mensaje: 'El correo no puede superar los 254 caracteres' });
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return res.status(400).json({ mensaje: 'La contraseña no puede superar los 1024 bytes' });
  }
  const correoNormalizado = correo.trim().toLowerCase();
  const ipCliente = req.ip || req.socket?.remoteAddress || 'ip-desconocida';
  const limiteIp = await usuariosService.registrarIntentoLoginPorIp(
    crearClaveHashLimiteLogin('login-ip', ipCliente),
  );
  if (limiteIp.limitado) {
    res.set('Retry-After', String(limiteIp.reintentarEn));
    return res.status(429).json({
      codigo: 'LIMITE_LOGIN_IP',
      mensaje:
        'Se recibieron demasiados intentos desde esta conexión. Espera antes de volver a intentarlo.',
      reintentarEn: limiteIp.reintentarEn,
    });
  }

  const claveIntentos = crearClaveHashLimiteLogin(
    'login-cuenta-ip',
    `${correoNormalizado}\0${ipCliente}`,
  );
  const segundosBloqueo = await usuariosService.obtenerBloqueoLogin(claveIntentos);
  if (segundosBloqueo > 0) {
    res.set('Retry-After', String(segundosBloqueo));
    return res.status(429).json({
      mensaje: `Se agotaron los 3 intentos. Prueba de nuevo en ${describirTiempoBloqueo(segundosBloqueo)}.`,
      intentosRestantes: 0,
      reintentarEn: segundosBloqueo,
    });
  }

  const usuario = await usuariosService.iniciarSesion({
    correo: correoNormalizado,
    password,
  });
  if (usuario?.pilotoFinalizado) {
    return res.status(410).json({ mensaje: MENSAJE_PILOTO_FINALIZADO });
  }
  if (usuario?.cuentaEliminada) {
    await usuariosService.limpiarIntentosLogin(claveIntentos);
    return res.status(410).json({
      codigo: 'CUENTA_ELIMINADA',
      mensaje: 'Esta cuenta fue eliminada por el equipo de Codexia.',
      eliminacion: usuario.cuentaEliminada,
    });
  }
  if (usuario?.cuentaSuspendida) {
    return res.status(403).json({
      codigo: 'CUENTA_SUSPENDIDA',
      mensaje: 'Esta cuenta está suspendida. Contacta con soporte.',
    });
  }
  if (usuario?.correoNoVerificado) {
    return res.status(403).json({
      codigo: 'CORREO_NO_VERIFICADO',
      mensaje: 'Confirma tu correo para poder iniciar sesión.',
    });
  }
  if (!usuario) {
    const intento = await usuariosService.registrarIntentoLoginFallido(claveIntentos);
    if (intento.segundos > 0) {
      res.set('Retry-After', String(intento.segundos));
      return res.status(429).json({
        mensaje: `Se agotaron los 3 intentos. Prueba de nuevo en ${describirTiempoBloqueo(intento.segundos)}.`,
        intentosRestantes: 0,
        reintentarEn: intento.segundos,
      });
    }
    return res.status(401).json({
      mensaje: `El correo o la contraseña no son correctos. Te quedan ${intento.restantes} ${intento.restantes === 1 ? 'intento' : 'intentos'}.`,
      intentosRestantes: intento.restantes,
    });
  }

  await usuariosService.limpiarIntentosLogin(claveIntentos);
  usuario.piloto_activo = PILOTO_ACTIVO;
  const sesion = await usuariosService.crearSesion(usuario.id);
  res.cookie(COOKIE_NAME, sesion.token, opcionesCookie());
  return res.json({ mensaje: 'Sesión iniciada', usuario, expiraEn: sesion.expiraEn });
}

async function cerrarSesion(req, res) {
  const token = req.tokenSesion || obtenerTokenSesion(req);
  if (token) await usuariosService.cerrarSesion(token);
  const { maxAge, ...opcionesBorrado } = opcionesCookie();
  res.clearCookie(COOKIE_NAME, opcionesBorrado);
  return res.json({ mensaje: 'Sesión cerrada' });
}

async function obtenerMiCuenta(req, res) {
  return res.json({ usuario: { ...req.usuario, piloto_activo: PILOTO_ACTIVO } });
}

async function actualizarMiNombre(req, res) {
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre || nombre.length > 100) {
    return res.status(400).json({ mensaje: 'El nombre debe tener entre 1 y 100 caracteres' });
  }

  const usuario = await usuariosService.actualizarNombre(req.usuario.id, nombre);
  if (!usuario) return res.status(404).json({ mensaje: 'No encontramos tu cuenta' });
  return res.json({ usuario });
}

async function eliminarMiCuenta(req, res) {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ mensaje: 'Escribe tu contraseña para confirmar la eliminación' });
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return res.status(400).json({ mensaje: 'La contraseña supera el límite permitido' });
  }

  const eliminada = await usuariosService.eliminarCuenta(req.usuario.id, password);
  if (!eliminada) return res.status(403).json({ mensaje: 'La contraseña no es correcta' });

  const { maxAge, ...opcionesBorrado } = opcionesCookie();
  res.clearCookie(COOKIE_NAME, opcionesBorrado);
  return res.json({ mensaje: 'La cuenta se eliminó correctamente' });
}

async function obtenerMiCuota(req, res) {
  const configurado = Number(process.env.ASISTENTE_LIMITE_DIARIO);
  const limite = Number.isInteger(configurado) && configurado > 0 ? configurado : 30;
  const cuota = await usuariosService.obtenerCuotaDiaria(req.usuario.id, limite);
  return res.json(cuota);
}

async function obtenerEstadisticasMiCuenta(req, res) {
  const totalMensajes = await usuariosService.obtenerTotalMensajes(req.usuario.id);
  return res.json({ totalMensajes });
}

async function obtenerMiEliminacionProgramada(req, res) {
  const eliminacion =
    await require('../services/eliminaciones.servicio').obtenerEliminacionProgramada(
      req.usuario.id,
    );
  return res.json({ eliminacion });
}

module.exports = {
  registrarUsuario,
  verificarCorreoRegistro,
  reenviarCodigoRegistro,
  iniciarSesion,
  cerrarSesion,
  obtenerMiCuenta,
  actualizarMiNombre,
  eliminarMiCuenta,
  obtenerMiCuota,
  obtenerEstadisticasMiCuenta,
  obtenerMiEliminacionProgramada,
};

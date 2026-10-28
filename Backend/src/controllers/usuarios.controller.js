const usuariosService = require('../services/usuarios.servicio');
const { COOKIE_NAME, opcionesCookie, obtenerTokenSesion } = require('../config/sesion.config');
const { createHash } = require('crypto');

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
            mensaje: 'Debes aceptar los términos y autorizar el tratamiento de datos para crear la cuenta',
        });
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

    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
        return res.status(400).json({
            mensaje: 'La contraseña debe tener al menos 8 caracteres y no superar los 1024 bytes',
        });
    }

    const { usuario, sesion } = await usuariosService.registrarUsuario({
        nombre,
        correo: correoNormalizado,
        password,
        evidenciaLegal: usuariosService.crearEvidenciaLegal(req, 'registro'),
    });
    res.cookie(COOKIE_NAME, sesion.token, opcionesCookie());

    return res.status(201).json({
        mensaje: 'Usuario registrado correctamente',
        usuario,
        expiraEn: sesion.expiraEn,
    });

} catch (error) {
    if (error.code === 'CORREO_DUPLICADO') {
        return res.status(409).json({
            mensaje: 'Este correo electrónico ya está registrado',
        });
    }

    console.error('Error al registrar usuario:', error.message);

    return res.status(500).json({
        mensaje: 'Ocurrió un error al registrar el usuario',
    });
}


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
    if (req.body?.aceptaTerminos !== 'true' || req.body?.aceptaPrivacidad !== 'true') {
        return res.status(400).json({
            mensaje: 'Debes aceptar los términos y autorizar el tratamiento de datos para iniciar sesión',
        });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const claveIntentos = createHash('sha256')
        .update(`${correoNormalizado}\0${req.ip || 'ip-desconocida'}`)
        .digest('hex');
    const segundosBloqueo = await usuariosService.obtenerBloqueoLogin(claveIntentos);
    if (segundosBloqueo > 0) {
        return res.status(429).json({
            mensaje: `Se agotaron los 3 intentos. Prueba de nuevo en ${describirTiempoBloqueo(segundosBloqueo)}.`,
            intentosRestantes: 0,
            reintentarEn: segundosBloqueo,
        });
    }

    const usuario = await usuariosService.iniciarSesion({
        correo: correoNormalizado,
        password,
        evidenciaLegal: usuariosService.crearEvidenciaLegal(req, 'inicio_sesion'),
    });
    if (!usuario) {
        const intento = await usuariosService.registrarIntentoLoginFallido(claveIntentos);
        if (intento.segundos > 0) {
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
    return res.json({ usuario: req.usuario });
}

async function actualizarMiNombre(req, res) {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre || nombre.length > 100) {
        return res.status(400).json({ mensaje: 'El nombre debe tener entre 1 y 100 caracteres' });
    }

    try {
        const usuario = await usuariosService.actualizarNombre(req.usuario.id, nombre);
        if (!usuario) return res.status(404).json({ mensaje: 'No encontramos tu cuenta' });
        return res.json({ usuario });
    } catch (error) {
        console.error('Error al actualizar el nombre:', error.message);
        return res.status(500).json({ mensaje: 'No se pudo actualizar el nombre. Inténtalo de nuevo.' });
    }
}

async function eliminarMiCuenta(req, res) {
    const { password } = req.body || {};
    if (typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({ mensaje: 'Escribe tu contraseña para confirmar la eliminación' });
    }
    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
        return res.status(400).json({ mensaje: 'La contraseña supera el límite permitido' });
    }

    try {
        const eliminada = await usuariosService.eliminarCuenta(req.usuario.id, password);
        if (!eliminada) return res.status(403).json({ mensaje: 'La contraseña no es correcta' });

        const { maxAge, ...opcionesBorrado } = opcionesCookie();
        res.clearCookie(COOKIE_NAME, opcionesBorrado);
        return res.json({ mensaje: 'La cuenta se eliminó correctamente' });
    } catch (error) {
        console.error('Error al eliminar la cuenta:', error.message);
        return res.status(500).json({ mensaje: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.' });
    }
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

module.exports = {
  registrarUsuario,
  iniciarSesion,
  cerrarSesion,
  obtenerMiCuenta,
  actualizarMiNombre,
  eliminarMiCuenta,
  obtenerMiCuota,
  obtenerEstadisticasMiCuenta,
};

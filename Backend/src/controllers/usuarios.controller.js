const usuariosService = require('../services/usuarios.servicio');
const { COOKIE_NAME, opcionesCookie, obtenerTokenSesion } = require('../config/sesion.config');

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

    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({
            mensaje: 'La contraseña debe tener al menos 8 caracteres y no superar los 72 bytes',
        });
    }

    const usuario = await usuariosService.registrarUsuario({
        nombre,
        correo: correoNormalizado,
        password,
    });
    const sesion = await usuariosService.crearSesion(usuario.id);
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
    if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ mensaje: 'La contraseña no puede superar los 72 bytes' });
    }

    const usuario = await usuariosService.iniciarSesion({ correo, password });
    if (!usuario) {
        return res.status(401).json({ mensaje: 'El correo o la contraseña no son correctos' });
    }

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

async function obtenerMiCuota(req, res) {
    const configurado = Number(process.env.ASISTENTE_LIMITE_DIARIO);
    const limite = Number.isInteger(configurado) && configurado > 0 ? configurado : 30;
    const cuota = await usuariosService.obtenerCuotaDiaria(req.usuario.id, limite);
    return res.json(cuota);
}

module.exports = {
  registrarUsuario,
  iniciarSesion,
  cerrarSesion,
  obtenerMiCuenta,
  obtenerMiCuota,
};

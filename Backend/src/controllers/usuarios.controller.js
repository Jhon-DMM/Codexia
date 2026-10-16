const usuariosService = require('../services/usuarios.servicio');

async function registrarUsuario(req, res) {
try {

  const { nombre, correo, password } = req.body;

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

    if (correoNormalizado.length > 255) {
        return res.status(400).json({
            mensaje: 'El correo no puede superar los 255 caracteres',
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

    return res.status(201).json({
        mensaje: 'Usuario registrado correctamente',
        usuario,
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

module.exports = {
  registrarUsuario,
};

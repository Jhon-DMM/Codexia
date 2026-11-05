const { createHmac } = require('crypto');

const SECRETO_DESARROLLO = 'codexia-limites-login-solo-desarrollo';

function enteroPositivoDesdeEntorno(nombre, valorPredeterminado) {
  const configurado = process.env[nombre];
  if (!configurado) return valorPredeterminado;

  const valor = Number(configurado);
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new Error(`${nombre} debe ser un entero mayor que 0.`);
  }

  return valor;
}

const MAXIMO_SOLICITUDES_LOGIN_IP = enteroPositivoDesdeEntorno('LOGIN_IP_MAX_SOLICITUDES', 60);
const VENTANA_LOGIN_IP_SEGUNDOS = enteroPositivoDesdeEntorno('LOGIN_IP_VENTANA_SEGUNDOS', 15 * 60);
const MAXIMO_REGISTROS_IP = enteroPositivoDesdeEntorno('REGISTRO_IP_MAX_SOLICITUDES', 10);
const VENTANA_REGISTRO_IP_SEGUNDOS = enteroPositivoDesdeEntorno(
  'REGISTRO_IP_VENTANA_SEGUNDOS',
  24 * 60 * 60,
);

function obtenerSecretoLimites() {
  const secreto = process.env.RATE_LIMIT_SECRET;

  if (secreto && secreto.trim()) {
    if (process.env.NODE_ENV === 'production' && Buffer.byteLength(secreto, 'utf8') < 32) {
      throw new Error('RATE_LIMIT_SECRET debe tener al menos 32 bytes en producción.');
    }
    return secreto;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RATE_LIMIT_SECRET es obligatorio en producción.');
  }

  return SECRETO_DESARROLLO;
}

const SECRETO_LIMITES = obtenerSecretoLimites();

function crearClaveHashLimiteLogin(tipo, valor) {
  return createHmac('sha256', SECRETO_LIMITES).update(`${tipo}\0${valor}`).digest('hex');
}

module.exports = {
  MAXIMO_SOLICITUDES_LOGIN_IP,
  VENTANA_LOGIN_IP_SEGUNDOS,
  MAXIMO_REGISTROS_IP,
  VENTANA_REGISTRO_IP_SEGUNDOS,
  crearClaveHashLimiteLogin,
};

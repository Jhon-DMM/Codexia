require('dotenv').config();

const path = require('path');
const fs = require('fs');

// 1. Lista de variables obligatorias para la aplicación
const variablesObligatorias = [
  'GROQ_API_KEY',
  'GROQ_MODEL',
];

if (!process.env.DATABASE_URL) {
  variablesObligatorias.push('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD');
}

if (process.env.NODE_ENV === 'production') variablesObligatorias.push('RATE_LIMIT_SECRET');

// 2. Filtrar y encontrar cuáles están vacías o no definidas
const variablesFaltantes = variablesObligatorias.filter(
  (nombre) => !process.env[nombre] || process.env[nombre].trim() === '',
);

if (variablesFaltantes.length > 0) {
  console.error('\x1b[31m%s\x1b[0m', '============ ERROR DE CONFIGURACIÓN ============');
  console.error(
    '\x1b[31m%s\x1b[0m',
    'Faltan las siguientes variables de entorno obligatorias en la configuración de entorno:',
  );
  variablesFaltantes.forEach((variable) => {
    console.error('\x1b[31m%s\x1b[0m', ` - ${variable}`);
  });
  console.error('\x1b[31m%s\x1b[0m', '================================================');
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  Buffer.byteLength(process.env.RATE_LIMIT_SECRET, 'utf8') < 32
) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    'RATE_LIMIT_SECRET debe tener al menos 32 bytes en producción.',
  );
  process.exit(1);
}

const saltosProxyConfigurados = process.env.TRUST_PROXY_HOPS;
if (
  saltosProxyConfigurados &&
  (!Number.isInteger(Number(saltosProxyConfigurados)) || Number(saltosProxyConfigurados) < 0)
) {
  console.error('\x1b[31m%s\x1b[0m', 'TRUST_PROXY_HOPS debe ser un entero igual o mayor que 0.');
  process.exit(1);
}

// 3. Validación específica para DB_PORT (debe ser un número válido)
const puertoDB = Number(process.env.DB_PORT);
if (Number.isNaN(puertoDB) || !Number.isInteger(puertoDB) || puertoDB <= 0 || puertoDB > 65535) {
  console.error('\x1b[31m%s\x1b[0m', '============ ERROR DE VALIDACIÓN ============');
  console.error(
    '\x1b[31m%s\x1b[0m',
    `El valor de DB_PORT ("${process.env.DB_PORT}") no es un número de puerto válido.`,
  );
  console.error('\x1b[31m%s\x1b[0m', 'Debe ser un número entero entre 1 y 65535 (ej: 5432).');
  console.error('\x1b[31m%s\x1b[0m', '==============================================');
  process.exit(1);
}

// Comprobación estricta antes de iniciar el servidor
if (process.env.NODE_ENV === 'production') {
  const frontendConstruido = path.join(__dirname, '../Frontend/dist');

  if (!fs.existsSync(frontendConstruido)) {
    console.error('\x1b[31m%s\x1b[0m', '============ ERROR CRÍTICO ============');
    console.error(
      '\x1b[31m%s\x1b[0m',
      `Falta la carpeta de producción obligatoria: ${frontendConstruido}`,
    );
    console.error(
      '\x1b[31m%s\x1b[0m',
      'Ejecuta el build del frontend antes de arrancar el servidor.',
    );
    console.error('\x1b[31m%s\x1b[0m', '=======================================');
    process.exit(1); // Detiene la ejecución por completo
  }
}

const app = require('./src/app');
const usuariosService = require('./src/services/usuarios.servicio');
const eliminacionesService = require('./src/services/eliminaciones.servicio');
const { registrarError } = require('./src/utils/registro-errores');

const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`Servidor Codexia funcionando en http://localhost:${puerto}`);
  const limpiarDatosVencidos = async () => {
    try {
      const eliminados = await usuariosService.eliminarDatosPilotoVencidos();
      if (eliminados)
        console.log(`Limpieza del piloto: ${eliminados} cuenta(s) vencida(s) eliminada(s).`);
    } catch (error) {
      registrarError(error, { contexto: 'limpieza_programada_piloto' });
    }
  };
  limpiarDatosVencidos();
  const temporizadorLimpieza = setInterval(limpiarDatosVencidos, 60 * 1000);
  temporizadorLimpieza.unref();
  const ejecutarEliminaciones = async () => {
    try {
      const eliminadas = await eliminacionesService.ejecutarEliminacionesVencidas();
      if (eliminadas) console.log(`Eliminaciones programadas ejecutadas: ${eliminadas} cuenta(s).`);
    } catch (error) {
      registrarError(error, { contexto: 'ejecucion_eliminaciones_programadas' });
    }
  };
  ejecutarEliminaciones();
  const temporizadorEliminaciones = setInterval(ejecutarEliminaciones, 60 * 1000);
  temporizadorEliminaciones.unref();
});

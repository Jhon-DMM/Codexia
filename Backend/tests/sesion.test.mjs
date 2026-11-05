import test from 'node:test';
import assert from 'node:assert/strict';
import { opcionesCookie } from '../src/config/sesion.config.js';

// 1. Prueba para el comportamiento general (Entorno por defecto / Desarrollo)
test('Validación de la configuración general de opcionesCookie', () => {
  const cookie = opcionesCookie();

  assert.strictEqual(
    cookie.httpOnly,
    true,
    'La cookie debe tener httpOnly: true para mitigar ataques XSS',
  );
  assert.strictEqual(
    cookie.sameSite,
    'lax',
    'La cookie debe tener sameSite: "lax" para mitigar ataques CSRF',
  );
  assert.strictEqual(
    cookie.path,
    '/',
    'La cookie debe tener path: "/" para ser accesible en toda la app',
  );

  // Verificación de la duración de 7 días
  const SIETE_DIAS_EN_MS = 7 * 24 * 60 * 60 * 1000; // 604,800,000 ms

  if (cookie.maxAge !== undefined) {
    assert.strictEqual(
      cookie.maxAge,
      SIETE_DIAS_EN_MS,
      'La propiedad maxAge debe equivaler a 7 días en ms',
    );
  } else if (cookie.expires !== undefined) {
    const ahora = Date.now();
    const tiempoExpiracion = new Date(cookie.expires).getTime();
    const diferencia = tiempoExpiracion - ahora;
    const margenTolerancia = 5000;
    assert.ok(
      Math.abs(diferencia - SIETE_DIAS_EN_MS) < margenTolerancia,
      'La fecha de expiración debe ser en aprox. 7 días',
    );
  } else {
    assert.fail('La cookie no tiene definida ninguna propiedad de duración (maxAge o expires)');
  }
});

// 2. Prueba aislada para el comportamiento específico de producción (Propiedad secure)
test('Validación de la propiedad secure de opcionesCookie en producción', () => {
  // Guardar el valor original de NODE_ENV antes de alterarlo
  const nodoEnvOriginal = process.env.NODE_ENV;

  try {
    // Forzar el entorno de producción para la prueba
    process.env.NODE_ENV = 'production';

    // Evaluar la función justo ahora que NODE_ENV es 'production'
    const cookieProduccion = opcionesCookie();

    // Comprobar que la propiedad secure esté activada en producción
    assert.strictEqual(
      cookieProduccion.secure,
      true,
      'La propiedad secure debe ser true cuando NODE_ENV es "production" para obligar el uso de HTTPS',
    );
  } finally {
    // Restaurar el valor original pase lo que pase para no romper otros tests
    if (nodoEnvOriginal === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodoEnvOriginal;
    }
  }
});

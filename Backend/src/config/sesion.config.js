const COOKIE_NAME = 'codexia_session';
const DURACION_SESION_MS = 7 * 24 * 60 * 60 * 1000;

function opcionesCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SESION_MS,
  };
}

function obtenerTokenSesion(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const prefijo = `${COOKIE_NAME}=`;
  const cookie = cookies.map((parte) => parte.trim()).find((parte) => parte.startsWith(prefijo));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(prefijo.length));
  } catch (error) {
    return null;
  }
}

module.exports = { COOKIE_NAME, DURACION_SESION_MS, opcionesCookie, obtenerTokenSesion };

document.addEventListener('DOMContentLoaded', () => {
  const conversationKey = 'codexia-conversation-id';
  const mensaje = document.getElementById('cuenta-mensaje');
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');
  const pestañaLogin = document.getElementById('pestana-login');
  const pestañaRegistro = document.getElementById('pestana-registro');

  function apiBaseUrl() {
    const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
    if (configurada) return configurada.replace(/\/+$/, '');

    const { protocol, hostname, port } = window.location;
    const local = hostname === 'localhost' || hostname === '127.0.0.1';
    if (protocol === 'file:') return 'http://localhost:3000';
    if (local && port !== '3000') return `http://${hostname}:3000`;
    return '';
  }

  function destinoAsistente() {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;

    const marcadorCuenta = '/es/cuenta/';
    const rutaActual = window.location.pathname;
    const indiceCuenta = rutaActual.lastIndexOf(marcadorCuenta);
    const raizFrontend = indiceCuenta >= 0 ? rutaActual.slice(0, indiceCuenta) : '';
    return `${raizFrontend}/es/asistente.ia/index.html`;
  }

  function cambiarPestaña(registro) {
    formLogin.hidden = registro;
    formRegistro.hidden = !registro;
    pestañaLogin.classList.toggle('activa', !registro);
    pestañaRegistro.classList.toggle('activa', registro);
    pestañaLogin.setAttribute('aria-selected', String(!registro));
    pestañaRegistro.setAttribute('aria-selected', String(registro));
    mensaje.textContent = '';
  }

  async function enviar(endpoint, datos, boton) {
    mensaje.textContent = '';
    boton.disabled = true;
    try {
      const respuesta = await fetch(`${apiBaseUrl()}/api/usuarios/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.mensaje || 'No fue posible completar la solicitud');

      sessionStorage.removeItem(conversationKey);
      window.location.assign(destinoAsistente());
    } catch (error) {
      mensaje.textContent = error instanceof TypeError
        ? `No se pudo conectar con el servidor (${apiBaseUrl() || window.location.origin}). Comprueba que la API esté iniciada y que el origen de esta página esté permitido por CORS.`
        : error.message || 'No fue posible completar la solicitud. Inténtalo de nuevo.';
    } finally {
      boton.disabled = false;
    }
  }

  pestañaLogin.addEventListener('click', () => cambiarPestaña(false));
  pestañaRegistro.addEventListener('click', () => cambiarPestaña(true));

  formLogin.addEventListener('submit', (event) => {
    event.preventDefault();
    const datos = Object.fromEntries(new FormData(formLogin));
    enviar('login', datos, formLogin.querySelector('button[type="submit"]'));
  });

  formRegistro.addEventListener('submit', (event) => {
    event.preventDefault();
    const datos = Object.fromEntries(new FormData(formRegistro));
    enviar('registro', datos, formRegistro.querySelector('button[type="submit"]'));
  });

  localStorage.removeItem('codexia-token');
  fetch(`${apiBaseUrl()}/api/usuarios/me`, { credentials: 'include' })
    .then((respuesta) => {
      if (respuesta.ok) window.location.replace(destinoAsistente());
    })
    .catch(() => {});
});

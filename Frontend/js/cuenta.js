document.addEventListener('DOMContentLoaded', () => {
  const conversationKey = 'codexia-conversation-id';
  const mensaje = document.getElementById('cuenta-mensaje');
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');
  const pestañaLogin = document.getElementById('pestana-login');
  const pestañaRegistro = document.getElementById('pestana-registro');
  const botonLogin = formLogin.querySelector('button[type="submit"]');
  const camposLogin = [...formLogin.querySelectorAll('input')];
  const textoOriginalBotonLogin = botonLogin.innerHTML;
  let bloqueoLoginHasta = 0;
  let temporizadorBloqueoLogin = null;

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

  function formatoTiempoRestante(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosRestantes = segundos % 60;
    const dosDigitos = (numero) => String(numero).padStart(2, '0');
    return horas > 0
      ? `${dosDigitos(horas)}:${dosDigitos(minutos)}:${dosDigitos(segundosRestantes)}`
      : `${dosDigitos(minutos)}:${dosDigitos(segundosRestantes)}`;
  }

  function actualizarContadorBloqueo() {
    const segundos = Math.max(0, Math.ceil((bloqueoLoginHasta - Date.now()) / 1000));
    if (segundos === 0) {
      clearInterval(temporizadorBloqueoLogin);
      temporizadorBloqueoLogin = null;
      bloqueoLoginHasta = 0;
      camposLogin.forEach((campo) => { campo.disabled = false; });
      botonLogin.disabled = false;
      botonLogin.innerHTML = textoOriginalBotonLogin;
      mensaje.textContent = 'Ya puedes volver a intentarlo.';
      return;
    }

    const tiempo = formatoTiempoRestante(segundos);
    camposLogin.forEach((campo) => { campo.disabled = true; });
    botonLogin.disabled = true;
    botonLogin.textContent = `Espera ${tiempo}`;
    mensaje.textContent = 'Inicio de sesión pausado temporalmente.';
  }

  function iniciarContadorBloqueo(segundos) {
    bloqueoLoginHasta = Date.now() + (segundos * 1000);
    actualizarContadorBloqueo();
    clearInterval(temporizadorBloqueoLogin);
    temporizadorBloqueoLogin = setInterval(actualizarContadorBloqueo, 250);
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
      if (!respuesta.ok) {
        if (endpoint === 'login' && respuesta.status === 401) {
          mensaje.textContent = 'Correo o contraseña equivocado.';
          return;
        }

        if (endpoint === 'login' && respuesta.status === 429 && Number.isFinite(resultado.reintentarEn)) {
          iniciarContadorBloqueo(resultado.reintentarEn);
          return;
        }

        throw new Error(resultado.mensaje || 'No fue posible completar la solicitud');
      }

      sessionStorage.removeItem(conversationKey);
      window.location.assign(destinoAsistente());
    } catch (error) {
      mensaje.textContent = error instanceof TypeError
        ? `No se pudo conectar con el servidor (${apiBaseUrl() || window.location.origin}). Comprueba que la API esté iniciada y que el origen de esta página esté permitido por CORS.`
        : error.message || 'No fue posible completar la solicitud. Inténtalo de nuevo.';
    } finally {
      if (endpoint !== 'login' || Date.now() >= bloqueoLoginHasta) boton.disabled = false;
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

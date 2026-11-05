import '../css/carga-ui.css';

const CLAVE_NAVEGACION = 'codexia-navegacion-cargando';
let inicializado = false;
let navegacionActiva = false;
let peticionesPendientes = 0;
let peticionVisible = false;
let temporizadorPeticion;

function obtenerIndicador() {
  let indicador = document.getElementById('codexia-carga-global');
  if (!indicador) {
    indicador = document.createElement('div');
    indicador.id = 'codexia-carga-global';
    indicador.setAttribute('aria-hidden', 'true');
    indicador.setAttribute('role', 'progressbar');
    indicador.setAttribute('aria-label', 'Cargando');
    document.body.append(indicador);
  }
  return indicador;
}

function actualizarIndicador() {
  const indicador = obtenerIndicador();
  const activa = navegacionActiva || peticionVisible;
  document.body.classList.toggle('carga-ui-activa', activa);
  indicador.setAttribute('aria-hidden', String(!activa));
}

export function mostrarCargaNavegacion() {
  navegacionActiva = true;
  try {
    sessionStorage.setItem(CLAVE_NAVEGACION, '1');
  } catch (error) {
    // El indicador seguirá visible en esta página aunque el almacenamiento esté bloqueado.
  }
  actualizarIndicador();
}

function iniciarCargaPeticion() {
  peticionesPendientes += 1;
  if (peticionesPendientes === 1) {
    temporizadorPeticion = window.setTimeout(() => {
      peticionVisible = true;
      actualizarIndicador();
    }, 220);
  }
}

function terminarCargaPeticion() {
  peticionesPendientes = Math.max(0, peticionesPendientes - 1);
  if (peticionesPendientes !== 0) return;
  window.clearTimeout(temporizadorPeticion);
  peticionVisible = false;
  actualizarIndicador();
}

export function inicializarCargaUI() {
  if (inicializado || typeof window.fetch !== 'function') return;
  inicializado = true;
  obtenerIndicador();

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (...argumentos) => {
    iniciarCargaPeticion();
    try {
      return fetchOriginal(...argumentos).finally(terminarCargaPeticion);
    } catch (error) {
      terminarCargaPeticion();
      throw error;
    }
  };

  document.addEventListener('click', (evento) => {
    if (
      evento.defaultPrevented ||
      evento.button !== 0 ||
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey
    )
      return;
    const enlace = evento.target.closest('a[href]');
    if (
      !enlace ||
      (enlace.target && enlace.target.toLowerCase() !== '_self') ||
      enlace.hasAttribute('download')
    )
      return;
    const destino = new URL(enlace.href, window.location.href);
    if (destino.origin !== window.location.origin) return;
    if (destino.pathname === window.location.pathname && destino.search === window.location.search)
      return;
    mostrarCargaNavegacion();
  });

  window.addEventListener('pageshow', (evento) => {
    if (!evento.persisted) return;
    navegacionActiva = false;
    try {
      sessionStorage.removeItem(CLAVE_NAVEGACION);
    } catch (error) {
      /* El indicador puede seguir operando sin almacenamiento. */
    }
    actualizarIndicador();
  });

  try {
    if (sessionStorage.getItem(CLAVE_NAVEGACION) === '1') {
      sessionStorage.removeItem(CLAVE_NAVEGACION);
      navegacionActiva = true;
      actualizarIndicador();
      const finalizar = () =>
        window.setTimeout(() => {
          navegacionActiva = false;
          actualizarIndicador();
        }, 160);
      if (document.readyState === 'complete') finalizar();
      else window.addEventListener('load', finalizar, { once: true });
    }
  } catch (error) {
    // La carga de la página no depende de sessionStorage.
  }
}

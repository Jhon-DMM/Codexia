import React, { useEffect, useRef, useState } from 'react';
import '../../css/base.css';
import '../../css/inicio.css';
import Servicios2D from '../components/home/Servicios2D.jsx';
import EsferaParticulas from '../components/home/EsferaParticulas.jsx';
import TransicionNosotros from '../components/home/TransicionNosotros.jsx';
import EntradaInicial from '../components/home/EntradaInicial.jsx';
import ContadorSecciones from '../components/home/ContadorSecciones.jsx';
import { useHome } from '../hooks/useHome.js';

const servicios = [
  {
    titulo: 'Desarrollo web',
    texto: 'Diseñamos sitios web modernos, rápidos y adaptados a cualquier dispositivo.',
    herramientas: ['HTML', 'CSS', 'JavaScript', 'React'],
  },
  {
    titulo: 'Desarrollo de software',
    texto:
      'Creamos soluciones de software personalizadas para optimizar procesos y mejorar la productividad.',
    herramientas: ['Node.js', 'API REST', 'PostgreSQL', 'JavaScript'],
  },
  {
    titulo: 'Ciberseguridad',
    texto:
      'Protegemos la información y fortalecemos la seguridad de los sistemas frente a amenazas digitales.',
    herramientas: ['OWASP', 'HTTPS', 'Argon2id', 'Validación'],
  },
  {
    titulo: 'Inteligencia artificial',
    texto:
      'Implementamos soluciones basadas en IA para automatizar tareas y potenciar la toma de decisiones.',
    herramientas: ['Groq API', 'Prompts', 'Node.js', 'React'],
  },
];

const valores = [
  ['Innovación', 'Buscamos soluciones modernas para cada proyecto.'],
  ['Calidad', 'Cuidamos cada detalle para entregar productos confiables.'],
  [
    'Compromiso',
    'Trabajamos junto a nuestros clientes para comprender sus necesidades y ofrecer soluciones a su medida.',
  ],
  ['Seguridad', 'Diseñamos pensando en la protección de la información.'],
];

const beneficios = [
  [
    'Tecnología moderna',
    'Elegimos herramientas actuales que permiten construir soluciones mantenibles y preparadas para crecer.',
  ],
  ['Atención cercana', 'Entendemos el contexto de cada cliente antes de proponer una solución.'],
  [
    'Seguridad desde el inicio',
    'La protección de los datos forma parte de las decisiones de diseño y desarrollo.',
  ],
  [
    'Enfoque en resultados',
    'Priorizamos funciones que resuelvan necesidades reales y aporten valor al negocio.',
  ],
];

function suavizarProgreso(valor) {
  const limitado = Math.max(0, Math.min(1, valor));
  return limitado * limitado * limitado * (limitado * (limitado * 6 - 15) + 10);
}

function Home() {
  const { sesionActiva } = useHome();
  const heroRecorridoRef = useRef(null);
  const progresoHeroActualRef = useRef(0);
  const progresoHeroObjetivoRef = useRef(0);
  const [progresoHero, setProgresoHero] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [headerTheme, setHeaderTheme] = useState('claro');

  useEffect(() => {
    let temporizador = null;
    const encabezado = document.querySelector('.encabezado');

    function detectarTema() {
      if (!encabezado) return 'claro';
      const puntoY = Math.min(window.innerHeight - 1, encabezado.offsetHeight + 8);
      const elemento = document.elementFromPoint(window.innerWidth / 2, puntoY);
      if (!elemento) return 'claro';

      if (elemento.closest('.servicios-mini-cierre')) {
        const fondoCierre = elemento
          .closest('.servicios-mini-cierre')
          .querySelector('.servicios-mini-cierre-fondo');
        return Number.parseFloat(fondoCierre?.style.opacity ?? '0') >= 0.5 ? 'claro' : 'oscuro';
      }
      if (elemento.closest('#servicios, #porque-elegirnos')) return 'oscuro';
      if (elemento.closest('#hero')) {
        return document.querySelector('.pagina-inicio')?.classList.contains('hero-fondo-profundo')
          ? 'oscuro'
          : 'claro';
      }
      if (elemento.closest('.puente-nosotros-recorrido, #nosotros, #asistente')) return 'claro';

      return 'claro';
    }

    function actualizarTema() {
      setHeaderTheme(detectarTema());
    }

    function manejarDesplazamiento() {
      setHeaderVisible(false);
      actualizarTema();
      if (temporizador !== null) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        actualizarTema();
        setHeaderVisible(true);
        temporizador = null;
      }, 300);
    }

    const fondoCierre = document.querySelector('.servicios-mini-cierre-fondo');
    const observadorFondoCierre = fondoCierre ? new MutationObserver(actualizarTema) : null;
    observadorFondoCierre?.observe(fondoCierre, {
      attributes: true,
      attributeFilter: ['style'],
    });
    actualizarTema();
    window.addEventListener('scroll', manejarDesplazamiento, { passive: true });
    window.addEventListener('resize', actualizarTema);
    return () => {
      window.removeEventListener('scroll', manejarDesplazamiento);
      window.removeEventListener('resize', actualizarTema);
      observadorFondoCierre?.disconnect();
      if (temporizador !== null) window.clearTimeout(temporizador);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const factorRueda = 0.6;
    const distanciaMaximaPendienteRueda = 450;
    const tiempoRespuestaRueda = 0.16;
    const velocidadFlechaServicios = 624;
    const multiplicadorVelocidadOtrasSecciones = 1.5;
    const respuestaAceleracionFlecha = 0.16;
    const respuestaFrenadoFlecha = 0.22;
    let destinoScroll = null;
    let tiempoRespuestaActual = tiempoRespuestaRueda;
    let tiempoAnteriorRueda = 0;
    let direccionFlecha = 0;
    let velocidadFlecha = 0;
    let tiempoAnteriorFlecha = 0;
    let cuadroFlecha = null;
    const flechasPulsadas = new Set();
    let cuadroScroll = null;

    function obtenerVelocidadMaximaFlecha() {
      const puntoLectura = window.scrollY + window.innerHeight / 2;
      const recorridoHero = heroRecorridoRef.current;

      if (recorridoHero) {
        const rectHero = recorridoHero.getBoundingClientRect();
        const finalHero = rectHero.top + window.scrollY + recorridoHero.offsetHeight;

        if (puntoLectura <= finalHero) return velocidadFlechaServicios;
      }

      const servicios = document.getElementById('servicios');
      if (servicios) {
        const rectServicios = servicios.getBoundingClientRect();
        const inicioServicios = rectServicios.top + window.scrollY;
        const finalServicios = inicioServicios + servicios.offsetHeight;
        const estaEnServicios = puntoLectura >= inicioServicios && puntoLectura < finalServicios;

        if (estaEnServicios) return velocidadFlechaServicios;
      }

      return velocidadFlechaServicios * multiplicadorVelocidadOtrasSecciones;
    }

    function suavizarDesplazamiento(tiempo) {
      if (document.documentElement.dataset.codexiaScrollLocked === 'true') {
        cancelarDesplazamiento();
        return;
      }
      if (tiempoAnteriorRueda === 0) tiempoAnteriorRueda = tiempo;

      const deltaTiempo = Math.min((tiempo - tiempoAnteriorRueda) / 1000, 0.05);
      tiempoAnteriorRueda = tiempo;
      const posicionActual = window.scrollY;
      const diferencia = destinoScroll - posicionActual;
      const respuestaDelMovimiento = 1 - Math.exp(-deltaTiempo / tiempoRespuestaActual);
      const posicion = posicionActual + diferencia * respuestaDelMovimiento;

      window.scrollTo({ top: posicion, behavior: 'instant' });

      if (Math.abs(diferencia) < 0.75) {
        window.scrollTo({ top: destinoScroll, behavior: 'instant' });
        cuadroScroll = null;
        tiempoAnteriorRueda = 0;
        destinoScroll = null;
      } else {
        cuadroScroll = window.requestAnimationFrame(suavizarDesplazamiento);
      }
    }

    function cancelarDesplazamiento() {
      if (cuadroScroll !== null) window.cancelAnimationFrame(cuadroScroll);
      cuadroScroll = null;
      destinoScroll = null;
      tiempoAnteriorRueda = 0;
    }

    function solicitarDesplazamiento(destino, tiempoRespuesta) {
      destinoScroll = destino;
      tiempoRespuestaActual = tiempoRespuesta;

      if (cuadroScroll === null) {
        tiempoAnteriorRueda = 0;
        cuadroScroll = window.requestAnimationFrame(suavizarDesplazamiento);
      }
    }

    function actualizarDireccionFlecha() {
      const baja = flechasPulsadas.has('ArrowDown');
      const sube = flechasPulsadas.has('ArrowUp');
      direccionFlecha = baja === sube ? 0 : baja ? 1 : -1;
    }

    function animarFlechas(tiempo) {
      if (document.documentElement.dataset.codexiaScrollLocked === 'true') {
        detenerFlechas();
        return;
      }
      if (tiempoAnteriorFlecha === 0) tiempoAnteriorFlecha = tiempo;

      const deltaTiempo = Math.min((tiempo - tiempoAnteriorFlecha) / 1000, 0.05);
      tiempoAnteriorFlecha = tiempo;
      const velocidadObjetivo = direccionFlecha * obtenerVelocidadMaximaFlecha();
      const tiempoRespuesta =
        direccionFlecha === 0 ? respuestaFrenadoFlecha : respuestaAceleracionFlecha;
      const factorAceleracion = 1 - Math.exp(-deltaTiempo / tiempoRespuesta);

      velocidadFlecha += (velocidadObjetivo - velocidadFlecha) * factorAceleracion;

      const posicionActual = window.scrollY;
      const limite = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const posicion = Math.max(
        0,
        Math.min(limite, posicionActual + velocidadFlecha * deltaTiempo),
      );

      window.scrollTo({ top: posicion, behavior: 'instant' });

      const llegoAlBorde =
        (posicion === 0 && velocidadFlecha < 0) || (posicion === limite && velocidadFlecha > 0);

      if (llegoAlBorde) {
        velocidadFlecha = 0;
        direccionFlecha = 0;
        flechasPulsadas.clear();
      }

      if (direccionFlecha !== 0 || Math.abs(velocidadFlecha) >= 5) {
        cuadroFlecha = window.requestAnimationFrame(animarFlechas);
      } else {
        cuadroFlecha = null;
        tiempoAnteriorFlecha = 0;
        velocidadFlecha = 0;
      }
    }

    function detenerFlechas() {
      flechasPulsadas.clear();
      direccionFlecha = 0;
      velocidadFlecha = 0;
      tiempoAnteriorFlecha = 0;
      if (cuadroFlecha !== null) window.cancelAnimationFrame(cuadroFlecha);
      cuadroFlecha = null;
    }

    function manejarFlechas(evento) {
      if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;

      if (document.documentElement.dataset.codexiaScrollLocked === 'true') {
        evento.preventDefault();
        cancelarDesplazamiento();
        detenerFlechas();
        return;
      }

      const objetivo = evento.target;
      const estaEditando =
        objetivo instanceof HTMLElement &&
        (objetivo.isContentEditable ||
          objetivo.closest('input, textarea, select, [role="textbox"]'));
      const estaEnControl =
        objetivo instanceof HTMLElement &&
        objetivo.closest('a, button, [role="button"], [role="slider"]');

      if (
        estaEditando ||
        estaEnControl ||
        evento.altKey ||
        evento.ctrlKey ||
        evento.metaKey ||
        evento.shiftKey
      ) {
        return;
      }

      evento.preventDefault();
      cancelarDesplazamiento();
      const direccionAnterior = direccionFlecha;
      flechasPulsadas.add(evento.key);
      actualizarDireccionFlecha();

      if (direccionAnterior === 0 && Math.abs(velocidadFlecha) < 1) {
        velocidadFlecha = direccionFlecha * obtenerVelocidadMaximaFlecha() * (108 / 624);
      }

      if (cuadroFlecha === null) {
        tiempoAnteriorFlecha = 0;
        cuadroFlecha = window.requestAnimationFrame(animarFlechas);
      }
    }

    function soltarFlecha(evento) {
      if (!flechasPulsadas.has(evento.key)) return;

      evento.preventDefault();
      flechasPulsadas.delete(evento.key);
      actualizarDireccionFlecha();
    }

    function manejarRueda(evento) {
      if (document.documentElement.dataset.codexiaScrollLocked === 'true') {
        evento.preventDefault();
        cancelarDesplazamiento();
        detenerFlechas();
        return;
      }
      if (evento.defaultPrevented || evento.ctrlKey || evento.shiftKey) return;
      if (Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;

      const objetivo = evento.target;
      const estaEditando =
        objetivo instanceof HTMLElement &&
        (objetivo.isContentEditable ||
          objetivo.closest('input, textarea, select, [role="textbox"]'));
      if (estaEditando) return;

      detenerFlechas();

      const multiplicadorModo =
        evento.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : evento.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
      const deltaRueda = Math.max(
        -120,
        Math.min(120, evento.deltaY * multiplicadorModo * factorRueda),
      );
      const posicionActual = window.scrollY;
      const destinoAnterior = destinoScroll ?? posicionActual;
      const limite = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const destinoPropuesto = destinoAnterior + deltaRueda;
      const destinoLimitado = Math.max(
        posicionActual - distanciaMaximaPendienteRueda,
        Math.min(posicionActual + distanciaMaximaPendienteRueda, destinoPropuesto),
      );
      const destinoFinal = Math.max(0, Math.min(limite, destinoLimitado));

      evento.preventDefault();
      solicitarDesplazamiento(destinoFinal, tiempoRespuestaRueda);
    }

    window.addEventListener('wheel', manejarRueda, { passive: false });
    window.addEventListener('keydown', manejarFlechas);
    window.addEventListener('keyup', soltarFlecha);
    window.addEventListener('blur', detenerFlechas);
    window.addEventListener('touchstart', detenerFlechas, { passive: true });
    window.addEventListener('pointerdown', detenerFlechas, { passive: true });

    return () => {
      window.removeEventListener('wheel', manejarRueda);
      window.removeEventListener('keydown', manejarFlechas);
      window.removeEventListener('keyup', soltarFlecha);
      window.removeEventListener('blur', detenerFlechas);
      window.removeEventListener('touchstart', detenerFlechas);
      window.removeEventListener('pointerdown', detenerFlechas);
      if (cuadroScroll !== null) window.cancelAnimationFrame(cuadroScroll);
      if (cuadroFlecha !== null) window.cancelAnimationFrame(cuadroFlecha);
    };
  }, []);

  useEffect(() => {
    const recorrido = heroRecorridoRef.current;
    if (!recorrido) return undefined;

    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (movimientoReducido) {
      setProgresoHero(1);
      return undefined;
    }

    let cuadroLectura = null;
    let cuadroAnimacion = null;
    let tiempoAnterior = 0;
    let primeraLectura = true;

    function actualizarProgreso() {
      cuadroLectura = null;
      const tramo = recorrido.offsetHeight - window.innerHeight;
      if (tramo <= 0) return;

      const inicio = recorrido.getBoundingClientRect().top + window.scrollY;
      const avance = Math.min(1, Math.max(0, (window.scrollY - inicio) / tramo));
      progresoHeroObjetivoRef.current = avance;

      if (primeraLectura) {
        primeraLectura = false;
        progresoHeroActualRef.current = avance;
        setProgresoHero(avance);
        return;
      }

      if (cuadroAnimacion === null) {
        cuadroAnimacion = window.requestAnimationFrame(animarProgreso);
      }
    }

    function solicitarActualizacion() {
      if (cuadroLectura !== null) return;
      cuadroLectura = window.requestAnimationFrame(actualizarProgreso);
    }

    function animarProgreso(tiempo) {
      if (tiempoAnterior === 0) tiempoAnterior = tiempo;

      const deltaTiempo = Math.min((tiempo - tiempoAnterior) / 1000, 0.032);
      tiempoAnterior = tiempo;

      const diferencia = progresoHeroObjetivoRef.current - progresoHeroActualRef.current;
      const suavizado = 1 - Math.exp(-deltaTiempo / 0.28);
      progresoHeroActualRef.current += diferencia * suavizado;

      if (Math.abs(diferencia) < 0.001) {
        progresoHeroActualRef.current = progresoHeroObjetivoRef.current;
        setProgresoHero(progresoHeroActualRef.current);
        cuadroAnimacion = null;
        tiempoAnterior = 0;
        return;
      }

      setProgresoHero(progresoHeroActualRef.current);
      cuadroAnimacion = window.requestAnimationFrame(animarProgreso);
    }

    solicitarActualizacion();
    window.addEventListener('scroll', solicitarActualizacion, { passive: true });
    window.addEventListener('resize', solicitarActualizacion);

    return () => {
      window.removeEventListener('scroll', solicitarActualizacion);
      window.removeEventListener('resize', solicitarActualizacion);
      if (cuadroLectura !== null) window.cancelAnimationFrame(cuadroLectura);
      if (cuadroAnimacion !== null) window.cancelAnimationFrame(cuadroAnimacion);
    };
  }, []);

  useEffect(() => {
    const elementos = document.querySelectorAll('[data-reveal]');
    const fondos = document.querySelectorAll('[data-parallax-background]');
    const espacios = document.querySelectorAll('[data-space-zoom]');
    const seccionesCamara = document.querySelectorAll('[data-camera-seccion]');
    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!('IntersectionObserver' in window)) {
      elementos.forEach((elemento) => elemento.classList.add('is-visible'));
      fondos.forEach((fondo) => fondo.classList.add('parallax-background-ready'));
      return undefined;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          entrada.target.classList.toggle('is-visible', entrada.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: '-6% 0px -8% 0px' },
    );

    elementos.forEach((elemento) => observador.observe(elemento));

    const observadorFondos = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          entrada.target.classList.toggle('parallax-background-ready', entrada.isIntersecting);
        });
      },
      { threshold: 0, rootMargin: '28% 0px 28% 0px' },
    );

    fondos.forEach((fondo) => observadorFondos.observe(fondo));

    let cuadroPendiente = false;

    function actualizarParallax() {
      cuadroPendiente = false;
      fondos.forEach((fondo) => {
        const rectangulo = fondo.getBoundingClientRect();
        const centro = rectangulo.top + rectangulo.height / 2;
        const desplazamiento = Math.max(
          -72,
          Math.min(72, (window.innerHeight / 2 - centro) * 0.12),
        );
        fondo.style.setProperty('--parallax-y', `${desplazamiento}px`);
      });

      espacios.forEach((espacio) => {
        const seccion = espacio.parentElement;
        const rectangulo = seccion.getBoundingClientRect();
        const recorrido = window.innerHeight + rectangulo.height;
        const avance = Math.max(0, Math.min(1, (window.innerHeight - rectangulo.top) / recorrido));
        const avanceSuave = avance * avance * (3 - 2 * avance);
        const seExpande = espacio.dataset.spaceZoom === 'expand';
        const escala = seExpande ? 0.72 + avanceSuave * 0.95 : 1.67 - avanceSuave * 0.95;

        espacio.style.setProperty('--escala-espacial', escala.toFixed(3));
        espacio.style.setProperty(
          '--opacidad-espacial',
          (0.38 + (seExpande ? avanceSuave : 1 - avanceSuave) * 0.22).toFixed(3),
        );
      });

      seccionesCamara.forEach((seccion) => {
        const rectangulo = seccion.getBoundingClientRect();
        const altoVentana = window.innerHeight;
        const entrada = movimientoReducido
          ? 1
          : suavizarProgreso((altoVentana - rectangulo.top) / (altoVentana * 0.8));
        const salida = movimientoReducido
          ? 0
          : suavizarProgreso((altoVentana * 0.68 - rectangulo.bottom) / (altoVentana * 0.68));
        const escala = 1.25 - entrada * 0.25 - salida * 0.1;
        const opacidad = (0.48 + entrada * 0.52) * (1 - salida * 0.9);

        seccion.querySelectorAll('[data-camera-contenido]').forEach((contenido) => {
          contenido.style.setProperty('--escala-camara', escala.toFixed(3));
          contenido.style.setProperty('--opacidad-camara', opacidad.toFixed(3));
        });
      });
    }

    function solicitarParallax() {
      if (cuadroPendiente) return;
      cuadroPendiente = true;
      window.requestAnimationFrame(actualizarParallax);
    }

    solicitarParallax();
    window.addEventListener('scroll', solicitarParallax, { passive: true });
    window.addEventListener('resize', solicitarParallax);

    return () => {
      observador.disconnect();
      observadorFondos.disconnect();
      window.removeEventListener('scroll', solicitarParallax);
      window.removeEventListener('resize', solicitarParallax);
    };
  }, []);

  const progresoHeroSuave = suavizarProgreso(progresoHero);
  const desaparicionMarcaHero = suavizarProgreso((progresoHero - 0.2) / 0.34);
  const aparicionHero = suavizarProgreso((progresoHero - 0.16) / 0.52);
  const fondoHeroProfundo = progresoHero > 0.2 && progresoHero < 0.999;

  return (
    <div className={`pagina-inicio${fondoHeroProfundo ? ' hero-fondo-profundo' : ''}`}>
      <EntradaInicial />
      <ContadorSecciones visible={headerVisible} />
      <header
        className={`encabezado encabezado-tema-${headerTheme}${headerVisible ? ' encabezado-visible' : ' encabezado-oculto'}`}
        aria-hidden={!headerVisible}
        inert={!headerVisible}
      >
        <h1 className="titulo-2">Codexia</h1>
        <nav className="menu-pildora" aria-label="Principal">
          <a href="#hero" className="menu">
            inicio
          </a>
          <a href="#nosotros" className="menu">
            nosotros
          </a>
          <a href="#servicios" className="menu">
            servicios
          </a>
          <a href="#porque-elegirnos" className="menu">
            porque elegirnos
          </a>
          <a href="#asistente" className="menu">
            asistente IA
          </a>
        </nav>
        <a
          id="acceso-principal"
          href={sesionActiva ? './es/asistente.ia/index.html' : './es/cuenta/index.html'}
          className="btn btn-login"
        >
          {sesionActiva ? 'Ir al chat' : 'Iniciar sesión'}
        </a>
      </header>

      <main>
        <div
          className="hero-recorrido"
          data-camera-seccion
          ref={heroRecorridoRef}
          style={{
            '--hero-progreso': progresoHero,
            '--hero-tono-claro': `${Math.round(aparicionHero * 100)}%`,
            '--parallax-y': `${(0.5 - progresoHero) * 40}px`,
            '--hero-aparicion': aparicionHero,
            '--hero-desplazamiento-y': `${(1 - aparicionHero) * 24}px`,
            '--hero-desenfoque': `${(1 - aparicionHero) * 5}px`,
            '--hero-marca-opacidad': 1 - desaparicionMarcaHero,
            '--hero-marca-desplazamiento-y': `${desaparicionMarcaHero * -24}px`,
            '--hero-marca-escala': 1 - desaparicionMarcaHero * 0.08,
            '--hero-copy-escala': 0.96 + aparicionHero * 0.04,
          }}
        >
          <section id="hero" className="hero" data-parallax-background>
            <EsferaParticulas progreso={progresoHeroSuave} />
            <div className="hero-layout" data-camera-contenido>
              <div className="hero-marca">
                <p className="hero-ceja">Ingeniería digital</p>
                <h2 className="hero-titulo" aria-label="Codexia.">
                  {Array.from('CODEXIA').map((letra, indice) => (
                    <span
                      className="letra-codexia"
                      aria-hidden="true"
                      key={`${letra}-${indice}`}
                      style={{ '--espera-letra': `${indice * 0.13}s` }}
                    >
                      {letra}
                    </span>
                  ))}
                  <span className="punto-codexia" aria-hidden="true">
                    .
                  </span>
                </h2>
              </div>
              <div className="hero-copy" inert={progresoHero < 0.52}>
                <p className="hero-etiqueta">Ideas claras. Tecnología que avanza.</p>
                <h3>Diseñamos software para avanzar.</h3>
                <p className="hero-descripcion">
                  Diseñamos y construimos software para que las empresas puedan resolver problemas,
                  trabajar mejor y crecer con confianza.
                </p>
                <div className="hero-acciones">
                  <a href="#nosotros" className="btn">
                    Conoce Codexia
                  </a>
                  <a
                    href="https://wa.me/573175036274?text=Hola%20!%20Quiero%20saber%20más%20sobre%20tus%20servicio."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-fantasma"
                  >
                    Hablemos de tu idea
                  </a>
                </div>
              </div>
            </div>
            <a className="hero-deslizar" href="#nosotros" inert={progresoHero < 0.52}>
              Desliza para explorar <span aria-hidden="true">↓</span>
            </a>
          </section>
        </div>

        <TransicionNosotros />

        <section
          id="nosotros"
          className="seccion seccion-nosotros"
          data-parallax-background
          data-camera-seccion
        >
          <div className="espacio-zoom" data-space-zoom="expand" aria-hidden="true" />
          <div className="contenido nosotros-grid" data-camera-contenido>
            <div className="seccion-titulo nosotros-intro reveal-on-scroll" data-reveal="left">
              <p className="seccion-ceja">Quiénes somos</p>
              <h3>Creamos con propósito.</h3>
              <p className="text">
                Somos una empresa de desarrollo de software con un propósito claro: crear soluciones
                digitales que ayuden a las empresas a mejorar su rendimiento y a lograr sus
                objetivos.
              </p>
            </div>
            <div className="valores-grid">
              {valores.map(([titulo, texto], indice) => (
                <article
                  className="valor-item reveal-on-scroll"
                  data-reveal="up"
                  style={{ '--reveal-delay': `${indice * 90}ms` }}
                  key={titulo}
                >
                  <h4>{titulo}</h4>
                  <p>{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="servicios"
          className="seccion seccion-servicios"
          data-parallax-background
          data-camera-seccion
        >
          <Servicios2D servicios={servicios} />
        </section>

        <section
          id="porque-elegirnos"
          className="seccion seccion-porque"
          data-parallax-background
          data-camera-seccion
        >
          <div className="contenido" data-camera-contenido>
            <div className="seccion-titulo reveal-on-scroll" data-reveal="left">
              <p className="seccion-ceja">Una colaboración bien pensada</p>
              <h3>Tu éxito, respaldado por nuestra ingeniería</h3>
            </div>
            <div className="razones-grid">
              {beneficios.map(([titulo, texto], indice) => (
                <article
                  className="razon-item reveal-on-scroll"
                  data-reveal="up"
                  style={{ '--reveal-delay': `${indice * 90}ms` }}
                  key={titulo}
                >
                  <h4>{titulo}</h4>
                  <p>{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="asistente"
          className="seccion seccion-asistente"
          data-parallax-background
          data-camera-seccion
        >
          <div className="espacio-zoom" data-space-zoom="recede" aria-hidden="true" />
          <div className="contenido asistente-grid" data-camera-contenido>
            <div className="asistente-intro reveal-on-scroll" data-reveal="left">
              <div className="seccion-titulo">
                <p className="seccion-ceja">Tu siguiente paso</p>
                <h3>Empieza por contar tu idea.</h3>
                <p className="text">
                  Nuestra asistente te ayuda a ordenar lo que necesitas y conocer cómo podemos
                  acompañarte.
                </p>
              </div>
              <p className="asistente-nota">Una primera conversación para encontrar el rumbo.</p>
            </div>
            <div className="asistente-chat reveal-on-scroll" data-reveal="right">
              <div
                className="chat-ejemplo"
                role="img"
                aria-label="Ejemplo de conversación con la asistente"
              >
                <p className="burbuja burbuja-usuario">
                  Quiero una app para mi negocio, pero aún no sé por dónde empezar.
                </p>
                <p className="burbuja burbuja-ia">
                  Cuéntame: ¿qué problema quieres resolver y quién la usaría?
                </p>
              </div>
              <a href="./es/asistente.ia/index.html" className="btn">
                Habla con nuestra asistente de IA
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer id="contacto">
        <div className="contenedor-footer">
          <h4>Codexia</h4>
          <p>Transformamos ideas en soluciones digitales.</p>
          <p>© 2026 Codexia.</p>
          <p>Todos los derechos reservados.</p>
        </div>
        <div className="footer-links">
          <a
            href="https://github.com/Jhon-DMM"
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="GitHub de Codexia"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
          </a>
          <a
            href="https://wa.me/573175036274?text=Hola%20!%20Quiero%20saber%20más%20sobre%20tus%20servicio."
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon"
            aria-label="Contactar por WhatsApp"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </a>
          <a
            href="mailto:jhxnmondragon@gmail.com"
            className="social-icon"
            aria-label="Enviar correo"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </a>
        </div>
        <nav className="footer-legales" aria-label="Información legal">
          <a href="./es/legal/terminos.html">Términos y condiciones</a>
          <a href="./es/legal/privacidad.html">Política de privacidad</a>
          <a href="./es/legal/cookies.html">Política de cookies</a>
          <a href="./es/legal/reembolsos.html">Política de reembolsos</a>
        </nav>
      </footer>
    </div>
  );
}

export default Home;

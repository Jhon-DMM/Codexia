import React, { useEffect, useRef } from 'react';
import logoCodexia from '../../../img/Codexia.svg';
import RedInteractiva from './RedInteractiva';

const enfoquesServicios = [
  ['Experiencias claras', 'Diseño adaptable', 'Rendimiento web'],
  ['Procesos a medida', 'Integraciones útiles', 'Datos organizados'],
  ['Prevención de riesgos', 'Buenas prácticas', 'Protección de datos'],
  ['Tareas automatizadas', 'Asistentes inteligentes', 'Mejores decisiones'],
];

function crearLetrasAnimadas(texto, semilla) {
  let indiceLetra = 0;

  return texto.split(/(\s+)/).map((parte, indiceParte) => {
    if (/^\s+$/.test(parte)) return parte;

    return (
      <span className="servicios-mini-palabra" key={`${semilla}-palabra-${indiceParte}`}>
        {Array.from(parte).map((caracter) => {
          const base = (indiceLetra + 1) * 12.9898 + semilla * 78.233;
          const aleatorio = (valor) => {
            const seno = Math.sin(valor) * 43758.5453;
            return seno - Math.floor(seno);
          };
          const llave = `${semilla}-${indiceLetra}`;
          indiceLetra += 1;

          return (
            <span
              className="servicios-mini-letra"
              aria-hidden="true"
              data-desorden-x={`${(aleatorio(base) - 0.5) * 190}`}
              data-desorden-y={`${(aleatorio(base + 31) - 0.5) * 150}`}
              data-desorden-giro={`${(aleatorio(base + 67) - 0.5) * 54}`}
              key={llave}
            >
              {caracter}
            </span>
          );
        })}
      </span>
    );
  });
}

function crearLetrasEntrada(texto) {
  return Array.from(texto).map((caracter, indice) => (
    <span className="servicios-mini-cierre-mascara" key={`cierre-${indice}`}>
      <span className="servicios-mini-cierre-letra">{caracter}</span>
    </span>
  ));
}

function crearLetrasFrase(texto) {
  return Array.from(texto).map((caracter, indice) => (
    <span className="servicios-mini-cierre-frase-letra" key={`frase-${indice}`}>
      {caracter === ' ' ? '\u00a0' : caracter}
    </span>
  ));
}

function Servicios2D({ servicios }) {
  const recorridoRef = useRef(null);
  const escenarioRef = useRef(null);
  const carrilRef = useRef(null);
  const cantidadSecciones = servicios.length + 2;
  const tramosPausaInicial = 0.18;
  const tramosPausaCierre = 0;
  const tramosTransicionCierreBase = 0.1;
  const duracionLogoBase = 0.12;
  const factorLentitudLogo = 1.82;
  const tramosTransicionCierre = tramosTransicionCierreBase
    + (tramosTransicionCierreBase * duracionLogoBase * (factorLentitudLogo - 1));
  const escalaFasesCierre = tramosTransicionCierreBase / tramosTransicionCierre;
  const tramosPausaFinal = 0;
  const factorDuracionAnimaciones = 1.6;
  const espacioAnimacionContenido = 0.12;
  const cantidadTramosScroll = 1
    + tramosPausaInicial
    + (cantidadSecciones - 1 + espacioAnimacionContenido)
      * factorDuracionAnimaciones
    + tramosPausaCierre
    + tramosTransicionCierre
    + tramosPausaFinal;

  useEffect(() => {
    const recorrido = recorridoRef.current;
    const escenario = escenarioRef.current;
    const carril = carrilRef.current;
    const duracionAnimacionEntrada = 2000;
    const esperaTransicionAutomatica = 3000;
    const duracionTransicionAutomatica = 2000;
    const duracionProfundidadFinal = 900;
    const duracionSecuenciaCierre = duracionAnimacionEntrada
      + esperaTransicionAutomatica
      + duracionTransicionAutomatica
      + duracionProfundidadFinal;

    if (!recorrido || !escenario || !carril) return undefined;

    const lineasTitulo = Array.from(
      carril.querySelectorAll('.servicios-mini-intro h3 span'),
    );
    const titulo = carril.querySelector('.servicios-mini-intro h3');
    const miniIntro = carril.querySelector('.servicios-mini-intro');
    const seccionesServicio = Array.from(
      carril.querySelectorAll('.servicios-mini:not(.servicios-mini-intro)'),
    );
    const seccionCierre = carril.querySelector('.servicios-mini-cierre');
    const luzPuntero = seccionCierre?.querySelector('.servicios-mini-cierre-luz-puntero');
    const letrasPorSeccion = seccionesServicio.map((seccion) => (
      Array.from(seccion.querySelectorAll('.servicios-mini-letra'))
    ));
    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rangosLineas = [
      [0.05, 0.4],
      [0.2425, 0.72],
      [0.5051, 1],
    ];
    const distanciasLineas = [315, 430, 445];
    let cuadroPendiente = null;
    let desplazamientoAplicado = 0;
    let inicioAnimacionEntrada = null;
    let secuenciaCierreActiva = false;
    let secuenciaCierreCompletada = false;
    let posicionEntradaBloqueada = null;
    let progresoTransicionAutomatica = 0;
    let progresoProfundidadFinal = 0;

    function aplicarAvancesLineas(avances) {
      lineasTitulo.forEach((linea, indice) => {
        const avance = Math.max(0, Math.min(1, avances[indice]));
        const distanciaEntrada = distanciasLineas[indice] ?? 120;

        linea.style.opacity = String(avance);
        linea.style.transform = movimientoReducido
          ? 'none'
          : `translate3d(${(1 - avance) * distanciaEntrada}px, 0, 0)`;
      });
    }

    function aplicarRecorridoServicios(desplazamiento, faseCierre) {
      seccionesServicio.forEach((seccion, indiceSeccion) => {
        const contenido = seccion.querySelector('.servicios-mini-contenido-servicio');
        if (!contenido) return;
        const letras = letrasPorSeccion[indiceSeccion];
        const esCierre = seccion.classList.contains('servicios-mini-cierre');
        const fondoClaro = seccion.querySelector('.servicios-mini-cierre-fondo');
        const red = seccion.querySelector('.puente-red-interactiva');
        const nombre = seccion.querySelector('.servicios-mini-cierre-nombre');
        const remate = seccion.querySelector('.servicios-mini-cierre-remate');
        const lineaRemate = seccion.querySelector('.servicios-mini-cierre-linea');
        const fraseRemate = seccion.querySelector('.servicios-mini-cierre-frase');
        const letrasNombre = Array.from(seccion.querySelectorAll('.servicios-mini-cierre-letra'));
        const letrasFrase = Array.from(seccion.querySelectorAll('.servicios-mini-cierre-frase-letra'));
        const logo = seccion.querySelector('.servicios-mini-cierre-logo');

        if (movimientoReducido) {
          contenido.style.opacity = '1';
          contenido.style.transform = 'none';
          if (esCierre) {
            const escalaNombre = 0.8;
            const desplazamientoHorizontal = seccion.clientWidth * -0.01;
            const palabraNombre = nombre.querySelector('.servicios-mini-cierre-palabra');
            fondoClaro.style.opacity = '1';
            red.style.opacity = '0.84';
            seccion.querySelector('.servicios-mini-cierre-resplandor').style.opacity = '0';
            nombre.style.color = 'rgb(244, 240, 255)';
            const desplazamientoNombre = (logo.getBoundingClientRect().height / 2)
              + (nombre.offsetHeight * 0.4)
              + 22;
            nombre.style.transform = `translate(calc(-50% + ${desplazamientoHorizontal}px), calc(-50% + ${desplazamientoNombre}px))`;
            palabraNombre.style.transform = `scale(${escalaNombre})`;
            remate.style.opacity = '0';
            letrasNombre.forEach((letra) => {
              letra.style.opacity = '1';
              letra.style.transform = 'none';
            });
            logo.style.opacity = '1';
          }
          letras.forEach((letra) => {
            letra.style.opacity = '1';
            letra.style.transform = 'none';
          });
          return;
        }

        const inicioSeccion = seccion.getBoundingClientRect().left
          + desplazamiento;
        const anchoSeccion = seccion.clientWidth;
        const inicioRecorrido = inicioSeccion - anchoSeccion;
        const progreso = Math.max(
          0,
          Math.min(
            1,
            (desplazamiento - inicioRecorrido) / (anchoSeccion * 2),
          ),
        );

        if (esCierre) {
          const suavizar = (valor) => {
            const avance = Math.max(0, Math.min(1, valor));
            return avance * avance * avance
              * (avance * ((avance * 6) - 15) + 10);
          };
          const suavizarLogo = (valor) => {
            const avance = Math.max(0, Math.min(1, valor));
            const cuadrado = avance * avance;
            const cuarta = cuadrado * cuadrado;
            return cuarta * (35 + (avance * (-84 + (avance * (70 - (20 * avance))))));
          };
          let progresoEntrada = 0;
          if (progreso >= 0.499 && inicioAnimacionEntrada === null) {
            inicioAnimacionEntrada = performance.now();
            posicionEntradaBloqueada = window.scrollY;
            document.documentElement.dataset.codexiaScrollLocked = 'true';
          }
          if (inicioAnimacionEntrada !== null && progreso >= 0.45) {
            const tiempoSecuencia = performance.now() - inicioAnimacionEntrada;
            secuenciaCierreActiva = tiempoSecuencia < duracionSecuenciaCierre;
            progresoEntrada = Math.max(0, Math.min(1, tiempoSecuencia / duracionAnimacionEntrada));
            const tiempoTransicion = tiempoSecuencia
              - duracionAnimacionEntrada
              - esperaTransicionAutomatica;
            progresoTransicionAutomatica = Math.max(
              0,
              Math.min(1, tiempoTransicion / duracionTransicionAutomatica),
            );
            const tiempoProfundidad = tiempoTransicion - duracionTransicionAutomatica;
            progresoProfundidadFinal = Math.max(
              0,
              Math.min(1, tiempoProfundidad / duracionProfundidadFinal),
            );
            if (tiempoSecuencia >= duracionSecuenciaCierre) {
              secuenciaCierreCompletada = true;
              posicionEntradaBloqueada = null;
              delete document.documentElement.dataset.codexiaScrollLocked;
            }
          }
          const faseCierreVisual = inicioAnimacionEntrada === null
            ? faseCierre
            : progresoTransicionAutomatica;
          const cambioFondo = suavizar(
            (faseCierreVisual - (0.08 * escalaFasesCierre)) / (0.42 * escalaFasesCierre),
          );
          if (secuenciaCierreCompletada) {
            const palabraFinal = nombre.querySelector('.servicios-mini-cierre-palabra');
            const desplazamientoHorizontal = seccion.clientWidth * -0.01;
            const desplazamientoNombre = (logo.getBoundingClientRect().height / 2)
              + (nombre.offsetHeight * 0.4)
              + 22;
            fondoClaro.style.opacity = '1';
            red.style.opacity = '0.84';
            seccion.querySelector('.servicios-mini-cierre-resplandor').style.opacity = '0';
            nombre.style.color = 'rgb(80, 70, 228)';
            nombre.style.transform = `translate3d(calc(-50% + ${desplazamientoHorizontal}px), calc(-50% + ${desplazamientoNombre}px), -90px)`;
            palabraFinal.style.transform = 'scale(0.8)';
            letrasNombre.forEach((letra) => {
              letra.style.opacity = '1';
              letra.style.transform = 'none';
            });
            lineaRemate.style.width = `${palabraFinal.getBoundingClientRect().width * 0.9}px`;
            remate.style.opacity = '0';
            lineaRemate.style.transform = 'scaleX(0)';
            logo.style.opacity = '1';
            logo.style.transform = 'translate3d(-50%, -50%, -90px) scale(0.96)';
            contenido.style.opacity = '1';
            contenido.style.transform = 'none';
            return;
          }
          const avanceLinea = suavizar(progresoEntrada / 0.18);
          const progresoTitulo = Math.max(0, Math.min(1, (progresoEntrada - 0.18) / 0.5));
          letrasNombre.forEach((letra, indice) => {
            const retraso = indice * 0.045;
            const avance = suavizar((progresoTitulo - retraso) / 0.22);
            letra.style.opacity = String(Math.max(avance, cambioFondo));
            letra.style.transform = `translate3d(0, ${(1 - avance) * 112}%, 0)`;
          });
          const avanceFrase = suavizar((progresoEntrada - 0.44) / 0.56);
          const letrasReveladas = avanceFrase * letrasFrase.length;
          letrasFrase.forEach((letra, indice) => {
            const avanceLetra = Math.max(0, Math.min(1, letrasReveladas - indice));
            letra.style.opacity = String(avanceLetra);
            letra.style.transform = `translateY(${(1 - avanceLetra) * 2}px)`;
          });
          const encogimientoNombre = suavizar(
            (faseCierreVisual - (0.5 * escalaFasesCierre)) / (0.18 * escalaFasesCierre),
          );
          const descensoNombre = suavizar(
            (faseCierreVisual - (0.68 * escalaFasesCierre)) / (0.2 * escalaFasesCierre),
          );
          const aparicionLogo = suavizarLogo(
            (faseCierreVisual - (0.88 * escalaFasesCierre))
              / (duracionLogoBase * factorLentitudLogo * escalaFasesCierre),
          );
          const palabraNombre = nombre.querySelector('.servicios-mini-cierre-palabra');
          const lavanda = [244, 240, 255];
          const morado = [80, 70, 228];
          const colorNombre = lavanda.map((canal, indice) => (
            Math.round(canal + ((morado[indice] - canal) * cambioFondo))
          ));
          const escalaNombre = 1.95 - (1.15 * encogimientoNombre);
          const desplazamientoNombre = ((logo.getBoundingClientRect().height / 2)
            + (nombre.offsetHeight * 0.4)
            + 22) * descensoNombre;
          const desplazamientoHorizontal = seccion.clientWidth * -0.01;
          const desplazamientoProfundidad = -90 * progresoProfundidadFinal;
          fondoClaro.style.opacity = String(cambioFondo);
          red.style.opacity = String(cambioFondo * 0.84);
          seccion.querySelector('.servicios-mini-cierre-resplandor').style.opacity = String(1 - cambioFondo);
          nombre.style.color = `rgb(${colorNombre.join(', ')})`;
          nombre.style.transform = `translate3d(calc(-50% + ${desplazamientoHorizontal}px), calc(-50% + ${desplazamientoNombre}px), ${desplazamientoProfundidad}px)`;
          palabraNombre.style.transform = `scale(${escalaNombre})`;
          lineaRemate.style.width = `${palabraNombre.getBoundingClientRect().width * 0.9}px`;
          remate.style.opacity = String(1 - cambioFondo);
          remate.style.transform = `translateX(calc(-50% + ${desplazamientoHorizontal}px))`;
          lineaRemate.style.transform = `scaleX(${avanceLinea})`;
          fraseRemate.style.transform = `translate3d(0, ${(1 - avanceFrase) * 10}px, 0)`;
          logo.style.opacity = String(aparicionLogo);
          logo.style.transform = `translate3d(-50%, -50%, ${desplazamientoProfundidad}px) scale(${1 - (0.04 * progresoProfundidadFinal)})`;
          contenido.style.opacity = '1';
          contenido.style.transform = 'none';
          return;
        }

        const progresoRevelado = Math.max(0, Math.min(1, progreso / 0.36));
        const progresoOpacidad = Math.max(0, Math.min(1, progreso / 0.16, (1 - progreso) / 0.16));
        const progresoSuave = Math.max(0, Math.min(1, progreso / 0.54));
        const progresoOrganizacion = progresoSuave * progresoSuave * (3 - (2 * progresoSuave));

        letras.forEach((letra, indiceLetra) => {
          const retraso = Math.min(indiceLetra, 18) * 0.004;
          const avanceLetra = Math.max(
            0,
            Math.min(1, (progresoOrganizacion - retraso) / (1 - retraso)),
          );
          const dispersiónRestante = 1 - avanceLetra;
          const x = Number(letra.dataset.desordenX) * dispersiónRestante;
          const y = Number(letra.dataset.desordenY) * dispersiónRestante;
          const giro = Number(letra.dataset.desordenGiro) * dispersiónRestante;

          letra.style.opacity = String(0.42 + (avanceLetra * 0.58));
          letra.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${giro}deg)`;
        });

        contenido.style.opacity = String(progresoOpacidad);
        contenido.style.transform = `translate3d(0, ${(1 - progresoRevelado) * 24}px, 0)`;
      });
    }

    function actualizarRecorrido() {
      cuadroPendiente = null;

      if (
        inicioAnimacionEntrada !== null
        && performance.now() - inicioAnimacionEntrada < duracionSecuenciaCierre
        && posicionEntradaBloqueada !== null
        && Math.abs(window.scrollY - posicionEntradaBloqueada) > 1
      ) {
        window.scrollTo(0, posicionEntradaBloqueada);
      }

      const desplazamientoVertical = Math.max(0, -recorrido.getBoundingClientRect().top);
      const pausaInicial = escenario.clientHeight * tramosPausaInicial;
      const duracionRecorridoHorizontal = escenario.clientHeight
        * (cantidadSecciones - 1 + espacioAnimacionContenido)
        * factorDuracionAnimaciones;
      const pausaCierre = escenario.clientHeight * tramosPausaCierre;
      const duracionTransicionCierre = escenario.clientHeight * tramosTransicionCierre;
      const avanceHorizontal = Math.max(0, desplazamientoVertical - pausaInicial);
      const progreso = Math.min(1, avanceHorizontal / duracionRecorridoHorizontal);
      const inicioTransicionCierre = duracionRecorridoHorizontal + pausaCierre;
      const faseCierre = Math.max(
        0,
        Math.min(1, (avanceHorizontal - inicioTransicionCierre) / duracionTransicionCierre),
      );
      const ultimaSeccion = carril.lastElementChild;
      const distanciaHorizontal = ultimaSeccion
        ? Math.max(
          ultimaSeccion.getBoundingClientRect().left
            - carril.getBoundingClientRect().left,
          0,
        )
        : 0;
      const desplazamientoObjetivo = distanciaHorizontal * progreso;

      const altoVentana = window.innerHeight;
      const arribaIntro = miniIntro.getBoundingClientRect().top;
      const inicioRevelado = altoVentana * 1.1;
      const inicioTituloScroll = window.scrollY + arribaIntro - inicioRevelado;
      const tituloRect = titulo.getBoundingClientRect();
      const centroTituloSinRecorrido = tituloRect.left
        + tituloRect.width / 2
        + desplazamientoAplicado;
      const desplazamientoParaCentro = centroTituloSinRecorrido - window.innerWidth / 2;
      const progresoCentro = distanciaHorizontal > 0
        ? Math.max(0, Math.min(1, desplazamientoParaCentro / distanciaHorizontal))
        : 1;
      const inicioRecorridoScroll = window.scrollY
        + recorrido.getBoundingClientRect().top;
      const finTituloScroll = inicioRecorridoScroll
        + pausaInicial
        + duracionRecorridoHorizontal * progresoCentro;
      const duracionTituloScroll = Math.max(finTituloScroll - inicioTituloScroll, 1);

      carril.style.transform = `translate3d(${-desplazamientoObjetivo}px, 0, 0)`;
      desplazamientoAplicado = desplazamientoObjetivo;
      aplicarRecorridoServicios(desplazamientoObjetivo, faseCierre);

      const avanceTitulo = movimientoReducido
        ? 1
        : Math.max(0, Math.min(1, (window.scrollY - inicioTituloScroll) / duracionTituloScroll));
      const avancesLineas = lineasTitulo.map((_, indice) => {
        const [inicio, fin] = rangosLineas[indice] ?? [0, 1];
        return Math.max(0, Math.min(1, (avanceTitulo - inicio) / (fin - inicio)));
      });

      aplicarAvancesLineas(avancesLineas);
      if (secuenciaCierreActiva) solicitarActualizacion();
    }

    function solicitarActualizacion() {
      if (cuadroPendiente !== null) return;
      cuadroPendiente = window.requestAnimationFrame(actualizarRecorrido);
    }

    function seguirPuntero(evento) {
      if (!luzPuntero || movimientoReducido) return;
      const limites = seccionCierre.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((evento.clientX - limites.left) / limites.width) * 100));
      const y = Math.max(0, Math.min(100, ((evento.clientY - limites.top) / limites.height) * 100));
      luzPuntero.style.left = `${x}%`;
      luzPuntero.style.top = `${y}%`;
    }

    function restablecerLuzPuntero() {
      if (!luzPuntero) return;
      luzPuntero.style.left = '50%';
      luzPuntero.style.top = '42%';
    }

    function bloquearScrollDuranteEntrada(evento) {
      const teclasScroll = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'];
      if (evento.type === 'keydown' && !teclasScroll.includes(evento.key)) return;

      if (
        inicioAnimacionEntrada !== null
        && performance.now() - inicioAnimacionEntrada < duracionSecuenciaCierre
      ) {
        evento.preventDefault();
      }
    }

    function manejarDesplazamiento() {
      const bloqueoActivo = inicioAnimacionEntrada !== null
        && performance.now() - inicioAnimacionEntrada < duracionSecuenciaCierre;
      if (
        bloqueoActivo
        && posicionEntradaBloqueada !== null
        && Math.abs(window.scrollY - posicionEntradaBloqueada) > 1
      ) {
        window.scrollTo(0, posicionEntradaBloqueada);
      }
      solicitarActualizacion();
    }

    solicitarActualizacion();
    window.addEventListener('scroll', manejarDesplazamiento, { passive: true });
    window.addEventListener('resize', solicitarActualizacion);
    window.addEventListener('wheel', bloquearScrollDuranteEntrada, { passive: false, capture: true });
    window.addEventListener('touchmove', bloquearScrollDuranteEntrada, { passive: false, capture: true });
    window.addEventListener('keydown', bloquearScrollDuranteEntrada, true);
    seccionCierre?.addEventListener('pointermove', seguirPuntero, { passive: true });
    seccionCierre?.addEventListener('pointerleave', restablecerLuzPuntero, { passive: true });

    return () => {
      window.removeEventListener('scroll', manejarDesplazamiento);
      window.removeEventListener('resize', solicitarActualizacion);
      window.removeEventListener('wheel', bloquearScrollDuranteEntrada, true);
      window.removeEventListener('touchmove', bloquearScrollDuranteEntrada, true);
      window.removeEventListener('keydown', bloquearScrollDuranteEntrada, true);
      seccionCierre?.removeEventListener('pointermove', seguirPuntero);
      seccionCierre?.removeEventListener('pointerleave', restablecerLuzPuntero);
      delete document.documentElement.dataset.codexiaScrollLocked;
      if (cuadroPendiente !== null) window.cancelAnimationFrame(cuadroPendiente);
      lineasTitulo.forEach((linea) => {
        linea.style.removeProperty('opacity');
        linea.style.removeProperty('transform');
      });
      seccionesServicio.forEach((seccion) => {
        const contenido = seccion.querySelector('.servicios-mini-contenido-servicio');
        contenido?.style.removeProperty('opacity');
        contenido?.style.removeProperty('transform');
        seccion.querySelector('.servicios-mini-cierre-fondo')?.style.removeProperty('opacity');
        seccion.querySelector('.servicios-mini-cierre-resplandor')?.style.removeProperty('opacity');
        seccion.querySelector('.puente-red-interactiva')?.style.removeProperty('opacity');
        seccion.querySelector('.servicios-mini-cierre-nombre')?.style.removeProperty('color');
        seccion.querySelector('.servicios-mini-cierre-nombre')?.style.removeProperty('transform');
        seccion.querySelector('.servicios-mini-cierre-palabra')?.style.removeProperty('transform');
        seccion.querySelector('.servicios-mini-cierre-remate')?.style.removeProperty('opacity');
        seccion.querySelector('.servicios-mini-cierre-remate')?.style.removeProperty('transform');
        seccion.querySelector('.servicios-mini-cierre-linea')?.style.removeProperty('transform');
        seccion.querySelector('.servicios-mini-cierre-linea')?.style.removeProperty('width');
        seccion.querySelector('.servicios-mini-cierre-frase')?.style.removeProperty('transform');
        seccion.querySelectorAll('.servicios-mini-cierre-frase-letra').forEach((letra) => {
          letra.style.removeProperty('opacity');
          letra.style.removeProperty('transform');
        });
        seccion.querySelectorAll('.servicios-mini-cierre-letra').forEach((letra) => {
          letra.style.removeProperty('opacity');
          letra.style.removeProperty('transform');
        });
        seccion.querySelector('.servicios-mini-cierre-logo')?.style.removeProperty('opacity');
        seccion.querySelector('.servicios-mini-cierre-logo')?.style.removeProperty('transform');
        seccion.querySelectorAll('.servicios-mini-letra').forEach((letra) => {
          letra.style.removeProperty('opacity');
          letra.style.removeProperty('transform');
        });
      });
    };
  }, [cantidadSecciones]);

  return (
    <div
      className="servicios-recorrido"
      ref={recorridoRef}
      style={{ '--cantidad-tramos': cantidadTramosScroll }}
    >
      <div className="servicios-escenario" ref={escenarioRef}>
        <div
          className="servicios-simple"
          ref={carrilRef}
          role="region"
          aria-label="Servicios de Codexia. El desplazamiento vertical recorre seis secciones horizontalmente."
        >
          <article
            className="servicios-mini servicios-mini-intro reveal-on-scroll"
            data-reveal="left"
          >
            <span className="servicios-mini-numero" aria-hidden="true">01</span>
            <div className="servicios-mini-contenido">
              <p className="servicios-simple-ceja">Lo que hacemos · 04 especialidades</p>
              <h3>
                <span data-title-line>IDEAS CLARAS.</span>
                <span data-title-line>TECNOLOGÍA</span>
                <span data-title-line>QUE AVANZA.</span>
              </h3>
              <p className="servicios-simple-introduccion">
                Creamos soluciones digitales útiles, seguras y listas para crecer junto a tu negocio.
              </p>
              <p className="servicios-simple-pista" aria-hidden="true">
                <span>↓</span> Desplázate para explorar
              </p>
            </div>
          </article>

          {servicios.map((servicio, indice) => (
            <article
              className={`servicios-mini servicios-mini-servicio servicio-panel-${indice + 1}`}
              key={servicio.titulo}
            >
              <span className="servicios-mini-numero-fondo" aria-hidden="true">
                {crearLetrasAnimadas(`0${indice + 1}`, indice + 1)}
              </span>
              <span className="servicios-mini-numero" aria-hidden="true">
                {String(indice + 2).padStart(2, '0')} / 05
              </span>
              <div className="servicios-mini-contenido-servicio">
                <div className="servicios-mini-texto">
                  <p className="servicios-mini-categoria">Especialidad 0{indice + 1}</p>
                  <h3 aria-label={servicio.titulo}>
                    {crearLetrasAnimadas(servicio.titulo, indice + 5)}
                  </h3>
                  <p className="servicios-mini-descripcion">{servicio.texto}</p>
                  <p className="servicios-mini-etiqueta">Tecnologías y herramientas</p>
                  <ul className="servicios-mini-herramientas" aria-label="Tecnologías y herramientas">
                    {servicio.herramientas.map((herramienta) => (
                      <li key={herramienta}>{herramienta}</li>
                    ))}
                  </ul>
                </div>
                <div className="servicios-mini-enfoques" aria-label={`Enfoque de ${servicio.titulo}`}>
                  <p>Enfoque</p>
                  <ol>
                    {enfoquesServicios[indice].map((enfoque, enfoqueIndice) => (
                      <li key={enfoque}>
                        <span className="servicios-mini-enfoque-numero">
                          0{enfoqueIndice + 1}
                        </span>
                        <span>{enfoque}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>
          ))}

          <article className="servicios-mini servicios-mini-cierre" aria-label="Codexia">
            <div className="servicios-mini-cierre-fondo" aria-hidden="true" />
            <div className="servicios-mini-cierre-resplandor" aria-hidden="true">
              <span className="servicios-mini-cierre-luz-puntero" />
            </div>
            <RedInteractiva />
            <h3 className="servicios-mini-cierre-nombre" aria-hidden="true">
              <span className="servicios-mini-cierre-palabra">{crearLetrasEntrada('CODEXIA')}</span>
            </h3>
            <div className="servicios-mini-cierre-remate" aria-hidden="true">
              <span className="servicios-mini-cierre-linea" />
              <p className="servicios-mini-cierre-frase">
                {crearLetrasFrase('Software a la medida de tu idea')}
              </p>
            </div>
            <div className="servicios-mini-contenido-servicio servicios-mini-cierre-contenido">
              <img className="servicios-mini-cierre-logo" src={logoCodexia} alt="Codexia" />
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export default Servicios2D;

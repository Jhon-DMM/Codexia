import React, { useEffect, useRef, useState } from 'react';
import RedInteractiva from './RedInteractiva.jsx';

function suavizar(valor) {
  const limitado = Math.max(0, Math.min(1, valor));
  return limitado * limitado * limitado * (limitado * (limitado * 6 - 15) + 10);
}

function TransicionNosotros() {
  const recorridoRef = useRef(null);
  const progresoActualRef = useRef(0);
  const progresoObjetivoRef = useRef(0);
  const [progreso, setProgreso] = useState(0);
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const recorrido = recorridoRef.current;
    if (!recorrido) return undefined;

    if (movimientoReducido) {
      progresoActualRef.current = 0.5;
      setProgreso(0.5);
      return undefined;
    }

    let cuadroLectura = null;
    let cuadroAnimacion = null;
    let tiempoAnterior = 0;
    let primeraLectura = true;

    function leerProgreso() {
      cuadroLectura = null;
      const recorridoScroll = recorrido.offsetHeight - window.innerHeight;
      const limites = recorrido.getBoundingClientRect();
      const avance = recorridoScroll > 1
        ? Math.max(0, Math.min(1, -limites.top / recorridoScroll))
        : Math.max(0, Math.min(1, (window.innerHeight - limites.top) / (window.innerHeight + limites.height)));

      progresoObjetivoRef.current = avance;

      if (primeraLectura) {
        primeraLectura = false;
        progresoActualRef.current = avance;
        setProgreso(avance);
        return;
      }

      if (cuadroAnimacion === null) {
        cuadroAnimacion = window.requestAnimationFrame(animarProgreso);
      }
    }

    function solicitarLectura() {
      if (cuadroLectura !== null) return;
      cuadroLectura = window.requestAnimationFrame(leerProgreso);
    }

    function animarProgreso(tiempo) {
      if (tiempoAnterior === 0) tiempoAnterior = tiempo;

      const deltaTiempo = Math.min((tiempo - tiempoAnterior) / 1000, 0.032);
      tiempoAnterior = tiempo;

      const diferencia = progresoObjetivoRef.current - progresoActualRef.current;
      const suavizado = 1 - Math.exp(-deltaTiempo / 0.32);
      progresoActualRef.current += diferencia * suavizado;

      if (Math.abs(diferencia) < 0.001) {
        progresoActualRef.current = progresoObjetivoRef.current;
        setProgreso(progresoActualRef.current);
        cuadroAnimacion = null;
        tiempoAnterior = 0;
        return;
      }

      setProgreso(progresoActualRef.current);
      cuadroAnimacion = window.requestAnimationFrame(animarProgreso);
    }

    solicitarLectura();
    window.addEventListener('scroll', solicitarLectura, { passive: true });
    window.addEventListener('resize', solicitarLectura);

    return () => {
      window.removeEventListener('scroll', solicitarLectura);
      window.removeEventListener('resize', solicitarLectura);
      if (cuadroLectura !== null) window.cancelAnimationFrame(cuadroLectura);
      if (cuadroAnimacion !== null) window.cancelAnimationFrame(cuadroAnimacion);
    };
  }, [movimientoReducido]);

  const entrada = suavizar(progreso / 0.16);
  const salida = suavizar((progreso - 0.86) / 0.14);
  const opacidad = entrada * (1 - salida);
  const desplazamientoHorizontal = (progreso - 0.5) * window.innerWidth * 0.82;
  const escala = 1;

  return (
    <div
      className="puente-nosotros-recorrido"
      ref={recorridoRef}
      aria-hidden="true"
      style={{
        '--puente-opacidad': opacidad,
        '--puente-x-quienes': `${desplazamientoHorizontal}px`,
        '--puente-x-somos': `${-desplazamientoHorizontal}px`,
        '--puente-escala': escala,
      }}
    >
      <div className="puente-nosotros">
        <RedInteractiva />
        <p className="puente-nosotros-ceja">Codexia · Nuestra esencia</p>
        <div className="puente-nosotros-titulo">
          <span className="puente-palabra puente-palabra-quienes">Quiénes</span>
          <span className="puente-palabra puente-palabra-somos">Somos</span>
        </div>
        <span className="puente-nosotros-guia">Una idea, una intención, un equipo.</span>
      </div>
    </div>
  );
}

export default TransicionNosotros;

import React, { useEffect, useState } from 'react';

const TOTAL_SECCIONES = 12;

function contienePunto(rectangulo, puntoY) {
  return puntoY >= rectangulo.top && puntoY < rectangulo.bottom;
}

function ContadorSecciones({ visible }) {
  const [indiceActual, setIndiceActual] = useState(0);

  useEffect(() => {
    let cuadroPendiente = null;

    function actualizarSeccion() {
      cuadroPendiente = null;
      const puntoY = window.innerHeight / 2;
      const hero = document.querySelector('.hero-recorrido');

      if (hero && contienePunto(hero.getBoundingClientRect(), puntoY)) {
        const rango = Math.max(hero.offsetHeight - window.innerHeight, 1);
        const inicio = hero.getBoundingClientRect().top + window.scrollY;
        const progreso = Math.max(0, Math.min(1, (window.scrollY - inicio) / rango));
        setIndiceActual(progreso >= 0.2 ? 1 : 0);
        return;
      }

      const transicionNosotros = document.querySelector('.puente-nosotros-recorrido');
      const nosotros = document.querySelector('#nosotros');
      if (
        (transicionNosotros && contienePunto(transicionNosotros.getBoundingClientRect(), puntoY))
        || (nosotros && contienePunto(nosotros.getBoundingClientRect(), puntoY))
      ) {
        setIndiceActual(2);
        return;
      }

      const recorridoServicios = document.querySelector('.servicios-recorrido');
      if (recorridoServicios && contienePunto(recorridoServicios.getBoundingClientRect(), puntoY)) {
        const minis = Array.from(document.querySelectorAll('.servicios-mini'));
        const centroX = window.innerWidth / 2;
        let indiceMini = 0;
        let distanciaCercana = Number.POSITIVE_INFINITY;

        minis.forEach((mini, indice) => {
          const rectangulo = mini.getBoundingClientRect();
          const distancia = Math.abs(rectangulo.left + rectangulo.width / 2 - centroX);
          if (distancia < distanciaCercana) {
            distanciaCercana = distancia;
            indiceMini = indice;
          }
        });

        setIndiceActual(3 + indiceMini);
        return;
      }

      const tramosPosteriores = [
        ['#porque-elegirnos', 9],
        ['#asistente', 10],
        ['footer', 11],
      ];
      let indiceMasCercano = 2;
      let distanciaMasCercana = Number.POSITIVE_INFINITY;

      tramosPosteriores.forEach(([selector, indice]) => {
        const elemento = document.querySelector(selector);
        if (!elemento) return;
        const rectangulo = elemento.getBoundingClientRect();
        const distancia = puntoY < rectangulo.top
          ? rectangulo.top - puntoY
          : puntoY > rectangulo.bottom
            ? puntoY - rectangulo.bottom
            : 0;

        if (distancia < distanciaMasCercana) {
          distanciaMasCercana = distancia;
          indiceMasCercano = indice;
        }
      });

      setIndiceActual(indiceMasCercano);
    }

    function solicitarActualizacion() {
      if (cuadroPendiente !== null) return;
      cuadroPendiente = window.requestAnimationFrame(actualizarSeccion);
    }

    solicitarActualizacion();
    window.addEventListener('scroll', solicitarActualizacion, { passive: true });
    window.addEventListener('resize', solicitarActualizacion);

    return () => {
      window.removeEventListener('scroll', solicitarActualizacion);
      window.removeEventListener('resize', solicitarActualizacion);
      if (cuadroPendiente !== null) window.cancelAnimationFrame(cuadroPendiente);
    };
  }, []);

  return (
    <output
      className={`contador-secciones${visible ? ' contador-secciones-visible' : ' contador-secciones-oculto'}`}
      aria-hidden={!visible}
      aria-label={`Sección ${indiceActual + 1} de ${TOTAL_SECCIONES}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {indiceActual + 1}/{TOTAL_SECCIONES}
    </output>
  );
}

export default ContadorSecciones;

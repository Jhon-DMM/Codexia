import React, { useEffect, useRef } from 'react';

function numeroPseudoaleatorio(indice) {
  const valor = Math.sin(indice * 127.1 + 311.7) * 43758.5453;
  return valor - Math.floor(valor);
}

function RedInteractiva() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const contexto = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !contexto) return undefined;

    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const puntero = { x: null, y: null, pulso: null };
    let nodos = [];
    let ancho = 0;
    let alto = 0;
    let pixelRatio = 1;
    let animacion = null;
    let visible = false;

    function crearNodos() {
      const cantidad = Math.max(24, Math.min(96, Math.round((ancho * alto) / 8200)));
      nodos = Array.from({ length: cantidad }, (_, indice) => ({
        x: numeroPseudoaleatorio(indice + 1) * ancho,
        y: numeroPseudoaleatorio(indice + 101) * alto,
        radio: 0.8 + numeroPseudoaleatorio(indice + 201) * 1.2,
        fase: numeroPseudoaleatorio(indice + 301) * Math.PI * 2,
      }));
    }

    function cambiarTamano() {
      const limites = canvas.getBoundingClientRect();
      ancho = limites.width;
      alto = limites.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(ancho * pixelRatio);
      canvas.height = Math.round(alto * pixelRatio);
      contexto.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      crearNodos();

      if (movimientoReducido) dibujar(0);
    }

    function dibujar(tiempo) {
      contexto.clearRect(0, 0, ancho, alto);

      const radioInteraccion = Math.min(190, Math.max(120, ancho * 0.18));
      const hayPuntero = puntero.x !== null && puntero.y !== null;

      if (hayPuntero) {
        const brillo = contexto.createRadialGradient(
          puntero.x,
          puntero.y,
          0,
          puntero.x,
          puntero.y,
          radioInteraccion,
        );
        brillo.addColorStop(0, 'rgba(122, 103, 221, 0.22)');
        brillo.addColorStop(1, 'rgba(122, 103, 221, 0)');
        contexto.fillStyle = brillo;
        contexto.fillRect(0, 0, ancho, alto);
      }

      const posiciones = nodos.map((nodo) => {
        const derivaX = movimientoReducido ? 0 : Math.sin(tiempo * 0.00028 + nodo.fase) * 5;
        const derivaY = movimientoReducido ? 0 : Math.cos(tiempo * 0.00024 + nodo.fase) * 5;
        let x = nodo.x + derivaX;
        let y = nodo.y + derivaY;

        if (hayPuntero) {
          const diferenciaX = x - puntero.x;
          const diferenciaY = y - puntero.y;
          const distancia = Math.hypot(diferenciaX, diferenciaY);

          if (distancia > 0 && distancia < radioInteraccion) {
            const fuerza = ((radioInteraccion - distancia) / radioInteraccion) * 22;
            x += (diferenciaX / distancia) * fuerza;
            y += (diferenciaY / distancia) * fuerza;
          }
        }

        return { x, y, radio: nodo.radio, fase: nodo.fase };
      });

      for (let indice = 0; indice < posiciones.length; indice += 1) {
        for (let siguiente = indice + 1; siguiente < posiciones.length; siguiente += 1) {
          const primero = posiciones[indice];
          const segundo = posiciones[siguiente];
          const distancia = Math.hypot(primero.x - segundo.x, primero.y - segundo.y);
          const distanciaMaxima = ancho < 600 ? 105 : 145;

          if (distancia > distanciaMaxima) continue;

          let realce = 0;
          if (hayPuntero) {
            const centroX = (primero.x + segundo.x) / 2;
            const centroY = (primero.y + segundo.y) / 2;
            const distanciaPuntero = Math.hypot(centroX - puntero.x, centroY - puntero.y);
            realce = Math.max(0, 1 - distanciaPuntero / radioInteraccion);
          }

          const opacidad = 0.055 + (1 - distancia / distanciaMaxima) * 0.15 + realce * 0.28;
          contexto.beginPath();
          contexto.moveTo(primero.x, primero.y);
          contexto.lineTo(segundo.x, segundo.y);
          contexto.strokeStyle = `rgba(91, 78, 164, ${opacidad})`;
          contexto.lineWidth = 0.75 + realce * 0.7;
          contexto.stroke();
        }
      }

      posiciones.forEach((nodo, indice) => {
        const brillo = hayPuntero
          ? Math.max(0, 1 - Math.hypot(nodo.x - puntero.x, nodo.y - puntero.y) / radioInteraccion)
          : 0;
        const latido = movimientoReducido ? 0 : (Math.sin(tiempo * 0.001 + nodo.fase) + 1) * 0.08;

        contexto.beginPath();
        contexto.arc(nodo.x, nodo.y, nodo.radio + brillo * 1.1, 0, Math.PI * 2);
        contexto.fillStyle = `rgba(101, 87, 200, ${0.3 + latido + brillo * 0.64})`;
        contexto.fill();

        if (brillo > 0.6 || indice % 17 === 0) {
          contexto.beginPath();
          contexto.arc(nodo.x, nodo.y, nodo.radio + 4 + brillo * 4, 0, Math.PI * 2);
          contexto.strokeStyle = `rgba(101, 87, 200, ${0.12 + brillo * 0.26})`;
          contexto.lineWidth = 0.7;
          contexto.stroke();
        }
      });

      if (puntero.pulso) {
        const edad = (tiempo - puntero.pulso.tiempo) / 720;
        if (edad < 1) {
          contexto.beginPath();
          contexto.arc(puntero.pulso.x, puntero.pulso.y, 12 + edad * 76, 0, Math.PI * 2);
          contexto.strokeStyle = `rgba(101, 87, 200, ${(1 - edad) * 0.3})`;
          contexto.lineWidth = 1.2;
          contexto.stroke();
        } else {
          puntero.pulso = null;
        }
      }

      if (visible && !movimientoReducido) {
        animacion = window.requestAnimationFrame(dibujar);
      }
    }

    function actualizarPuntero(evento) {
      const limites = canvas.getBoundingClientRect();
      puntero.x = evento.clientX - limites.left;
      puntero.y = evento.clientY - limites.top;
      if (movimientoReducido) dibujar(performance.now());
    }

    function iniciarPulso(evento) {
      actualizarPuntero(evento);
      puntero.pulso = { x: puntero.x, y: puntero.y, tiempo: performance.now() };
      if (movimientoReducido) dibujar(performance.now());
    }

    function salirDelPuntero() {
      puntero.x = null;
      puntero.y = null;
      if (movimientoReducido) dibujar(performance.now());
    }

    function observarVisibilidad(entradas) {
      visible = entradas.some((entrada) => entrada.isIntersecting);
      if (visible && !movimientoReducido && animacion === null) {
        animacion = window.requestAnimationFrame(dibujar);
      } else if (!visible && animacion !== null) {
        window.cancelAnimationFrame(animacion);
        animacion = null;
      }
    }

    cambiarTamano();
    const observadorTamanio = new ResizeObserver(cambiarTamano);
    const observadorVisibilidad = new IntersectionObserver(observarVisibilidad, { threshold: 0 });
    observadorTamanio.observe(canvas);
    observadorVisibilidad.observe(canvas);
    canvas.addEventListener('pointermove', actualizarPuntero, { passive: true });
    canvas.addEventListener('pointerdown', iniciarPulso, { passive: true });
    canvas.addEventListener('pointerleave', salirDelPuntero, { passive: true });

    return () => {
      if (animacion !== null) window.cancelAnimationFrame(animacion);
      observadorTamanio.disconnect();
      observadorVisibilidad.disconnect();
      canvas.removeEventListener('pointermove', actualizarPuntero);
      canvas.removeEventListener('pointerdown', iniciarPulso);
      canvas.removeEventListener('pointerleave', salirDelPuntero);
    };
  }, []);

  return <canvas className="puente-red-interactiva" ref={canvasRef} aria-hidden="true" />;
}

export default RedInteractiva;

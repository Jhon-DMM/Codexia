import React, { useEffect, useRef } from 'react';

const CAPAS_ESFERA = [
  { cantidad: 116, radio: 0.48, desfase: 0.35 },
  { cantidad: 154, radio: 0.73, desfase: 1.8 },
  { cantidad: 190, radio: 1, desfase: 0 },
];

function crearPuntosEsfera(cantidad) {
  const puntos = [];
  const anguloDorado = Math.PI * (3 - Math.sqrt(5));

  for (let indice = 0; indice < cantidad; indice += 1) {
    const y = 1 - (indice / (cantidad - 1)) * 2;
    const radio = Math.sqrt(1 - y * y);
    const angulo = anguloDorado * indice;

    puntos.push({
      x: Math.cos(angulo) * radio,
      y,
      z: Math.sin(angulo) * radio,
    });
  }

  return puntos;
}

function crearConexiones(puntos) {
  const conexiones = [];
  const distanciaMaxima = 0.34 ** 2;

  for (let indice = 0; indice < puntos.length; indice += 1) {
    for (let siguiente = indice + 1; siguiente < puntos.length; siguiente += 1) {
      const diferenciaX = puntos[indice].x - puntos[siguiente].x;
      const diferenciaY = puntos[indice].y - puntos[siguiente].y;
      const diferenciaZ = puntos[indice].z - puntos[siguiente].z;
      const distancia = diferenciaX ** 2 + diferenciaY ** 2 + diferenciaZ ** 2;

      if (distancia < distanciaMaxima) {
        conexiones.push([indice, siguiente]);
      }
    }
  }

  return conexiones;
}

function suavizar(valor) {
  const limitado = Math.max(0, Math.min(1, valor));
  return limitado * limitado * limitado * (limitado * (limitado * 6 - 15) + 10);
}

function mezclarColor(colorInicial, colorFinal, progreso) {
  return colorInicial.map((canal, indice) => (
    Math.round(canal + (colorFinal[indice] - canal) * progreso)
  )).join(', ');
}

function EsferaParticulas({ progreso, activa = true, centroX = 0.5, centroY = 0.5 }) {
  const canvasRef = useRef(null);
  const progresoRef = useRef(progreso);
  progresoRef.current = progreso;

  useEffect(() => {
    const canvas = canvasRef.current;
    const contexto = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !contexto || !activa) return undefined;

    const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const capas = CAPAS_ESFERA.map((configuracion) => {
      const puntos = crearPuntosEsfera(configuracion.cantidad);
      return {
        ...configuracion,
        puntos,
        conexiones: crearConexiones(puntos),
      };
    });

    let ancho = 1;
    let alto = 1;
    let proporcionPixel = 1;
    let cuadroAnimacion = null;
    let cuadroScroll = null;
    let ultimaDibujada = 0;
    let heroVisible = false;
    const horaInicio = performance.now();

    function ajustarCanvas() {
      const limites = canvas.getBoundingClientRect();
      ancho = Math.max(1, limites.width);
      alto = Math.max(1, limites.height);
      proporcionPixel = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(ancho * proporcionPixel);
      canvas.height = Math.round(alto * proporcionPixel);
      contexto.setTransform(proporcionPixel, 0, 0, proporcionPixel, 0, 0);
      dibujar(performance.now());
    }

    function dibujar(tiempo = performance.now()) {
      const avance = Math.max(0, Math.min(1, progresoRef.current));
      const tono = suavizar((avance - 0.16) / 0.52);
      const colorParticula = mezclarColor([108, 91, 196], [255, 255, 255], tono);
      const colorConexion = mezclarColor([77, 70, 132], [239, 234, 255], tono);
      const colorResplandor = mezclarColor([123, 105, 210], [255, 255, 255], tono);
      const escala = 0.54 + avance * 0.66;
      const distanciaCamara = 3.1 + avance * 0.85;
      const radioBase = Math.min(ancho, alto) * 0.39 * escala;
      const posicionX = ancho * centroX;
      const posicionY = alto * centroY;
      const giro = movimientoReducido ? 0 : (tiempo - horaInicio) * 0.00011;
      const inclinacion = movimientoReducido ? 0.13 : 0.13 + Math.sin(tiempo * 0.00022) * 0.08;
      const opacidadBase = 0.2 + avance * 0.14;

      contexto.clearRect(0, 0, ancho, alto);
      contexto.save();
      contexto.globalAlpha = 1;

      const resplandor = contexto.createRadialGradient(
        posicionX,
        posicionY,
        radioBase * 0.08,
        posicionX,
        posicionY,
        radioBase * 1.2,
      );
      resplandor.addColorStop(0, `rgba(${colorResplandor}, ${0.075 + avance * 0.025})`);
      resplandor.addColorStop(1, `rgba(${colorResplandor}, 0)`);
      contexto.fillStyle = resplandor;
      contexto.fillRect(0, 0, ancho, alto);

      capas.forEach((capa) => {
        const gruposProfundidad = 5;
        const rutasLineas = Array.from({ length: gruposProfundidad }, () => new Path2D());
        const rutasPuntos = Array.from({ length: gruposProfundidad }, () => new Path2D());
        const rutasPuntosBrillantes = Array.from({ length: gruposProfundidad }, () => new Path2D());
        const puntosProyectados = capa.puntos.map((punto) => {
          const angulo = giro + capa.desfase;
          const giradoX = punto.x * Math.cos(angulo) - punto.z * Math.sin(angulo);
          const giradoZ = punto.x * Math.sin(angulo) + punto.z * Math.cos(angulo);
          const giradoY = punto.y * Math.cos(inclinacion) - giradoZ * Math.sin(inclinacion);
          const profundidadY = punto.y * Math.sin(inclinacion) + giradoZ * Math.cos(inclinacion);
          const distanciaZ = profundidadY * capa.radio * radioBase * 0.43;
          const perspectiva = distanciaCamara / (distanciaCamara - distanciaZ / radioBase);
          const radio = capa.radio * radioBase * perspectiva;

          return {
            x: posicionX + giradoX * radio,
            y: posicionY + giradoY * radio,
            z: profundidadY,
            perspectiva,
          };
        });

        capa.conexiones.forEach(([indice, siguiente]) => {
          const primero = puntosProyectados[indice];
          const segundo = puntosProyectados[siguiente];
          const profundidad = (primero.z + segundo.z + 2) / 4;
          const grupo = Math.min(gruposProfundidad - 1, Math.floor(profundidad * gruposProfundidad));
          rutasLineas[grupo].moveTo(primero.x, primero.y);
          rutasLineas[grupo].lineTo(segundo.x, segundo.y);
        });

        puntosProyectados.forEach((punto, indice) => {
          const profundidad = (punto.z + 1) / 2;
          const grupo = Math.min(gruposProfundidad - 1, Math.floor(profundidad * gruposProfundidad));
          const radioPunto = (indice % 9 === 0 ? 1.65 : 0.85) * punto.perspectiva;
          const ruta = indice % 9 === 0 ? rutasPuntosBrillantes[grupo] : rutasPuntos[grupo];
          ruta.moveTo(punto.x + radioPunto, punto.y);
          ruta.arc(punto.x, punto.y, radioPunto, 0, Math.PI * 2);
        });

        for (let grupo = 0; grupo < gruposProfundidad; grupo += 1) {
          const profundidad = (grupo + 0.5) / gruposProfundidad;
          contexto.strokeStyle = `rgba(${colorConexion}, ${opacidadBase * (0.3 + profundidad * 0.7)})`;
          contexto.lineWidth = 0.55 + profundidad * 0.28;
          contexto.stroke(rutasLineas[grupo]);

          contexto.fillStyle = `rgba(${colorParticula}, ${0.5 * (0.35 + profundidad * 0.65)})`;
          contexto.fill(rutasPuntos[grupo]);
          contexto.fillStyle = `rgba(${colorParticula}, ${0.96 * (0.35 + profundidad * 0.65)})`;
          contexto.fill(rutasPuntosBrillantes[grupo]);
        }
      });

      contexto.restore();
    }

    function animar(tiempo) {
      cuadroAnimacion = null;
      if (!heroVisible || document.hidden || movimientoReducido) return;

      if (tiempo - ultimaDibujada >= 1000 / 30) {
        dibujar(tiempo);
        ultimaDibujada = tiempo;
      }

      cuadroAnimacion = window.requestAnimationFrame(animar);
    }

    function iniciarAnimacion() {
      if (movimientoReducido || !heroVisible || document.hidden || cuadroAnimacion !== null) return;
      cuadroAnimacion = window.requestAnimationFrame(animar);
    }

    function detenerAnimacion() {
      if (cuadroAnimacion === null) return;
      window.cancelAnimationFrame(cuadroAnimacion);
      cuadroAnimacion = null;
    }

    function solicitarDibujoTrasScroll() {
      if (!movimientoReducido || !heroVisible) return;
      if (cuadroScroll !== null) return;
      cuadroScroll = window.requestAnimationFrame((tiempo) => {
        cuadroScroll = null;
        dibujar(tiempo);
      });
    }

    const observadorVisibilidad = new IntersectionObserver(([entrada]) => {
      heroVisible = entrada.isIntersecting;
      if (heroVisible) {
        dibujar(performance.now());
        iniciarAnimacion();
      } else {
        detenerAnimacion();
      }
    });

    const observadorTamano = new ResizeObserver(ajustarCanvas);
    observadorVisibilidad.observe(canvas);
    observadorTamano.observe(canvas);
    window.addEventListener('resize', ajustarCanvas);
    window.addEventListener('scroll', solicitarDibujoTrasScroll, { passive: true });
    document.addEventListener('visibilitychange', iniciarAnimacion);

    ajustarCanvas();

    return () => {
      detenerAnimacion();
      if (cuadroScroll !== null) window.cancelAnimationFrame(cuadroScroll);
      window.removeEventListener('resize', ajustarCanvas);
      window.removeEventListener('scroll', solicitarDibujoTrasScroll);
      document.removeEventListener('visibilitychange', iniciarAnimacion);
      observadorVisibilidad.disconnect();
      observadorTamano.disconnect();
    };
  }, [activa]);

  return <canvas className="esfera-scroll-canvas" ref={canvasRef} aria-hidden="true" />;
}

export default EsferaParticulas;

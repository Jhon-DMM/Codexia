import React, { useLayoutEffect, useState } from 'react';

const DURACION_APERTURA = 1250;
const ESPERA_FONDO_NEGRO = 500;
const PAUSA_INICIAL = 500;
const DURACION_CASCADA = 1000;
const LIMITE_SEGURIDAD = 3500;

function curvaSuave(progreso, [x1, y1, x2, y2]) {
  let minimo = 0;
  let maximo = 1;
  let t = progreso;

  for (let intento = 0; intento < 12; intento += 1) {
    const inverso = 1 - t;
    const x = 3 * inverso * inverso * t * x1 + 3 * inverso * t * t * x2 + t * t * t;
    if (Math.abs(x - progreso) < 0.0001) break;
    if (x < progreso) minimo = t;
    else maximo = t;
    t = (minimo + maximo) / 2;
  }

  const inverso = 1 - t;
  return 3 * inverso * inverso * t * y1 + 3 * inverso * t * t * y2 + t * t * t;
}

function obtenerHueco(lado, ancho, alto, progreso) {
  const anchoInicial = (lado / ancho) * 100;
  const altoInicial = (lado / alto) * 100;
  const anchoHueco = anchoInicial + (100 - anchoInicial) * progreso;
  const altoHueco = altoInicial + (100 - altoInicial) * progreso;

  return {
    x: (100 - anchoHueco) / 2,
    y: (100 - altoHueco) / 2,
    width: anchoHueco,
    height: altoHueco,
  };
}

function EntradaInicial() {
  const [visible, setVisible] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const lado = window.matchMedia('(max-width: 600px)').matches ? 36 : 44;
  const huecoInicial = obtenerHueco(lado, window.innerWidth, window.innerHeight, 0);

  useLayoutEffect(() => {
    if (!visible) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const pagina = document.querySelector('.pagina-inicio');
    const capa = document.querySelector('.entrada-inicial');
    const rectanguloHueco = document.querySelector('.entrada-inicial-hueco');
    const overflowHtml = html.style.overflow;
    const overflowBody = body.style.overflow;
    const bloqueoAnterior = html.dataset.codexiaScrollLocked;
    const temporizadores = [];
    let cuadroApertura = null;
    let cancelado = false;
    const estilosEntrada = capa ? window.getComputedStyle(capa) : null;
    const duracionApertura =
      (Number.parseFloat(estilosEntrada?.getPropertyValue('--speed')) || DURACION_APERTURA / 1000) *
      1000;
    const valoresCurva = estilosEntrada
      ?.getPropertyValue('--ease')
      .match(/cubic-bezier\(([^)]+)\)/)?.[1]
      .split(',')
      .map((valor) => Number.parseFloat(valor.trim()));
    const curva =
      valoresCurva?.length === 4 && valoresCurva.every(Number.isFinite)
        ? valoresCurva
        : [0.65, 0, 0.15, 1];

    const restaurarScroll = () => {
      html.style.overflow = overflowHtml;
      body.style.overflow = overflowBody;
      if (bloqueoAnterior === undefined) delete html.dataset.codexiaScrollLocked;
      else html.dataset.codexiaScrollLocked = bloqueoAnterior;
      pagina?.classList.remove('entrada-inicial-preparar');
      pagina?.classList.remove('entrada-inicial-cascada');
    };

    const finalizar = () => {
      if (cancelado) return;
      cancelado = true;
      temporizadores.forEach((temporizador) => window.clearTimeout(temporizador));
      if (cuadroApertura !== null) window.cancelAnimationFrame(cuadroApertura);
      restaurarScroll();
      setVisible(false);
    };

    html.dataset.codexiaScrollLocked = 'true';
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    pagina?.classList.add('entrada-inicial-preparar');
    temporizadores.push(window.setTimeout(finalizar, LIMITE_SEGURIDAD));

    if (!pagina || !rectanguloHueco) {
      finalizar();
      return undefined;
    }

    const abrir = () => {
      if (cancelado) return;
      const inicio = performance.now();
      pagina.classList.add('entrada-inicial-abierta');

      const animar = (ahora) => {
        if (cancelado) return;
        try {
          const progreso = Math.min(1, (ahora - inicio) / duracionApertura);
          const hueco = obtenerHueco(
            lado,
            window.innerWidth,
            window.innerHeight,
            curvaSuave(progreso, curva),
          );

          rectanguloHueco.setAttribute('x', hueco.x);
          rectanguloHueco.setAttribute('y', hueco.y);
          rectanguloHueco.setAttribute('width', hueco.width);
          rectanguloHueco.setAttribute('height', hueco.height);

          if (progreso < 1) {
            cuadroApertura = window.requestAnimationFrame(animar);
            return;
          }

          pagina.classList.add('entrada-inicial-cascada');
          pagina.classList.add('entrada-inicial-desvanecer');
          temporizadores.push(window.setTimeout(finalizar, DURACION_CASCADA));
        } catch {
          finalizar();
        }
      };

      try {
        cuadroApertura = window.requestAnimationFrame(animar);
      } catch {
        finalizar();
      }
    };

    temporizadores.push(
      window.setTimeout(() => {
        capa.classList.add('entrada-inicial-elementos-visibles');
        temporizadores.push(window.setTimeout(abrir, PAUSA_INICIAL));
      }, ESPERA_FONDO_NEGRO),
    );

    return () => {
      cancelado = true;
      temporizadores.forEach((temporizador) => window.clearTimeout(temporizador));
      if (cuadroApertura !== null) window.cancelAnimationFrame(cuadroApertura);
      restaurarScroll();
    };
  }, [visible, lado]);

  if (!visible) return null;

  return (
    <div className="entrada-inicial" aria-hidden="true">
      <svg className="entrada-inicial-mascara" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <mask
            id="codexia-entrada-mascara"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100"
            height="100"
          >
            <rect width="100" height="100" fill="white" />
            <rect
              className="entrada-inicial-hueco"
              x={huecoInicial.x}
              y={huecoInicial.y}
              width={huecoInicial.width}
              height={huecoInicial.height}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          className="entrada-inicial-cobertura"
          width="100"
          height="100"
          fill="var(--bg)"
          mask="url(#codexia-entrada-mascara)"
        />
      </svg>

      <span className="entrada-inicial-centro" />
      <span className="entrada-inicial-simbolo" aria-hidden="true">
        &lt;/&gt;
      </span>
      <span className="entrada-inicial-angulo entrada-inicial-angulo--tl" />
      <span className="entrada-inicial-angulo entrada-inicial-angulo--br" />
    </div>
  );
}

export default EntradaInicial;

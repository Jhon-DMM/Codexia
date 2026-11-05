import React, { useEffect, useRef, useState } from 'react';

function numeroAleatorio(minimo, maximo) {
  return Math.random() * (maximo - minimo) + minimo;
}

function crearEstrella(id) {
  return {
    id,
    left: `${numeroAleatorio(0, 100)}%`,
    top: `${numeroAleatorio(0, 100)}%`,
    '--tam': `${numeroAleatorio(0.8, 2.1)}px`,
    '--dur': `${numeroAleatorio(4, 8)}s`,
    '--dx': `${numeroAleatorio(-160, 160)}px`,
    '--dy': `${numeroAleatorio(-120, 120)}px`,
  };
}

function Estrellas() {
  const [visibles, setVisibles] = useState(false);
  const [estrellas, setEstrellas] = useState([]);
  const siguienteId = useRef(0);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;

    const observador = new IntersectionObserver(([entrada]) => {
      setVisibles(entrada.isIntersecting);
    });
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visibles || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const intervalo = window.setInterval(() => {
      setEstrellas((actuales) => {
        if (actuales.length >= 16) return actuales;
        siguienteId.current += 1;
        return [...actuales, crearEstrella(siguienteId.current)];
      });
    }, 500);

    return () => window.clearInterval(intervalo);
  }, [visibles]);

  function retirarEstrella(id) {
    setEstrellas((actuales) => actuales.filter((estrella) => estrella.id !== id));
  }

  return (
    <div ref={contenedorRef} className="estrellas" aria-hidden="true">
      {estrellas.map((estrella) => (
        <span
          key={estrella.id}
          className="estrella"
          style={{
            left: estrella.left,
            top: estrella.top,
            '--tam': estrella['--tam'],
            '--dur': estrella['--dur'],
            '--dx': estrella['--dx'],
            '--dy': estrella['--dy'],
          }}
          onAnimationEnd={() => retirarEstrella(estrella.id)}
        />
      ))}
    </div>
  );
}

export default Estrellas;

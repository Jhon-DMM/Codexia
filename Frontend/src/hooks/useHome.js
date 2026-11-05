import { useEffect, useState } from 'react';

function apiBaseUrl() {
  const configurada = document.querySelector('meta[name="codexia-api-base-url"]')?.content.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  const { protocol, hostname, port } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'file:') return 'http://localhost:3000';
  if (local && port !== '3000') return `http://${hostname}:3000`;
  return '';
}

function useSesionActiva() {
  const [sesionActiva, setSesionActiva] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();

    fetch(`${apiBaseUrl()}/api/usuarios/me`, {
      credentials: 'include',
      signal: controlador.signal,
    })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((resultado) => setSesionActiva(Boolean(resultado?.usuario)))
      .catch(() => {});

    return () => controlador.abort();
  }, []);

  return sesionActiva;
}

function useEfectosAparicion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const bloques = [...document.querySelectorAll('.seccion .contenido')];
    const elementosLaterales = [
      ...document.querySelectorAll(
        '.seccion-nosotros .lista li, .seccion-servicios .lista li, .seccion-porque .lista li',
      ),
    ];
    const razonesAsistente = [...document.querySelectorAll('.seccion-asistente .lista li')];
    const titulos = [...document.querySelectorAll('.seccion-titulo')];
    const chats = [...document.querySelectorAll('.asistente-chat')];

    bloques.forEach((elemento) => elemento.classList.add('reveal'));
    elementosLaterales.forEach((elemento, indice) =>
      elemento.classList.add(indice % 2 === 0 ? 'reveal-left' : 'reveal-right'),
    );
    razonesAsistente.forEach((elemento) => elemento.classList.add('reveal-left'));
    titulos.forEach((elemento) => elemento.classList.add('reveal-down'));
    chats.forEach((elemento) => elemento.classList.add('reveal-right'));

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) =>
          entrada.target.classList.toggle('show', entrada.isIntersecting),
        );
      },
      { rootMargin: '0px 0px -50px 0px', threshold: 0.05 },
    );

    [...bloques, ...elementosLaterales, ...razonesAsistente, ...titulos, ...chats].forEach(
      (elemento) => observador.observe(elemento),
    );

    return () => observador.disconnect();
  }, []);
}

export function useHome() {
  useEfectosAparicion();
  return { sesionActiva: useSesionActiva() };
}

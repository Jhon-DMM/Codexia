document.addEventListener("DOMContentLoaded", () => {
  // Secciones
  const bloques = document.querySelectorAll(".seccion .contenido");

  bloques.forEach((bloque) => {
    bloque.classList.add("reveal");
  });

  // Elementos que aparecerán desde los lados
  const elementosLaterales = document.querySelectorAll(
    ".seccion-nosotros .lista li, .seccion-servicios .lista li, .seccion-porque .lista li "
  );

  elementosLaterales.forEach((elemento, index) => {

    if (index % 2 === 0) {
      elemento.classList.add("reveal-left");
    } else {
      elemento.classList.add("reveal-right");
    }

  });

  const razones = document.querySelectorAll(".seccion-asistente .lista li");
  razones.forEach((razon) => {
    razon.classList.add("reveal-left");
  });

  //titulos que aparecen de arriba hacia abajo
  const titulos = document.querySelectorAll(".seccion-titulo");
  titulos.forEach((titulo) => {
    titulo.classList.add("reveal-down");
  });

  //animacion del chat ejemplo
  const chat = document.querySelectorAll(".asistente-chat");
  chat.forEach((mensaje) => {
    mensaje.classList.add("reveal-right");
  });

  // Observer
  const observador = new IntersectionObserver((entradas) => {

    entradas.forEach((entrada) => {
      entrada.target.classList.toggle("show", entrada.isIntersecting);
    });

  }, {
    rootMargin: "0px 0px -50px 0px",
    threshold: 0.05
  });

  bloques.forEach((bloque) => {
    observador.observe(bloque);
  });

  elementosLaterales.forEach((elemento) => {
    observador.observe(elemento);
  });

  razones.forEach((razon) => {
    observador.observe(razon);
  });

  titulos.forEach((titulo) => {
    observador.observe(titulo);
  });

  chat.forEach((mensaje) => {
    observador.observe(mensaje);
  });
});
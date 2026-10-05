// Hace aparecer el contenido de cada sección al entrar en pantalla
document.addEventListener("DOMContentLoaded", () => {
  const bloques = document.querySelectorAll(".seccion .contenido");
  bloques.forEach((bloque) => bloque.classList.add("reveal"));

  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => entrada.target.classList.toggle("show", entrada.isIntersecting));
  }, { rootMargin: "0px 0px -50px 0px", threshold: 0.05 });

  bloques.forEach((bloque) => observador.observe(bloque));
});
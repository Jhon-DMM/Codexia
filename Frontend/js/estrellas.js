// Estrellas que aparecen en cada sección
document.addEventListener("DOMContentLoaded", () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MAX_ESTRELLAS = 16;   // simultáneas por sección
  const INTERVALO_MS = 500;   // cada cuánto puede nacer una nueva
  const azar = (min, max) => Math.random() * (max - min) + min;

  function crearEstrella(contenedor) {
    if (contenedor.childElementCount >= MAX_ESTRELLAS) return;

    const estrella = document.createElement("span");
    estrella.className = "estrella";
    estrella.style.left = `${azar(0, 100)}%`;
    estrella.style.top = `${azar(0, 100)}%`;
    estrella.style.setProperty("--tam", `${azar(1.5, 3.5)}px`);
    estrella.style.setProperty("--dur", `${azar(4, 8)}s`);
    estrella.style.setProperty("--dx", `${azar(-160, 160)}px`);
    estrella.style.setProperty("--dy", `${azar(-120, 120)}px`);

    estrella.addEventListener("animationend", () => estrella.remove());
    contenedor.appendChild(estrella);
  }

  document.querySelectorAll(".hero, .seccion").forEach((seccion) => {
    const contenedor = document.createElement("div");
    contenedor.className = "estrellas";
    contenedor.setAttribute("aria-hidden", "true");
    seccion.prepend(contenedor);

    // Solo se generan estrellas mientras la sección está en pantalla
    let visible = false;
    new IntersectionObserver(([entrada]) => (visible = entrada.isIntersecting)).observe(seccion);

    setInterval(() => visible && crearEstrella(contenedor), INTERVALO_MS);
  });
});

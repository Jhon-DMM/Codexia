document.addEventListener("DOMContentLoaded", () => {
  const sectionsLeft = document.querySelectorAll('#nosotros, #porque-elegirnos');
  const sectionsRight = document.querySelectorAll('#servicios');

  // Asigno clases iniciales
  sectionsLeft.forEach(section => section.classList.add('slide-left'));
  sectionsRight.forEach(section => section.classList.add('slide-right'));

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px', // Se activa un poco antes de llegar al borde inferior
    threshold: 0.05 // Solo necesita que el 5% de la sección sea visible para animarse
  };

  const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      } else {
        // Al quitar la clase 'show', la animación se reinicia cuando haces scroll hacia arriba
        entry.target.classList.remove('show');
      }
    });
  }, observerOptions);

  const hiddenElements = document.querySelectorAll('.slide-left, .slide-right');
  hiddenElements.forEach(el => sectionObserver.observe(el));
});

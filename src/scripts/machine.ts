// La máquina llega derrapando cuando la sección entra al 35 % de la vista; el resto de la secuencia es CSS con delays.
export function startMachine() {
  const section = document.querySelector<HTMLElement>('[data-machine]');
  if (!section) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      section.setAttribute('data-arrived', '');
      observer.disconnect();
    },
    { threshold: 0.35 },
  );
  observer.observe(section);
}

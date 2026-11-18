// Entrada de bloques al llegar a la pantalla (M1, M2, fade-up: ver base/_motion.scss).
// Con reduced-motion el CSS los vuelve un fade de 200 ms. Sin JS todo queda visible.
export function startReveal() {
  const blocks = document.querySelectorAll<HTMLElement>('[data-reveal]');
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-revealed', '');
        observer.unobserve(entry.target);
      }),
    { threshold: 0.2 },
  );
  document.documentElement.classList.add('has-reveal');
  blocks.forEach((block) => observer.observe(block));
}

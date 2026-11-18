import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FRAMES, JOURNEY_LENGTH_VH } from '../config/frames';
import { ROUTES } from '../data/routes';
import { FrameSequence } from './frame-sequence';
import { prefersReducedMotion } from './motion';
import { setOdometer } from './odometer';
import { scrollToY } from './smooth-scroll';

const segments = FRAMES.journey.segments;
const routeIds = ROUTES.map(({ id }) => id as string);
// Pasados estos puntos, la navbar y el marco ya no son los del hero.
const JOURNEY_STARTED = 0.02;

// Zoom suave [empieza, llega, se queda hasta, termina] (cuadros): tapa el cambio de cielo dentro de T1.
const ZOOM_SCALE = 0.16;
const zoomAt = (frame: number, zoom?: number[]) => {
  if (!zoom) return 1;
  const [a, b, c, d] = zoom as [number, number, number, number];
  const t = frame < b ? (frame - a) / (b - a) : frame <= c ? 1 : 1 - (frame - c) / (d - c);
  const eased = (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
  return 1 + ZOOM_SCALE * eased;
};

const formatKm = (km: number) => km.toFixed(1).replace('.', ',').padStart(4, '0');

export async function startJourney() {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-journey-canvas]');
  const milestone = document.querySelector<HTMLElement>('[data-journey-milestone]');
  if (!section || !canvas || !milestone || prefersReducedMotion()) return;

  const root = document.documentElement;
  const banners = new Map(routeIds.map((id) => [id, document.querySelector<HTMLElement>(`[data-route-banner="${id}"]`)!]));
  const tickets = new Map(routeIds.map((id) => [id, document.querySelector<HTMLElement>(`[data-route-ticket="${id}"]`)!]));
  const trails = new Map(routeIds.map((id) => [id, tickets.get(id)!.querySelector<SVGPathElement>('[data-ticket-trail]')!]));

  const sequence = new FrameSequence(canvas, segments);
  await sequence.prepare();
  // R1 se pide cuando el navegador esté libre (el hero ya cargó lo suyo); los demás, al entrar al capítulo anterior.
  (window.requestIdleCallback ?? setTimeout)(() => void sequence.loadChapter('r1'));

  const starts = segments.map((_, index) => segments.slice(0, index).reduce((sum, { vh }) => sum + vh, 0));
  let chapter = -1;
  let terrain = '';
  let lastFrame = -1;

  // Sacudida del canvas al cruzar el cuadro pico de la ruta (una vez por pasada, nunca en bucle).
  const shakeCanvas = () => {
    canvas.removeAttribute('data-shake');
    void canvas.offsetWidth;
    canvas.setAttribute('data-shake', '');
  };
  canvas.addEventListener('animationend', () => canvas.removeAttribute('data-shake'));

  const update = (progress: number) => {
    root.dataset.phase = progress >= 1 ? 'after' : progress > JOURNEY_STARTED ? 'journey' : 'hero';

    const position = progress * JOURNEY_LENGTH_VH;
    let index = segments.findIndex(({ vh }, i) => position < starts[i]! + vh);
    if (index < 0) index = segments.length - 1;
    const segment = segments[index]!;
    const local = Math.min(1, Math.max(0, (position - starts[index]!) / segment.vh));
    const frame = Math.min(segment.count - 1, Math.floor(local * segment.count));

    if (progress > 0) sequence.show(sequence.globalIndex(segment.id, frame));
    canvas.style.scale = String(zoomAt(local * segment.count, 'zoom' in segment ? segment.zoom : undefined));
    const peak = segment.peak ?? Math.floor(segment.count / 2);
    if (segment.kind === 'route' && index === chapter && lastFrame >= 0 && lastFrame < peak && frame >= peak) shakeCanvas();
    lastFrame = frame;
    if (index !== chapter) {
      chapter = index;
      void sequence.loadChapter(segment.id);
      // Las dos siguientes: los túneles son cortos y en móvil un scroll rápido alcanza la ruta antes de que cargue.
      for (const next of segments.slice(index + 1, index + 3)) void sequence.loadChapter(next.id);
    }

    // El color de terreno cambia solo en el cuadro más oscuro del túnel.
    const isRoute = segment.kind === 'route';
    const activeRoute = isRoute ? segment.id : frame >= (segment.darkest ?? 0) ? segment.to! : segment.from!;
    if (activeRoute !== terrain) {
      terrain = activeRoute;
      root.dataset.terrain = terrain;
    }

    // Mojón: el km se reinicia en cada ruta.
    const route = ROUTES.find(({ id }) => id === activeRoute)!;
    const routeProgress = isRoute ? local : activeRoute === segment.from ? 1 : 0;
    setOdometer(milestone, `RUTA ${route.number} · KM ${formatKm(Math.round(routeProgress * route.distanceKm * 10) / 10)}`);

    routeIds.forEach((id) => {
      const inRoute = isRoute && segment.id === id;
      // Nombre y boleto desde el primer cuadro de la ruta: reservar no debe esperar al scroll.
      banners.get(id)!.toggleAttribute('data-visible', inRoute);
      tickets.get(id)!.toggleAttribute('data-visible', inRoute);
      trails.get(id)!.style.strokeDashoffset = String(1 - (inRoute ? local : 0));
    });
  };

  update(0);
  // El recorrido arranca cuando la lámina del hero terminó de salir.
  const heroScroll = () => {
    const hero = document.querySelector<HTMLElement>('[data-hero]')!;
    return hero.offsetHeight - hero.querySelector<HTMLElement>('[data-hero-stage]')!.offsetHeight;
  };
  const trigger = ScrollTrigger.create({ trigger: section, start: heroScroll, end: 'bottom bottom', onUpdate: (self) => update(self.progress) });

  // "Ver siguiente ruta": scroll suave hasta el primer cuadro de la próxima ruta (pasa por el túnel).
  document.querySelectorAll<HTMLElement>('[data-next-route]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = segments.findIndex((segment, i) => i > chapter && segment.kind === 'route');
      if (next < 0) return;
      const progress = (starts[next]! + 1) / JOURNEY_LENGTH_VH;
      scrollToY(trigger.start + progress * (trigger.end - trigger.start));
    });
  });
}

import { FRAMES } from '../config/frames';
import { frameEvents, preferCoarseFrames } from './frame-sequence';
import { prefersReducedMotion } from './motion';
import { setScrollLocked } from './smooth-scroll';

// Pantalla "tanqueando": el logo se llena con la descarga real y bloquea el scroll hasta tener todo el hero y 1 de cada
// 4 cuadros de R1, así un scroll a lo loco apenas carga la página siempre tiene imagen.
const COARSE_STEP = 4;
const SHOW_CONTENT_AFTER = 200; // el contenido entra a los 200 ms: con caché no alcanza a parpadear
const MIN_VISIBLE = 600;
const TIMEOUT = 10_000; // red caída o lenta: sale igual con lo que haya
const HOLD_FULL = 150;
const TREMOR = 240;
const RELEASE_HERO_AFTER = 200; // las entradas del hero arrancan cuando la persiana va por la mitad
const EXIT = 450;

export function startLoader() {
  const loader = document.querySelector<HTMLElement>('[data-loader]');
  if (!loader) return;
  const root = document.documentElement;
  if (prefersReducedMotion()) {
    loader.remove();
    return;
  }

  const label = loader.querySelector<HTMLElement>('[data-loader-label]')!;
  const value = loader.querySelector<HTMLElement>('[data-loader-value]')!;
  const r1 = FRAMES.journey.segments.find(({ id }) => id === 'r1')!;
  const needed = new Set<string>();
  for (let i = 0; i < FRAMES.hero.count; i++) needed.add(`hero:${i}`);
  for (let i = 0; i < r1.count; i += COARSE_STEP) needed.add(`r1:${i}`);
  const total = needed.size;

  const started = performance.now();
  root.setAttribute('data-loading', '');
  setScrollLocked(true);
  preferCoarseFrames(true);
  history.scrollRestoration = 'manual'; // el recorrido arranca desde el hero, que es lo que se acaba de cargar
  window.scrollTo(0, 0);

  let finished = false;
  const setProgress = (progress: number) => {
    const percent = Math.round(progress * 100);
    loader.style.setProperty('--p', String(progress));
    loader.setAttribute('aria-valuenow', String(percent));
    value.textContent = `${percent} %`;
  };

  const release = () => {
    root.removeAttribute('data-loading');
    setScrollLocked(false);
    preferCoarseFrames(false);
  };

  const finish = (full: boolean) => {
    if (finished) return;
    finished = true;
    frameEvents.removeEventListener('loaded', onLoaded);
    const elapsed = performance.now() - started;
    // Con caché: se va con un fundido, sin temblor ni persiana.
    if (elapsed < SHOW_CONTENT_AFTER) {
      loader.setAttribute('data-leaving', 'fade');
      release();
      window.setTimeout(() => loader.remove(), 150);
      return;
    }
    if (full) {
      label.textContent = 'TANQUE LLENO';
      value.hidden = true;
    }
    const wait = Math.max(HOLD_FULL, MIN_VISIBLE - elapsed);
    window.setTimeout(() => {
      loader.setAttribute('data-leaving', 'tremor');
      window.setTimeout(() => {
        loader.setAttribute('data-leaving', 'up');
        window.setTimeout(release, RELEASE_HERO_AFTER);
        window.setTimeout(() => loader.remove(), EXIT);
      }, TREMOR);
    }, wait);
  };

  let loaded = 0;
  const onLoaded = (event: Event) => {
    const { segmentId, localIndex } = (event as CustomEvent<{ segmentId: string; localIndex: number }>).detail;
    if (!needed.delete(`${segmentId}:${localIndex}`)) return;
    loaded++;
    setProgress(loaded / total);
    if (needed.size === 0) finish(true);
  };
  frameEvents.addEventListener('loaded', onLoaded);
  window.setTimeout(() => finish(false), TIMEOUT);
}

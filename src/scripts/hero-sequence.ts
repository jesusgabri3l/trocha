import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FRAMES } from '../config/frames';
import { FrameSequence } from './frame-sequence';
import { prefersReducedMotion } from './motion';
import { setOdometer } from './odometer';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// El video avanza con el scroll de principio a fin; la lámina empieza a subir un poco después (y el video sigue mientras sube).
const LAMINA_START = 0.7; // la lámina espera hasta la nube de polvo del derrape (~cuadro 42)
// Metros que cuenta la placa del hero hasta la salida; en 0 pasa a KM 00,0, que es donde arranca R1.
const START_METERS = 500;
// Desde aquí el borde de la lámina cruza la navbar: toma el color del terreno.
const NAVBAR_HANDOFF = 0.97;

export async function startHero() {
  const section = document.querySelector<HTMLElement>('[data-hero]');
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (!section || !stage || !canvas) return;

  const sequence = new FrameSequence(canvas, [{ id: 'hero', count: FRAMES.hero.count }]);
  await sequence.prepare();
  if (prefersReducedMotion()) return; // un solo cuadro del video

  const root = document.documentElement;
  const km = document.querySelector<HTMLElement>('[data-hero-km]');
  const lastFrame = FRAMES.hero.count - 1;
  const update = (progress: number) => {
    const drive = clamp(progress);
    const position = drive * lastFrame;
    sequence.show(Math.floor(position), position - Math.floor(position));
    stage.style.setProperty('--drive', String(drive));
    if (km) {
      const meters = Math.round(((1 - drive) * START_METERS) / 10) * 10;
      const text = meters > 0 ? `SALIDA · ${String(meters).padStart(3, '0')} M` : 'KM 00,0';
      if (km.dataset.text !== text) setOdometer(km, (km.dataset.text = text));
    }
    stage.style.setProperty('--lamina', String(clamp((progress - LAMINA_START) / (1 - LAMINA_START))));
    stage.toggleAttribute('data-done', progress >= 1);
    root.toggleAttribute('data-lamina', progress >= NAVBAR_HANDOFF);
  };

  update(0);
  // El recorrido dura lo que el escenario pega (sticky): alto de la sección menos alto del escenario.
  ScrollTrigger.create({ trigger: section, start: 'top top', end: () => `+=${section.offsetHeight - stage.offsetHeight}`, scrub: true, onUpdate: (self) => update(self.progress) });
  void sequence.loadChapter('hero');
}

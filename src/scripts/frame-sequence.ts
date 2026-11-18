import { MOBILE_QUERY } from '../config/site';
import { frameUrl, type Device } from '../config/frames';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LOAD_STEP = 4;
const MAX_DOWNLOADS = 6;
// Se guarda el webp comprimido (barato); solo se decodifican los cuadros cercanos al actual (createImageBitmap, fuera
// del hilo principal). Decodificar todo pesaría cientos de MB y Safari en iOS recarga la pestaña.
const DECODED_RADIUS = 10;
// Pocas decodificaciones a la vez, siempre la más cercana al cuadro actual: con scroll rápido no se gasta CPU en
// cuadros que ya quedaron atrás (a 1920 px cada una pesa).
const MAX_DECODES = 3;

export const currentDevice = (): Device => (window.matchMedia(MOBILE_QUERY).matches ? 'mobile' : 'desktop');

// Cola global de descargas por prioridad: siempre baja primero el cuadro más cercano a donde está el usuario (en la
// secuencia que está viendo), no en orden de llegada. Así el scroll no deja atrás a la descarga y no se queda pegado
// un cuadro viejo. 1 de cada 4 cuenta como "más cerca": con scroll rápido llega antes una versión salteada.
interface DownloadJob {
  sequence: FrameSequence;
  index: number; // índice global en su secuencia
  run: () => Promise<void>;
}
const pending: DownloadJob[] = [];
let activeDownloads = 0;
let activeSequence: FrameSequence | undefined;
const cost = ({ sequence, index }: DownloadJob) => {
  const distance = index - sequence.position;
  const steps = distance >= 0 ? distance : -distance * 2; // lo de adelante pesa la mitad que lo de atrás
  return (sequence === activeSequence ? 0 : 1e6) + steps * (index % LOAD_STEP === 0 ? 1 : 3);
};
const pump = () => {
  while (activeDownloads < MAX_DOWNLOADS && pending.length > 0) {
    let best = 0;
    for (let i = 1; i < pending.length; i++) if (cost(pending[i]!) < cost(pending[best]!)) best = i;
    const [job] = pending.splice(best, 1);
    activeDownloads++;
    job!.run().finally(() => {
      activeDownloads--;
      pump();
    });
  }
};

export interface SequenceSegment {
  id: string;
  count: number;
}

export class FrameSequence {
  private readonly device = currentDevice();
  private readonly offsets = new Map<string, number>();
  private readonly blobs: (Blob | undefined)[];
  private readonly bitmaps = new Map<number, ImageBitmap>();
  private readonly decoding = new Set<number>();
  private readonly chapters = new Map<string, Promise<void>>();
  private readonly context: CanvasRenderingContext2D;
  private current = 0;
  private direction = 1;
  private drawn = -1;
  // Fundido hacia el cuadro siguiente según el scroll entre dos cuadros: a 12 fps, sin esto se ve el salto de cuadro.
  private blend = 0;
  private drawnBlend = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly segments: SequenceSegment[],
  ) {
    let total = 0;
    for (const { id, count } of segments) {
      this.offsets.set(id, total);
      total += count;
    }
    this.blobs = new Array(total);
    this.context = canvas.getContext('2d')!;
  }

  globalIndex(segmentId: string, localIndex: number) {
    return this.offsets.get(segmentId)! + localIndex;
  }

  // Descarga el primer cuadro y ajusta el canvas a su tamaño real.
  async prepare() {
    const [{ id }] = this.segments as [SequenceSegment];
    await this.fetchFrame(id, 0);
    await this.decode(0);
    const first = this.bitmaps.get(0)!;
    this.canvas.width = first.width;
    this.canvas.height = first.height;
    this.drawn = -1; // cambiar el tamaño borra el canvas: el cuadro 0 que pintó decode() ya no está
    this.draw();
  }

  get position() {
    return this.current;
  }

  loadChapter(segmentId: string) {
    const known = this.chapters.get(segmentId);
    if (known) return known;
    const segment = this.segments.find(({ id }) => id === segmentId);
    if (!segment) return Promise.resolve();
    const offset = this.offsets.get(segmentId)!;
    activeSequence ??= this;
    const done = new Promise<void>((resolve) => {
      let left = segment.count;
      for (let local = 0; local < segment.count; local++) {
        pending.push({
          sequence: this,
          index: offset + local,
          run: async () => {
            await this.fetchFrame(segmentId, local);
            if (Math.abs(offset + local - this.current) <= DECODED_RADIUS) this.decodeAround();
            if (--left === 0) resolve();
          },
        });
      }
      pump();
    });
    this.chapters.set(segmentId, done);
    return done;
  }

  show(index: number, blend = 0) {
    this.blend = blend;
    if (index !== this.current) this.direction = index > this.current ? 1 : -1;
    this.current = index;
    activeSequence = this;
    this.decodeAround();
    this.draw();
  }

  private segmentOf(globalIndex: number) {
    let id = this.segments[0]!.id;
    for (const segment of this.segments) if (this.offsets.get(segment.id)! <= globalIndex) id = segment.id;
    return id;
  }

  private async fetchFrame(segmentId: string, localIndex: number) {
    const globalIndex = this.globalIndex(segmentId, localIndex);
    if (this.blobs[globalIndex]) return;
    try {
      const response = await fetch(frameUrl(BASE, this.device, segmentId, localIndex));
      if (!response.ok) throw new Error(response.url);
      this.blobs[globalIndex] = await response.blob();
    } catch {
      // Un cuadro perdido se cubre con el más cercano al dibujar.
    }
  }

  private async decode(globalIndex: number) {
    const blob = this.blobs[globalIndex];
    if (!blob || this.bitmaps.has(globalIndex) || this.decoding.has(globalIndex)) return;
    this.decoding.add(globalIndex);
    try {
      const bitmap = await createImageBitmap(blob);
      if (Math.abs(globalIndex - this.current) > DECODED_RADIUS * 2) return bitmap.close();
      this.bitmaps.set(globalIndex, bitmap);
      if (Math.abs(globalIndex - this.current) < Math.abs(this.drawn - this.current)) this.draw();
    } catch {
      // blob dañado: se ignora
    } finally {
      this.decoding.delete(globalIndex);
      this.pumpDecodes();
    }
  }

  // Siguiente cuadro a decodificar: el más cercano, primero hacia donde va el scroll.
  private pumpDecodes() {
    for (let distance = 0; distance <= DECODED_RADIUS && this.decoding.size < MAX_DECODES; distance++) {
      for (const index of [this.current + distance * this.direction, this.current - distance * this.direction]) {
        if (this.decoding.size >= MAX_DECODES) return;
        if (this.blobs[index] && !this.bitmaps.has(index) && !this.decoding.has(index)) void this.decode(index);
      }
    }
  }

  private decodeAround() {
    this.bitmaps.forEach((bitmap, index) => {
      if (Math.abs(index - this.current) <= DECODED_RADIUS * 2 || index === this.drawn) return;
      bitmap.close();
      this.bitmaps.delete(index);
    });
    this.pumpDecodes();
    // Pide el capítulo que se está viendo por si el usuario saltó (ancla, recarga a mitad de página).
    void this.loadChapter(this.segmentOf(this.current));
  }

  private draw() {
    // Si el cuadro pedido aún no está decodificado, usa el decodificado más cercano.
    let index = -1;
    for (let distance = 0; distance <= DECODED_RADIUS * 2 && index < 0; distance++) {
      if (this.bitmaps.has(this.current - distance)) index = this.current - distance;
      else if (this.bitmaps.has(this.current + distance)) index = this.current + distance;
    }
    if (index < 0) return;
    const next = index === this.current && this.blend > 0.02 ? this.bitmaps.get(index + 1) : undefined;
    const blend = next ? Math.round(this.blend * 20) / 20 : 0; // pasos de 5 %: no redibuja por cada píxel de scroll
    if (index === this.drawn && blend === this.drawnBlend) return;
    this.drawn = index;
    this.drawnBlend = blend;
    const { width, height } = this.canvas;
    this.context.globalAlpha = 1;
    this.context.drawImage(this.bitmaps.get(index)!, 0, 0, width, height);
    if (next && blend > 0) {
      this.context.globalAlpha = blend;
      this.context.drawImage(next, 0, 0, width, height);
      this.context.globalAlpha = 1;
    }
  }
}

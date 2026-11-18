import { MOBILE_QUERY } from '../config/site';
import { frameUrl, type Device } from '../config/frames';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LOAD_STEP = 4;
const MAX_DOWNLOADS = 6;
// Se guarda el webp comprimido (barato); solo se decodifican los cuadros cercanos al actual (createImageBitmap, fuera
// del hilo principal). Decodificar todo pesaría cientos de MB y Safari en iOS recarga la pestaña.
const DECODED_RADIUS = 10;

export const currentDevice = (): Device => (window.matchMedia(MOBILE_QUERY).matches ? 'mobile' : 'desktop');

// Cola global de descargas: los capítulos urgentes (el que ve el usuario) pasan al frente.
const pending: Array<() => Promise<void>> = [];
let activeDownloads = 0;
const pump = () => {
  while (activeDownloads < MAX_DOWNLOADS && pending.length > 0) {
    activeDownloads++;
    pending.shift()!().finally(() => {
      activeDownloads--;
      pump();
    });
  }
};
const enqueue = (jobs: Array<() => Promise<void>>, urgent: boolean) => {
  if (urgent) pending.unshift(...jobs);
  else pending.push(...jobs);
  pump();
};

// Primer y último cuadro, luego 1 de cada 4, luego el resto.
const loadOrder = (count: number) => {
  const order = count > 1 ? [0, count - 1] : [0];
  for (let i = LOAD_STEP; i < count - 1; i += LOAD_STEP) order.push(i);
  for (let i = 1; i < count - 1; i++) if (i % LOAD_STEP !== 0) order.push(i);
  return order;
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
  private drawn = -1;

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

  loadChapter(segmentId: string, urgent = false) {
    const known = this.chapters.get(segmentId);
    if (known) return known;
    const segment = this.segments.find(({ id }) => id === segmentId);
    if (!segment) return Promise.resolve();
    const jobs = loadOrder(segment.count).map((index) => async () => {
      await this.fetchFrame(segmentId, index);
      if (Math.abs(this.offsets.get(segmentId)! + index - this.current) <= DECODED_RADIUS) this.decodeAround();
    });
    const done = new Promise<void>((resolve) => {
      let left = jobs.length;
      enqueue(
        jobs.map((job) => () => job().finally(() => --left === 0 && resolve())),
        urgent,
      );
    });
    this.chapters.set(segmentId, done);
    return done;
  }

  show(index: number) {
    this.current = index;
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
    }
  }

  private decodeAround() {
    this.bitmaps.forEach((bitmap, index) => {
      if (Math.abs(index - this.current) <= DECODED_RADIUS * 2 || index === this.drawn) return;
      bitmap.close();
      this.bitmaps.delete(index);
    });
    for (let distance = 0; distance <= DECODED_RADIUS; distance++) {
      for (const index of [this.current + distance, this.current - distance]) void this.decode(index);
    }
    // Pide el capítulo que se está viendo por si el usuario saltó (ancla, recarga a mitad de página).
    void this.loadChapter(this.segmentOf(this.current), true);
  }

  private draw() {
    // Si el cuadro pedido aún no está decodificado, usa el decodificado más cercano.
    let index = -1;
    for (let distance = 0; distance <= DECODED_RADIUS * 2 && index < 0; distance++) {
      if (this.bitmaps.has(this.current - distance)) index = this.current - distance;
      else if (this.bitmaps.has(this.current + distance)) index = this.current + distance;
    }
    if (index < 0 || index === this.drawn) return;
    this.drawn = index;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.bitmaps.get(index)!, 0, 0, this.canvas.width, this.canvas.height);
  }
}

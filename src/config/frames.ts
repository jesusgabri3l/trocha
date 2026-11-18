import manifest from '../data/frames.json';

// Una sola fuente de verdad: src/data/frames.json (lo escribe el script de placeholders o el de ffmpeg).
export type FramesManifest = typeof manifest;
export type Device = 'desktop' | 'mobile';
export type JourneySegment = FramesManifest['journey']['segments'][number];

export const FRAMES = manifest;
export const JOURNEY_LENGTH_VH = manifest.journey.segments.reduce((sum, segment) => sum + segment.vh, 0);

export const frameUrl = (base: string, device: Device, segmentId: string, index: number) =>
  `${base}/frames/${device}/${segmentId}/${String(index).padStart(4, '0')}.avif`;

export const lastFrameIndex = (segmentId: string) =>
  (manifest.journey.segments.find((segment) => segment.id === segmentId)?.count ?? 1) - 1;

export interface MachineLabel {
  data: string;
  text: string;
  // Punto de la moto al que apunta la línea guía, en unidades del viewBox 300×200 de la imagen PERFIL.
  target: [number, number];
  // Dónde se ancla la línea del lado de la etiqueta (mismas unidades). La etiqueta se ubica en ese punto.
  anchor: [number, number];
  // Lado en que crece la etiqueta desde su ancla.
  side: 'left' | 'right';
}

// Coordenadas sobre perfil.webp (1200×800 → viewBox 300×200).
export const MACHINE_LABELS: MachineLabel[] = [
  { data: 'Automática', text: 'Acelerador y freno. Sin cambios.', target: [166, 56], anchor: [225, 22], side: 'right' },
  { data: 'Velocidad limitada en tu primera salida', text: 'El guía la libera cuando estés listo.', target: [155, 122], anchor: [165, 184], side: 'right' },
  { data: 'Suspensión larga', text: 'Los huecos se sienten, pero no te tumban.', target: [212, 98], anchor: [238, 62], side: 'right' },
  { data: 'Casco, gafas y peto', text: 'Incluidos.', target: [140, 26], anchor: [118, 8], side: 'left' },
];

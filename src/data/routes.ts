export interface Route {
  id: 'r1' | 'r2' | 'r4';
  number: string;
  name: string;
  destination: string;
  distanceKm: number;
  distance: string;
  duration: string;
  price: number;
  // Línea de la trocha en el minimapa (viewBox 0 0 200 120): inicio a la izquierda, llegada a la derecha.
  trail: string;
  start: [number, number];
  end: [number, number];
}

export const ROUTES: Route[] = [
  { id: 'r1', number: '01', name: 'BARRO', destination: 'Pozos Azules', distanceKm: 9.8, distance: '9,8 km', duration: '1 h 30 min', price: 140000, trail: 'M20 95 C50 90 60 60 90 62 S130 85 160 55 S175 30 180 25', start: [20, 95], end: [180, 25] },
  { id: 'r2', number: '02', name: 'ARENA', destination: 'Desierto de la Candelaria', distanceKm: 16.4, distance: '16,4 km', duration: '2 h 30 min', price: 190000, trail: 'M20 90 C40 50 75 105 100 70 S140 20 165 60 S178 80 180 85', start: [20, 90], end: [180, 85] },
  { id: 'r4', number: '03', name: 'MONTAÑA', destination: 'Camino a Iguaque (vereda Chaina)', distanceKm: 26.5, distance: '26,5 km', duration: '4 h', price: 320000, trail: 'M20 100 C40 95 45 60 70 55 S95 30 120 38 S150 20 165 15 S175 12 180 10', start: [20, 100], end: [180, 10] },
];

export const formatPrice = (value: number) => `$${value.toLocaleString('es-CO')}`;

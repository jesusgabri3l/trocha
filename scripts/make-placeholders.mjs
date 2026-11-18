// Cuadros sintéticos para probar el recorrido antes de generar los de Kling.
//   node scripts/make-placeholders.mjs
// Escribe public/frames/{desktop,mobile}/<segmento>/NNNN.webp, src/data/frames.json y public/img/*
// (perfil, reserva, reserva-m, roost-3). Los cuadros del hero (60, 16:9, sin alfa) van en public/frames/{desktop,mobile}/hero/.
// Para pasar a los reales: reemplazar esas carpetas (mismos conteos y tamaños) y actualizar frames.json
// (cuando existan los clips, el script de ffmpeg lo genera con el índice `darkest` de cada túnel).
import sharp from 'sharp';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const DARK = '#1F1A15';
const TEJA = '#B4462B';
const OCRE = '#D49A5A';
const ROUTES = {
  r1: { name: 'AGUA', terrain: '#1D6E6A', sky: '#A9C4BF' },
  r2: { name: 'ARENA', terrain: '#D49A5A', sky: '#EBD6B4' },
  r3: { name: 'ROCA', terrain: '#B3AA9C', sky: '#D9C3A0' },
  r4: { name: 'MONTE', terrain: '#2E432C', sky: '#EDB878' },
};
const SEGMENTS = [
  { id: 'r1', kind: 'route', count: 60, vh: 200 },
  { id: 't1', kind: 'tunnel', count: 24, vh: 70, from: 'r1', to: 'r2' },
  { id: 'r2', kind: 'route', count: 60, vh: 200 },
  { id: 't2', kind: 'tunnel', count: 24, vh: 70, from: 'r2', to: 'r3' },
  { id: 'r3', kind: 'route', count: 60, vh: 200 },
  { id: 't3', kind: 'tunnel', count: 24, vh: 70, from: 'r3', to: 'r4' },
  { id: 'r4', kind: 'route', count: 60, vh: 200 },
];
const JOURNEY_SIZES = { desktop: { w: 1280, h: 720 }, mobile: { w: 540, h: 960 } };
// Video de paisaje a pantalla completa: 16:9 en desktop; en móvil, recorte central 9:16 (mismos tamaños del recorrido).
const HERO = { count: 60, desktop: { w: 1280, h: 720 }, mobile: { w: 540, h: 960 } };
const TUNNEL_DARKEST = 12;

const mix = (a, b, t) => {
  const [x, y] = [a, b].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;
const font = 'font-family="Arial, Helvetica, sans-serif" font-weight="700"';

// ---------- recorrido ----------
function quadFromBehind(w, h, i) {
  const s = (h / 720) * (w < h ? 1.05 : 1);
  const bob = Math.sin(i * 0.9) * 4 * s;
  return `<g transform="translate(${w / 2} ${h * 0.74 + bob}) scale(${s})">
    <ellipse cx="0" cy="150" rx="150" ry="18" fill="#000" opacity=".3"/>
    <rect x="-118" y="55" width="56" height="100" rx="12" fill="#111"/><rect x="62" y="55" width="56" height="100" rx="12" fill="#111"/>
    <rect x="-84" y="-10" width="168" height="100" rx="24" fill="${TEJA}"/>
    <rect x="-62" y="-32" width="124" height="24" fill="#222"/>
    <rect x="-48" y="-135" width="96" height="125" rx="22" fill="#B9A77A"/>
    <circle cx="0" cy="-168" r="38" fill="#fff"/><rect x="-4" y="-206" width="8" height="40" fill="${TEJA}"/>
  </g>`;
}

function routeScene(w, h, route, i, count) {
  const { terrain, sky } = ROUTES[route];
  const horizon = h * 0.33;
  const period = w / 3;
  const shift = (i * 3) % period;
  let body = `<rect width="${w}" height="${h}" fill="${sky}"/><rect y="${horizon}" width="${w}" height="${h - horizon}" fill="${terrain}"/>`;
  for (let k = -1; k < 5; k++) {
    const x = k * period - shift;
    const peak = horizon - 50 - 30 * (((k % 3) + 3) % 3);
    body += `<polygon points="${x},${horizon} ${x + period / 2},${peak} ${x + period},${horizon}" fill="${mix(terrain, '#000000', 0.3)}"/>`;
  }
  const phase = (i / 6) % 1;
  for (let k = 0; k < 9; k++) {
    const u = (k + phase) / 9;
    body += `<line x1="0" x2="${w}" y1="${horizon + (h - horizon) * u * u}" y2="${horizon + (h - horizon) * u * u}" stroke="#000" stroke-opacity=".22" stroke-width="${1 + u * 5}"/>`;
  }
  for (let k = 0; k < 6; k++) {
    const u = (((k / 6 + (i / count) * 2) % 1) ** 2);
    const side = k % 2 ? 1 : -1;
    const x = w / 2 + side * (w * 0.04 + u * w * 0.5);
    const y = horizon + (h - horizon) * u;
    const sc = 0.1 + u * 1.6;
    body += `<rect x="${x - 7 * sc}" y="${y - 90 * sc}" width="${14 * sc}" height="${90 * sc}" fill="${DARK}" opacity=".55"/>`;
  }
  body += `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="${DARK}" stop-opacity="0"/><stop offset="1" stop-color="${DARK}" stop-opacity=".5"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#shade)"/>`;
  return body + quadFromBehind(w, h, i);
}

function journeyFrame(w, h, segment, i) {
  const { id, kind, count } = segment;
  const labelW = Math.min(w * 0.34, 360);
  const lx = w / 2 - labelW / 2;
  const peak = Math.floor(count / 2);
  const label = (title, color) => `<rect x="${lx}" y="${h * 0.06}" width="${labelW}" height="${h * 0.1}" fill="${DARK}" opacity=".78"/>
    <text x="${w / 2}" y="${h * 0.06 + h * 0.045}" text-anchor="middle" ${font} font-size="${Math.round(labelW / 11)}" fill="${color}">${title}</text>
    <text x="${w / 2}" y="${h * 0.06 + h * 0.082}" text-anchor="middle" ${font} font-size="${Math.round(labelW / 13)}" fill="${color}">CUADRO ${String(i + 1).padStart(2, '0')}/${count}${kind === 'route' && i === peak ? ' · PICO' : ''}</text>`;
  if (kind === 'route') return svg(w, h, routeScene(w, h, id, i, count) + label(`${id.toUpperCase()} · ${ROUTES[id].name}`, '#F2EDE3'));
  const d = Math.max(0, 1 - Math.abs(i - TUNNEL_DARKEST) / TUNNEL_DARKEST) ** 0.8;
  const base = i < TUNNEL_DARKEST ? segment.from : segment.to;
  const walls = `<polygon points="0,0 ${w * 0.5 * d},${h * 0.3} ${w * 0.5 * d},${h * 0.8} 0,${h}" fill="${DARK}"/><polygon points="${w},0 ${w - w * 0.5 * d},${h * 0.3} ${w - w * 0.5 * d},${h * 0.8} ${w},${h}" fill="${DARK}"/>`;
  return svg(w, h, routeScene(w, h, base, i, count) + walls + `<rect width="${w}" height="${h}" fill="${DARK}" opacity="${d * 0.97}"/>` + label(`${id.toUpperCase()} · TÚNEL`, '#F2EDE3'));
}

// ---------- hero (paisaje sin alfa: la cuatrimoto viene hacia la cámara y al final la tapa la arcilla) ----------
function wheel(cx, cy, r, i) {
  const spokes = [0, 45, 90, 135].map((a) => `<line x1="${-r * 0.5}" x2="${r * 0.5}" y1="0" y2="0" stroke="#555" stroke-width="10" transform="rotate(${a + i * 22})"/>`).join('');
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#111"/><circle r="${r}" fill="none" stroke="#C9955E" stroke-opacity=".55" stroke-width="14" stroke-dasharray="26 22" stroke-dashoffset="${-i * 9}"/><circle r="${r * 0.56}" fill="#222"/>${spokes}<circle r="${r * 0.12}" fill="#888"/></g>`;
}

function quadBody(i, caption = '') {
  return `<g>
    ${wheel(-215, 190, 105, i)}${wheel(200, 190, 118, i)}
    <path d="M-300 70 L-250 -20 L-120 -50 L60 -60 L260 -30 L300 90 L240 120 L-260 120 Z" fill="${TEJA}"/>
    <rect x="40" y="-85" width="190" height="34" rx="14" fill="#111"/>
    <rect x="-310" y="-10" width="70" height="40" rx="6" fill="#fff"/>
    <line x1="-120" y1="-50" x2="-165" y2="-135" stroke="#222" stroke-width="16"/><circle cx="-285" cy="45" r="16" fill="#F3D9A8"/>
    <path d="M30 -70 L120 -70 L96 -235 L-12 -245 Z" fill="#B9A77A"/>
    <path d="M-12 -190 L-150 -130" stroke="#B9A77A" stroke-width="30" stroke-linecap="round"/>
    <path d="M110 -70 L190 20 L180 90 L130 90 L110 20 Z" fill="#6B4A32"/>
    <circle cx="-20" cy="-290" r="62" fill="#fff"/><rect x="-60" y="-312" width="104" height="18" rx="9" fill="#9fb4c0"/><rect x="-26" y="-350" width="8" height="46" fill="${TEJA}"/>
    <text x="0" y="75" text-anchor="middle" ${font} font-size="34" fill="#F2EDE3">${caption}</text>
  </g>`;
}

function heroFrame({ w, h }, i) {
  const t = i / (HERO.count - 1);
  const horizon = h * 0.35;
  const half = w * 0.08; // ancho de la trocha en el horizonte
  const scale = (h / 720) * (0.12 + t ** 2 * 2.4);
  const quadY = horizon + (h - horizon) * (0.04 + t ** 1.5 * 0.7);
  const ruts = Array.from({ length: 8 }, (_, k) => {
    const u = ((k / 8 + t * 2) % 1) ** 2;
    const y = horizon + (h - horizon) * u;
    return `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#000" stroke-opacity=".18" stroke-width="${1 + u * 6}"/>`;
  }).join('');
  return svg(w, h, `<rect width="${w}" height="${h}" fill="#EBD6B4"/>
    <polygon points="0,${horizon} ${w * 0.25},${horizon - 70} ${w * 0.5},${horizon} ${w * 0.75},${horizon - 90} ${w},${horizon}" fill="#8F7B66"/>
    <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="#B8663A"/>
    <polygon points="${w / 2 - half},${horizon} ${w / 2 + half},${horizon} ${w * 0.95},${h} ${w * 0.05},${h}" fill="#C88A55"/>${ruts}
    <g transform="translate(${w / 2} ${quadY}) scale(${scale}) translate(${-w / 2} ${-h * 0.74})">${quadFromBehind(w, h, i)}</g>
    <text x="${w / 2}" y="${h * 0.2}" text-anchor="middle" ${font} font-size="${Math.round(h / 18)}" fill="${DARK}">HERO ${String(i + 1).padStart(2, '0')}/${HERO.count}</text>
    <rect width="${w}" height="${h}" fill="${OCRE}" opacity="${Math.max(0, (t - 0.88) / 0.12).toFixed(2)}"/>`);
}

// ---------- imágenes sueltas ----------
// Terrones de arcilla y piedras (alfa) lanzados desde (ox, oy) en abanico; ángulos en grados, 0 = derecha, 90 = arriba.
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const CLOD_COLORS = [OCRE, '#B8663A', '#8F7B66', '#C9955E'];
function clods(seed, { ox, oy, from, to, reach, n, size = 1, blur = 0 }) {
  const rand = rng(seed);
  return Array.from({ length: n }, () => {
    const a = ((from + rand() * (to - from)) * Math.PI) / 180;
    const d = reach * (0.15 + rand() * 0.85);
    const r = (10 + rand() * 26) * size * (0.6 + d / reach);
    const blurred = rand() < blur ? ' filter="url(#soft)"' : '';
    return `<ellipse cx="${(ox + Math.cos(a) * d).toFixed(0)}" cy="${(oy - Math.sin(a) * d).toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.75).toFixed(0)}" transform="rotate(${Math.round(rand() * 180)} ${(ox + Math.cos(a) * d).toFixed(0)} ${(oy - Math.sin(a) * d).toFixed(0)})" fill="${CLOD_COLORS[Math.floor(rand() * 4)]}"${blurred}/>`;
  }).join('');
}
const SOFT = '<defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>';
// ROOST 3 (máquina): arco desde la llanta trasera hacia el recorrido.
const roost = () => svg(1600, 900, SOFT + clods(3, { ox: 1450, oy: 740, from: 105, to: 175, reach: 1250, n: 44, size: 1.2 }));

const perfil = () => svg(1200, 800, `<g transform="translate(600 440) scale(0.82)">${quadBody(47, 'PERFIL')}</g>`);

const reserva = () =>
  svg(1600, 900, `${SOFT}<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBC48F"/><stop offset="1" stop-color="#D49A5A"/></linearGradient>
    <linearGradient id="shadow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${DARK}" stop-opacity=".8"/><stop offset=".6" stop-color="${DARK}" stop-opacity="0"/></linearGradient></defs>
    <rect width="1600" height="900" fill="url(#sky)"/><rect y="520" width="1600" height="380" fill="#B8663A"/>
    <polygon points="0,520 300,400 640,520 980,380 1300,520 1600,430 1600,520" fill="#8F4F2C"/>
    <g transform="translate(1250 580) scale(0.55) rotate(-8)">${quadBody(0, 'RESERVA')}</g>
    ${clods(21, { ox: 1150, oy: 640, from: 150, to: 190, reach: 1000, n: 34, size: 1.4, blur: 0.3 })}
    <rect width="1600" height="900" fill="url(#shadow)"/>`);

const reservaMobile = () =>
  svg(960, 1200, `${SOFT}<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBC48F"/><stop offset="1" stop-color="#B8663A"/></linearGradient>
    <linearGradient id="shadow" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="${DARK}" stop-opacity="0"/><stop offset="1" stop-color="${DARK}" stop-opacity=".85"/></linearGradient></defs>
    <rect width="960" height="1200" fill="url(#sky)"/>
    <g transform="translate(520 400) scale(0.5) rotate(-8)">${quadBody(0, 'RESERVA-M')}</g>
    ${clods(33, { ox: 500, oy: 520, from: 235, to: 305, reach: 650, n: 26, size: 1.6, blur: 0.4 })}
    <rect width="960" height="1200" fill="url(#shadow)"/>`);

// ---------- salida ----------
const out = "public/frames";
rmSync(out, { recursive: true, force: true });
const pad = (n) => String(n).padStart(4, '0');
const write = (file, markup) => sharp(Buffer.from(markup)).webp({ quality: 70 }).toFile(file);

for (const device of ['desktop', 'mobile']) {
  const { w, h } = JOURNEY_SIZES[device];
  for (const segment of SEGMENTS) {
    mkdirSync(`${out}/${device}/${segment.id}`, { recursive: true });
    await Promise.all(Array.from({ length: segment.count }, (_, i) => write(`${out}/${device}/${segment.id}/${pad(i)}.webp`, journeyFrame(w, h, segment, i))));
  }
  mkdirSync(`${out}/${device}/hero`, { recursive: true });
  await Promise.all(Array.from({ length: HERO.count }, (_, i) => sharp(Buffer.from(heroFrame(HERO[device], i))).webp({ quality: 70 }).toFile(`${out}/${device}/hero/${pad(i)}.webp`)));
}

const manifest = {
  hero: { count: HERO.count, desktop: HERO.desktop, mobile: HERO.mobile },
  journey: {
    desktop: JOURNEY_SIZES.desktop,
    mobile: JOURNEY_SIZES.mobile,
    // peak: cuadro pico de cada ruta (sacudida del canvas). Con los clips reales de 10 s, el índice del keyframe medio.
    segments: SEGMENTS.map((s) => (s.kind === 'tunnel' ? { ...s, darkest: TUNNEL_DARKEST } : { ...s, peak: Math.floor(s.count / 2) })),
  },
};
writeFileSync("src/data/frames.json", JSON.stringify(manifest, null, 2));

mkdirSync('public/img', { recursive: true });
rmSync('public/img/parqueada.webp', { force: true }); // sale en v2
for (const name of ['fique', 'tuna', 'roost-1', 'roost-2', 'roost-frente', 'polvo-1', 'polvo-2', 'polvo-3']) rmSync(`public/img/${name}.webp`, { force: true }); // salen en v3
// Nunca pisar imágenes reales: solo se crea el placeholder si el archivo no existe.
const art = { 'perfil.webp': perfil, 'roost-3.webp': roost, 'reserva.webp': reserva, 'reserva-m.webp': reservaMobile };
for (const [name, make] of Object.entries(art)) {
  if (existsSync(`public/img/${name}`)) continue;
  await sharp(Buffer.from(make())).webp({ quality: 80, alphaQuality: 90 }).toFile(`public/img/${name}`);
}
console.log('Placeholders listos.');

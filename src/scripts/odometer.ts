const isDigit = (char: string) => char >= '0' && char <= '9';

const buildDigit = () => {
  const digit = document.createElement('span');
  digit.className = 'odometer__digit';
  digit.setAttribute('aria-hidden', 'true');
  const strip = document.createElement('span');
  strip.className = 'odometer__strip';
  for (let n = 0; n < 10; n++) strip.append(Object.assign(document.createElement('span'), { textContent: String(n) }));
  digit.append(strip);
  return digit;
};

const buildChar = (char: string) => {
  const span = document.createElement('span');
  span.className = 'odometer__char';
  span.setAttribute('aria-hidden', 'true');
  span.textContent = char;
  return span;
};

// Muestra `text` con columnas de dígitos que ruedan. El texto real queda en un .sr-only para lectores de pantalla.
export function setOdometer(host: HTMLElement, text: string) {
  const shape = [...text].map((char) => (isDigit(char) ? '#' : char)).join('');
  const built = host.dataset.odometerShape === shape;
  if (!built) {
    host.dataset.odometerShape = shape;
    host.classList.add('odometer');
    const label = Object.assign(document.createElement('span'), { className: 'sr-only' });
    host.replaceChildren(label, ...[...text].map((char) => (isDigit(char) ? buildDigit() : buildChar(char))));
    void host.offsetWidth; // las columnas nacen en 0 y ruedan hasta su valor
  }
  host.querySelector('.sr-only')!.textContent = text;
  const strips = host.querySelectorAll<HTMLElement>('.odometer__strip');
  [...text].filter(isDigit).forEach((digit, index) => strips[index]!.style.setProperty('--digit', digit));
}

// [data-odometer="01"]: arranca en ceros y rueda a su valor al entrar en pantalla (data-odometer-delay en ms).
export function startOdometers() {
  const hosts = document.querySelectorAll<HTMLElement>('[data-odometer]');
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const host = entry.target as HTMLElement;
        observer.unobserve(host);
        setTimeout(() => setOdometer(host, host.dataset.odometer!), Number(host.dataset.odometerDelay ?? 0));
      }),
    { threshold: 0.6 },
  );
  hosts.forEach((host) => {
    setOdometer(host, host.dataset.odometer!.replace(/\d/g, '0'));
    observer.observe(host);
  });
}

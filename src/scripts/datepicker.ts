// Calendario propio (el selector nativo no se puede estilizar): escribe YYYY-MM-DD en el input oculto y avisa con
// un evento input, así el formulario lo trata igual que antes. Sin días pasados; hasta 12 meses adelante.
const MAX_MONTHS_AHEAD = 12;
const iso = (date: Date) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

export function startDatepicker(section: HTMLElement, input: HTMLInputElement) {
  const root = section.querySelector<HTMLElement>('[data-datepicker]');
  const toggle = root?.querySelector<HTMLButtonElement>('[data-date-toggle]');
  const text = root?.querySelector<HTMLElement>('[data-date-text]');
  const calendar = root?.querySelector<HTMLElement>('[data-calendar]');
  const monthLabel = root?.querySelector<HTMLElement>('[data-month-label]');
  const days = root?.querySelector<HTMLElement>('[data-days]');
  if (!root || !toggle || !text || !calendar || !monthLabel || !days) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let month = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstMonth = month.getTime();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + MAX_MONTHS_AHEAD, 1).getTime();
  const prev = root.querySelector<HTMLButtonElement>('[data-month="-1"]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-month="1"]')!;

  const render = () => {
    monthLabel.textContent = month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    prev.disabled = month.getTime() <= firstMonth;
    next.disabled = month.getTime() >= lastMonth;
    const offset = (month.getDay() + 6) % 7; // semana empieza el lunes
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: string[] = Array.from({ length: offset }, () => '<span></span>');
    for (let day = 1; day <= count; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const value = iso(date);
      const label = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
      cells.push(
        `<button class="booking__calendar-day" type="button" data-day="${value}" aria-label="${label}"` +
          `${date < today ? ' disabled' : ''}${value === input.value ? ' aria-pressed="true"' : ''}` +
          `${value === iso(today) ? ' data-today' : ''}>${day}</button>`,
      );
    }
    days.innerHTML = cells.join('');
  };

  const open = (isOpen: boolean) => {
    calendar.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) return;
    // Abre hacia arriba salvo que no quepa entre la navbar y el campo.
    calendar.toggleAttribute('data-below', toggle.getBoundingClientRect().top < 420);
    if (input.value) month = new Date(`${input.value.slice(0, 7)}-01T12:00:00`);
    month.setHours(0, 0, 0, 0);
    render();
    (days.querySelector<HTMLButtonElement>('[aria-pressed="true"], button:not(:disabled)') ?? next).focus();
  };

  toggle.addEventListener('click', () => open(calendar.hidden));
  [prev, next].forEach((button) =>
    button.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + Number(button.dataset.month), 1);
      render();
    }),
  );
  days.addEventListener('click', (event) => {
    const day = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-day]');
    if (!day || day.disabled) return;
    input.value = day.dataset.day!;
    text.textContent = new Date(`${input.value}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
    input.dispatchEvent(new Event('input', { bubbles: true }));
    open(false);
    toggle.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !calendar.hidden) {
      open(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!calendar.hidden && !root.contains(event.target as Node)) open(false);
  });
}

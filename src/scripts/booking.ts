import { SITE } from '../config/site';
import { setOdometer } from './odometer';
import { startDatepicker } from './datepicker';

const formatPrice = (value: number) => `$${value.toLocaleString('es-CO')}`;
const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

export function startBooking() {
  const section = document.querySelector<HTMLElement>('[data-booking]');
  const form = section?.querySelector<HTMLFormElement>('[data-booking-form]');
  const quantity = section?.querySelector<HTMLInputElement>('[data-booking-quantity]');
  const date = section?.querySelector<HTMLInputElement>('[data-booking-date]');
  const total = section?.querySelector<HTMLOutputElement>('[data-booking-total]');
  const whatsapp = section?.querySelector<HTMLAnchorElement>('[data-booking-whatsapp]');
  if (!section || !form || !quantity || !date || !total || !whatsapp) return;

  startDatepicker(section, date);

  const chosenRoute = () => form.querySelector<HTMLInputElement>('input[name="route"]:checked')!;
  const chosenQuantity = () => Math.min(8, Math.max(1, Math.round(Number(quantity.value) || 1)));

  const refresh = () => {
    const route = chosenRoute();
    const count = chosenQuantity();
    const totalText = formatPrice(Number(route.dataset.price) * count);
    setOdometer(total, totalText);
    const when = date.value ? `para el ${formatDate(date.value)}` : 'con fecha por definir';
    const message = `Hola TROCHA, quiero reservar la ruta ${route.dataset.label} ${when} para ${count} ${count === 1 ? 'cuatrimoto' : 'cuatrimotos'}. Total: ${totalText}.`;
    whatsapp.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
  };

  form.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => event.preventDefault());
  quantity.addEventListener('change', () => {
    quantity.value = String(chosenQuantity());
    refresh();
  });
  form.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) =>
    button.addEventListener('click', () => {
      quantity.value = String(Math.min(8, Math.max(1, chosenQuantity() + Number(button.dataset.step))));
      refresh();
    }),
  );

  // Los botones "Reservar esta ruta" de los boletos dejan la ruta elegida antes de bajar al formulario.
  document.querySelectorAll<HTMLElement>('[data-reserve-route]').forEach((link) =>
    link.addEventListener('click', () => {
      const chip = form.querySelector<HTMLInputElement>(`input[name="route"][value="${link.dataset.reserveRoute}"]`);
      if (!chip) return;
      chip.checked = true;
      refresh();
      // Móvil: el carrusel muestra la carta elegida.
      const card = chip.closest('label')!;
      card.parentElement!.scrollLeft = card.offsetLeft - 16;
    }),
  );

  refresh();
}

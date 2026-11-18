import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SITE } from '../config/site';
import { prefersReducedMotion } from './motion';
import { setOdometer } from './odometer';

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

  date.min = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en hora local

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
    }),
  );

  refresh();

  if (prefersReducedMotion()) return;

  // La foto hace el "cambio de cuadro" una sola vez al cruzar el borde (sin parallax).
  ScrollTrigger.create({ trigger: section, start: 'top 90%', once: true, onEnter: () => section.setAttribute('data-entered', '') });
}

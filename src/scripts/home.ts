import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { startSmoothScroll } from './smooth-scroll';
import { startHero } from './hero-sequence';
import { startJourney } from './journey-sequence';
import { startMachine } from './machine';
import { startBooking } from './booking';
import { startReveal } from './reveal';
import { startOdometers } from './odometer';

gsap.registerPlugin(ScrollTrigger);

startSmoothScroll();
startReveal();
startOdometers();
startMachine();
startBooking();
// Hero y recorrido arrancan en paralelo; la carga de cuadros ya los ordena (hero, luego R1).
void startHero();
void startJourney();

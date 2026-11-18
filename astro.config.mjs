// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// Publicado en Vercel, en la raíz del dominio. BASE_PATH solo si algún día vuelve a vivir bajo una subcarpeta.
export default defineConfig({
  site: 'https://trocha-demo.vercel.app',
  base: process.env.BASE_PATH ?? '/',
  fonts: [
    { provider: fontProviders.fontsource(), name: 'Jersey 10', cssVariable: '--font-display', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    { provider: fontProviders.fontsource(), name: 'Chivo', cssVariable: '--font-body', weights: [400, 700, 900], styles: ['normal'], subsets: ['latin'] },
    { provider: fontProviders.fontsource(), name: 'Chivo Mono', cssVariable: '--font-mono', weights: [500], styles: ['normal'], subsets: ['latin'] },
  ],
});

// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// En GitHub Pages el sitio vive bajo /<repo>/ (BASE_PATH lo pone el workflow); en local queda en la raíz.
export default defineConfig({
  site: 'https://jesusgabri3l.github.io',
  base: process.env.BASE_PATH ?? '/',
  fonts: [
    { provider: fontProviders.fontsource(), name: 'Jersey 10', cssVariable: '--font-display', weights: [400], styles: ['normal'], subsets: ['latin', 'latin-ext'] },
    { provider: fontProviders.fontsource(), name: 'Chivo', cssVariable: '--font-body', weights: [400, 700, 900], styles: ['normal'], subsets: ['latin'] },
    { provider: fontProviders.fontsource(), name: 'Chivo Mono', cssVariable: '--font-mono', weights: [500], styles: ['normal'], subsets: ['latin'] },
  ],
});

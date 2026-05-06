import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://xp-repuestos.vercel.app',
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
    imageService: false,
    maxDuration: 10,
  }),
  trailingSlash: 'never',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    inlineStylesheets: 'auto',
  },
  image: {
    domains: ['xprepuestos.com.ar'],
  },
  security: {
    checkOrigin: true,
  },
});

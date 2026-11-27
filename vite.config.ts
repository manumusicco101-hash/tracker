/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Identificador del build: el commit en Vercel o, si no está, la fecha y hora del build.
// Se muestra en Ajustes para saber qué versión tiene cargada el celular.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // El registro lo hace <UpdatePrompt /> con useRegisterSW, que avisa cuando hay versión nueva.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Gastos · Seguimiento diario',
        short_name: 'Gastos',
        description: 'Registro rápido de gastos diarios con cuotas, recurrentes y varias monedas.',
        lang: 'es-AR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#0071e3',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Se testea con la zona horaria de Argentina para cubrir el corrimiento UTC-3.
    env: { TZ: 'America/Argentina/Buenos_Aires' },
  },
});

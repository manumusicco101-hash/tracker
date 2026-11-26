import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Genera los íconos PNG de la PWA a partir de public/favicon.svg:
//   npm run generate-pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#4f46e5' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#4f46e5' } },
  },
  images: ['public/favicon.svg'],
});

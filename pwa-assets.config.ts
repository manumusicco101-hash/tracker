import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Genera los íconos PNG de la PWA a partir de public/favicon.svg:
//   npm run generate-pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0071e3' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0071e3' } },
  },
  images: ['public/favicon.svg'],
});

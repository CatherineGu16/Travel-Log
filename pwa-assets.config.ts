import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates favicon, PWA and Apple touch icons from public/icon.svg:  npm run icons
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#f4f1e8' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#f4f1e8' } },
  },
  images: ['public/icon.svg'],
})

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves the app from https://<username>.github.io/<repo>/. The deploy workflow passes
// the repo name in BASE_PATH, so renaming the repo doesn't break the site.
const BASE = process.env.BASE_PATH ?? '/Travel-Log/'

/**
 * Production-only Content Security Policy: the app may load only its own files and talk only to
 * GitHub's API (for sync) and, when the optional detailed map is turned on, OpenFreeMap (tiles) and
 * Photon (search). MapLibre runs its workers from blob: URLs. blob: images are avatar photos.
 * Not applied in dev, where Vite's hot reload needs inline scripts and websockets.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.github.com https://tiles.openfreemap.org https://photon.komoot.io",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "child-src blob:",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Travel Log',
        short_name: 'Travel Log',
        description: 'Log your trips on a map and track the US national parks you have visited.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f4f1e8',
        theme_color: '#f4f1e8',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, bundled map data, label fonts and icons are cached so the app opens offline.
        globPatterns: ['**/*.{js,mjs,css,html,woff2,png,svg,ico,pbf}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})

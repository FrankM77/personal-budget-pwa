import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Keep your base URL if you are deploying to GitHub Pages
  base: '/personal-budget-pwa/',
  // Disable environment file loading to avoid permission issues
  envDir: false,
  server: {
    port: 3000,
    host: '127.0.0.1'
  },
  preview: {
    port: 4000,
    host: '127.0.0.1'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Personal Budget',
        short_name: 'Budget',
        description: 'Track personal expenses and budgets',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone', // This hides the Safari URL bar
        orientation: 'portrait',
        scope: '/personal-budget-pwa/',
        start_url: '/personal-budget-pwa/',
        icons: [
          {
            src: 'icon-192.png', // Ensure these exist in your public folder later
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable' // Add this - tells Android how to handle the icon
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Add this - tells Android how to handle the icon
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5000000,
        // Handle all navigation requests within the app scope
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/personal-budget-pwa/],
        // Only deny API calls and files with extensions
        navigateFallbackDenylist: [/^\/api\//, /^\/_/, /\/[^/?]+\.[^/]+$/],
      },
      devOptions: {
        enabled: true // Allows testing SW in dev mode
      }
    })
  ],
})
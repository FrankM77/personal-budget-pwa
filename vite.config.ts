import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Keep your base URL if you are deploying to GitHub Pages
  base: '/house-budget-pwa/',
  // Disable environment file loading to avoid permission issues
  envDir: false,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'House Expenses',
        short_name: 'Expenses',
        description: 'Track house expenses and splits',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone', // This hides the Safari URL bar
        orientation: 'portrait',
        scope: '/house-budget-pwa/',
        start_url: '/house-budget-pwa/',
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
        navigateFallbackAllowlist: [/^\/house-budget-pwa/],
        // Only deny API calls and files with extensions
        navigateFallbackDenylist: [/^\/api\//, /^\/_/, /\/[^/?]+\.[^/]+$/],
      },
      devOptions: {
        enabled: true // Allows testing SW in dev mode
      }
    })
  ],
})
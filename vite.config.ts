import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Keep your base URL if you are deploying to GitHub Pages
  base: '/house-budget-pwa/', 
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Like "Automatic Updates" on App Store
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
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
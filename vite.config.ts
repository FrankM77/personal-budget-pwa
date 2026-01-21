import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import fs from 'fs'

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Keep your base URL if you are deploying to GitHub Pages
    base: '/personal-budget-pwa/',
    server: {
      port: 3000,
      host: '127.0.0.1'
    },
    preview: {
      port: 4000,
      host: '127.0.0.1'
    },
    // Explicitly define environment variables to expose to your client-side code
    define: {
      '__APP_VERSION__': JSON.stringify(packageJson.version),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID || '')
    },
    // Resolve aliases for cleaner imports
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
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
          enabled: false // Disable SW in dev mode - it conflicts with Vite's module resolution
        }
      })
    ],
  }
})
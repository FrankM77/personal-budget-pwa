import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'
import logger from './utils/logger'

// @ts-expect-error updateSW is used for future PWA update notifications
const updateSW = registerSW({
  onNeedRefresh() {
    // Optional: Show a toast to user
  },
  onOfflineReady() {
    logger.log('App is ready for offline work');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

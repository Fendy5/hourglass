import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import './index.css'
import App from './App.tsx'
import Settings from './Settings.tsx'

const appWindow = getCurrentWindow();

if (appWindow.label === 'settings') {
  document.body.classList.add('settings-window');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {appWindow.label === 'settings' ? <Settings /> : <App />}
  </StrictMode>,
)

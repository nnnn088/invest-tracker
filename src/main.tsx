import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { SettingsProvider } from './settings'
import { seedDemoOnFirstDevRun } from './data/demo'
import { initData } from './data/repo'

initData()
  .then(seedDemoOnFirstDevRun)
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </StrictMode>,
    )
  })

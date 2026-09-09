import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/index.css'
import { App } from './App'
import { registerOfflineShell } from './shell/offline'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After the first paint, never before it: the offline shell is insurance, and
// insurance must not cost the person their first frame.
registerOfflineShell()

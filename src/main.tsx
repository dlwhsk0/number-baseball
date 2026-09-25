import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// beforeinstallprompt는 앱이 뜬 직후 한 번 날아온다 — 컴포넌트보다 먼저 잡아둬야 한다.
import './pwa/install'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

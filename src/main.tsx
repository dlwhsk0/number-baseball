import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// beforeinstallprompt는 앱이 뜬 직후 한 번 날아온다 — 컴포넌트보다 먼저 잡아둬야 한다.
import './pwa/install'
import App from './App.tsx'
// 엑셀 위장 테마 — App.css보다 뒤에 와야 덮어쓴다(App.tsx가 App.css를 임포트하므로 App 다음에).
import './excel-theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

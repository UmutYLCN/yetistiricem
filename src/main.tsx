import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { isAppPath, takeDemoRequest } from './lib/routes.ts'
import { Root } from './Root.tsx'

const inApp = isAppPath(window.location.pathname)
const startInDemo = inApp && takeDemoRequest()
if (inApp) document.title = 'Dashboard · Yetiştiricem'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root inApp={inApp} startInDemo={startInDemo} />
  </StrictMode>,
)

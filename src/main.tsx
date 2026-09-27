import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { hasAuthCallback } from './lib/authKey.ts'
import { APP_PATH, isAppPath, takeDemoRequest, takeDiscoverRequest, takeImportRequest } from './lib/routes.ts'
import { Root } from './Root.tsx'

const inApp = isAppPath(window.location.pathname)

if (!inApp && hasAuthCallback()) {
  // A sign-in answer that fell back to the site root (its return address was
  // not allow-listed in Supabase) goes on to the planner, which reads it.
  window.location.replace(`${APP_PATH}${window.location.hash}`)
} else {
  const startInDemo = inApp && takeDemoRequest()
  const importPayload = inApp ? takeImportRequest() : null
  const openDiscover = inApp && takeDiscoverRequest()
  if (inApp) document.title = 'Dashboard · Yetiştiricem'

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root inApp={inApp} startInDemo={startInDemo} importPayload={importPayload} openDiscover={openDiscover} />
    </StrictMode>,
  )
}

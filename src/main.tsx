import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { hasAuthCallback } from './lib/authKey.ts'
import { APP_PATH, isAppPath, isConsentPath, isDocsPath, takeDemoRequest, takeDiscoverRequest, takeImportRequest, takeMcpDraftRequest } from './lib/routes.ts'
import { initTheme } from './lib/theme.ts'
import { initializeLanguage } from './lib/language.ts'
import { msg } from './lib/messages.ts'
import { Root } from './Root.tsx'

initTheme()
initializeLanguage()

const inApp = isAppPath(window.location.pathname)
const inConsent = isConsentPath(window.location.pathname)
const inDocs = isDocsPath(window.location.pathname)

if (!inApp && !inConsent && hasAuthCallback()) {
  // A sign-in answer that fell back to the site root (its return address was
  // not allow-listed in Supabase) goes on to the planner, which reads it.
  window.location.replace(`${APP_PATH}${window.location.hash}`)
} else {
  const startInDemo = inApp && takeDemoRequest()
  const importPayload = inApp ? takeImportRequest() : null
  const mcpDraftId = inApp ? takeMcpDraftRequest() : null
  const openDiscover = inApp && takeDiscoverRequest()
  if (inApp) document.title = `${msg('Dashboard')} · Yetişir`
  if (inConsent) document.title = `${msg('Bağlantı onayı')} · Yetişir`
  if (inDocs) document.title = `${msg('Belgeler')} · Yetişir`
  if (!inApp && !inConsent && !inDocs) document.title = msg('Yetişir — Panik yok, yetişir')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root inApp={inApp} inConsent={inConsent} inDocs={inDocs} startInDemo={startInDemo} importPayload={importPayload} mcpDraftId={mcpDraftId} openDiscover={openDiscover} />
    </StrictMode>,
  )
}

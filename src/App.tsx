import { useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { apiGetSettings } from './api'
import { resolveCompanyName } from './branding'
import { useAuth } from './store'
import { LoginScreen } from './components/LoginScreen'
import { POSLayout } from './components/POSLayout'
import { CustomerDisplayWindow } from './components/CustomerDisplayWindow'

const WINDOW_TITLE_SUFFIX = '© Zynknet Technology Solutions'
const DEFAULT_PRODUCT_NAME = 'ZYNKPOS'

// Detect customer display mode:
//   - In Tauri: check the window label (set by the Rust open_customer_display command)
//   - In browser: fall back to URL query param for dev/testing
const IS_CUSTOMER_DISPLAY = (() => {
  if (typeof window === 'undefined') return false
  try {
    if (isTauri()) {
      return getCurrentWindow().label === 'customer-display'
    }
  } catch { /* ignore */ }
  return new URLSearchParams(window.location.search).get('mode') === 'customer-display'
})()

// ── Main POS app (handles auth + company title) ───────────────────────────────
function MainApp() {
  const { user, token, apiBase, companyName, currentSection, setCompanyName } = useAuth()

  useEffect(() => {
    let disposed = false

    async function applyCompanyTitle() {
      // Use whatever is already stored as fallback — never wipe a persisted name
      const fallback = currentSection?.name || companyName || DEFAULT_PRODUCT_NAME

      if (!apiBase) {
        document.title = `${fallback} ${WINDOW_TITLE_SUFFIX}`
        if (isTauri()) await getCurrentWindow().setTitle(`${fallback} ${WINDOW_TITLE_SUFFIX}`)
        return
      }
      try {
        const settings = await apiGetSettings()
        if (disposed) return

        const companyTitle = currentSection?.name || resolveCompanyName(settings.company_name) || DEFAULT_PRODUCT_NAME
        const windowTitle = `${companyTitle} ${WINDOW_TITLE_SUFFIX}`
        document.title = windowTitle
        setCompanyName(companyTitle)

        if (isTauri()) {
          await getCurrentWindow().setTitle(windowTitle)
        }
      } catch {
        if (disposed) return
        // API unreachable or unauthenticated — keep the persisted company name as-is
        document.title = `${fallback} ${WINDOW_TITLE_SUFFIX}`
        if (isTauri()) {
          await getCurrentWindow().setTitle(`${fallback} ${WINDOW_TITLE_SUFFIX}`)
        }
      }
    }

    applyCompanyTitle()

    return () => {
      disposed = true
    }
  }, [apiBase, token, currentSection])

  if (!user || !token) {
    return <LoginScreen />
  }

  return <POSLayout />
}

// ── Root component ────────────────────────────────────────────────────────────
export default function App() {
  if (IS_CUSTOMER_DISPLAY) {
    return <CustomerDisplayWindow />
  }
  return <MainApp />
}

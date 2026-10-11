import { setAccessToken } from './api'
import type { AuthSession } from './types'

export function saveSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem('movers_session', JSON.stringify(session))
    setAccessToken(session.accessToken)
  } else {
    localStorage.removeItem('movers_session')
    setAccessToken(null)
  }
}

/** The company a tenant user last worked in, so the next sign-in opens it again. */
export function rememberCompany(companyId: string | null | undefined) {
  try { if (companyId) localStorage.setItem('movers_company', companyId); else localStorage.removeItem('movers_company') } catch { /* storage unavailable */ }
}

export function lastCompany(): string | null {
  try { return localStorage.getItem('movers_company') } catch { return null }
}

export function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem('movers_session')
    const session = raw ? JSON.parse(raw) as AuthSession : null
    if (session) setAccessToken(session.accessToken)
    return session
  } catch { return null }
}

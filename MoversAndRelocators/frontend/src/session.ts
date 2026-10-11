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

export function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem('movers_session')
    const session = raw ? JSON.parse(raw) as AuthSession : null
    if (session) setAccessToken(session.accessToken)
    return session
  } catch { return null }
}

import {
  AUTH_EXPIRY_HOURS,
  AUTH_EXPIRY_KEY,
  AUTH_STORAGE_KEY,
} from './constants'

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(AUTH_EXPIRY_KEY)
}

export function startAuthSession(token: string): void {
  const nextExpiry = Date.now() + AUTH_EXPIRY_HOURS * 60 * 60 * 1000
  localStorage.setItem(AUTH_STORAGE_KEY, token)
  localStorage.setItem(AUTH_EXPIRY_KEY, String(nextExpiry))
}

export function isAuthSessionValid(): boolean {
  const token = localStorage.getItem(AUTH_STORAGE_KEY)
  const expiry = Number(localStorage.getItem(AUTH_EXPIRY_KEY))

  if (!token || !Number.isFinite(expiry)) {
    return false
  }

  if (Date.now() > expiry) {
    clearAuthSession()
    return false
  }

  return true
}

export function refreshAuthSessionExpiry(): boolean {
  if (!isAuthSessionValid()) {
    return false
  }

  const nextExpiry = Date.now() + AUTH_EXPIRY_HOURS * 60 * 60 * 1000
  localStorage.setItem(AUTH_EXPIRY_KEY, String(nextExpiry))
  return true
}

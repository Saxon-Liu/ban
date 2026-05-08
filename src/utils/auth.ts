import {
  AUTH_CREDENTIAL_VERSION_KEY,
  AUTH_EXPIRY_HOURS,
  AUTH_EXPIRY_KEY,
  AUTH_SESSION_VERSION_KEY,
  AUTH_STORAGE_KEY,
} from './constants'
import { getAuthCredentialVersion } from './credentials'

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(AUTH_EXPIRY_KEY)
  localStorage.removeItem(AUTH_SESSION_VERSION_KEY)
}

export function startAuthSession(token: string): void {
  const nextExpiry = Date.now() + AUTH_EXPIRY_HOURS * 60 * 60 * 1000
  localStorage.setItem(AUTH_STORAGE_KEY, token)
  localStorage.setItem(AUTH_EXPIRY_KEY, String(nextExpiry))
  localStorage.setItem(AUTH_SESSION_VERSION_KEY, String(getAuthCredentialVersion()))
}

export function isAuthSessionValid(): boolean {
  const token = localStorage.getItem(AUTH_STORAGE_KEY)
  const expiry = Number(localStorage.getItem(AUTH_EXPIRY_KEY))
  const sessionVersion = Number(localStorage.getItem(AUTH_SESSION_VERSION_KEY))
  const currentVersion = getAuthCredentialVersion()

  if (!token || !Number.isFinite(expiry) || !Number.isInteger(sessionVersion)) {
    return false
  }

  if (sessionVersion !== currentVersion) {
    clearAuthSession()
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

export function invalidateAuthSessions(): number {
  const nextVersion = getAuthCredentialVersion() + 1
  localStorage.setItem(AUTH_CREDENTIAL_VERSION_KEY, String(nextVersion))
  clearAuthSession()
  return nextVersion
}

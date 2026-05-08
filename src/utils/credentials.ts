import {
  AUTH_CREDENTIAL_VERSION_KEY,
  CUSTOM_KEY_STORAGE,
  DEFAULT_KEY,
  LEGACY_CUSTOM_KEY_STORAGE,
  RESET_CODE,
} from './constants'

function getCryptoApi() {
  const cryptoApi = globalThis.crypto
  return cryptoApi?.subtle ? cryptoApi : null
}

function normalizeHashBytes(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function fallbackHash(secret: string): string {
  let hash = 2166136261
  for (let index = 0; index < secret.length; index++) {
    hash ^= secret.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export async function hashSecret(secret: string): Promise<string> {
  const cryptoApi = getCryptoApi()
  if (!cryptoApi) {
    return fallbackHash(secret)
  }

  const payload = new TextEncoder().encode(secret)
  return normalizeHashBytes(await cryptoApi.subtle.digest('SHA-256', payload))
}

export function getStoredSecretHash(): string {
  return localStorage.getItem(CUSTOM_KEY_STORAGE) || ''
}

export async function migrateLegacyStoredSecret(): Promise<void> {
  const legacySecret = localStorage.getItem(LEGACY_CUSTOM_KEY_STORAGE)
  if (!legacySecret || localStorage.getItem(CUSTOM_KEY_STORAGE)) {
    return
  }

  localStorage.setItem(CUSTOM_KEY_STORAGE, await hashSecret(legacySecret))
  localStorage.removeItem(LEGACY_CUSTOM_KEY_STORAGE)
}

export async function verifyLoginSecret(secret: string): Promise<boolean> {
  await migrateLegacyStoredSecret()
  const storedCustomHash = getStoredSecretHash()
  if (storedCustomHash) {
    return (await hashSecret(secret)) === storedCustomHash
  }

  return secret === DEFAULT_KEY
}

export async function verifyResetCode(resetCode: string): Promise<boolean> {
  return resetCode === RESET_CODE
}

export async function setCustomSecret(secret: string): Promise<void> {
  localStorage.setItem(CUSTOM_KEY_STORAGE, await hashSecret(secret))
  localStorage.removeItem(LEGACY_CUSTOM_KEY_STORAGE)
}

export function clearCustomSecret(): void {
  localStorage.removeItem(CUSTOM_KEY_STORAGE)
  localStorage.removeItem(LEGACY_CUSTOM_KEY_STORAGE)
}

export function getAuthCredentialVersion(): number {
  const raw = Number(localStorage.getItem(AUTH_CREDENTIAL_VERSION_KEY))
  if (Number.isInteger(raw) && raw > 0) {
    return raw
  }

  localStorage.setItem(AUTH_CREDENTIAL_VERSION_KEY, '1')
  return 1
}

// Cookie utility functions
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

export function setCookie(name: string, value: string, maxAge: number = COOKIE_MAX_AGE) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [key, val] = cookie.trim().split('=')
    if (key === name) {
      return decodeURIComponent(val || '')
    }
  }
  return null
}

export function removeCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=;path=/;max-age=0`
}
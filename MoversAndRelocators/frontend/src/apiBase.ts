/**
 * Address of the API. Empty means the same site as the web app (the development proxy, or /api served on the
 * web app's own domain). When the API is on its own domain, set VITE_API_BASE_URL at build time, e.g.
 * VITE_API_BASE_URL=https://api.yourcompany.com
 */
const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

/** An https page cannot call an http API (the browser blocks it as mixed content), so upgrade it. */
export const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'https:' && configured.startsWith('http://')
  ? 'https://' + configured.slice('http://'.length)
  : configured

/** Prefixes API paths (/api/…) with the API address; full URLs (S3, other sites) are returned unchanged. */
export const apiUrl = (url: string) => url.startsWith('/') ? API_BASE + url : url

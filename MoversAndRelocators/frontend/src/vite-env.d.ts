/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API address when it is hosted on a different domain from the web app; empty for the same site. */
  readonly VITE_API_BASE_URL?: string
}

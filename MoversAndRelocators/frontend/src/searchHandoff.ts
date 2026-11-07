import { createContext } from 'react'
/**
 * Hands a search from the Ctrl K palette to the list page it opens: the palette leaves the text here
 * under the page's key, and the page starts its search with it (once).
 */
const pending = new Map<string, string>()

export const handOffSearch = (page: string, query: string) => { pending.set(page, query) }

/** The search handed to this page, or '' — taken once so a later visit starts empty. */
export const takeSearch = (page: string) => {
  const query = pending.get(page) ?? ''
  // Cleared after this render, not at once: React (StrictMode) may call a state initializer twice, and both calls must see it.
  if (query) setTimeout(() => { if (pending.get(page) === query) pending.delete(page) }, 0)
  return query
}

/** Opens a list page already searching for a text (e.g. a record number). Provided by the workspace layout. */
export const OpenListContext = createContext<(page: string, query: string) => void>(() => {})

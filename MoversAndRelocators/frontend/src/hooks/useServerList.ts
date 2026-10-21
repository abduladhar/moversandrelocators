import { UIEvent, useCallback, useEffect, useRef, useState } from 'react'
import { message } from 'antd'

/** One page of a server list (Movers.Services.Common.PagedResult). summary carries figures for the whole list (stats cards, filter options). */
export type Paged<T, S = unknown> = { items: T[]; total: number; summary?: S | null }
/** What a list screen sends: keyword, sort, page window and its own filters (empty values are left out of the query string). */
export type ListParams = { search?: string; sort?: string; desc?: boolean; skip?: number; take?: number } & Record<string, string | number | boolean | null | undefined>

/** The query string for list params, without empty values. */
export function listQuery(params: ListParams) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') q.set(key, String(value))
  return q.toString()
}

const PAGE_SIZE = 50

/**
 * Advanced search done by the server: whenever the keyword, a filter or the sort changes (keyword typing is debounced), the
 * first page is fetched again; scrolling near the bottom fetches the next page. Responses that arrive after a newer request
 * are ignored, so fast typing never shows stale rows.
 */
export function useServerList<T, S = unknown>(fetchPage: (params: ListParams) => Promise<Paged<T, S>>, params: ListParams, options?: { debounceMs?: number; failMessage?: string }) {
  const [rows, setRows] = useState<T[]>([]), [total, setTotal] = useState(0), [summary, setSummary] = useState<S | null>(null), [loading, setLoading] = useState(true)
  const request = useRef(0), fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const key = JSON.stringify(params)
  const [debouncedKey, setDebouncedKey] = useState(key)
  useEffect(() => { const timer = setTimeout(() => setDebouncedKey(key), options?.debounceMs ?? 300); return () => clearTimeout(timer) }, [key, options?.debounceMs])

  const load = useCallback(async (skip: number, take = PAGE_SIZE) => {
    const id = ++request.current
    setLoading(true)
    try {
      const page = await fetchRef.current({ ...(JSON.parse(debouncedKey) as ListParams), skip, take })
      if (id !== request.current) return
      setRows(current => skip === 0 ? page.items : [...current.slice(0, skip), ...page.items])
      setTotal(page.total); setSummary(page.summary ?? null)
    } catch (error) {
      if (id === request.current) message.error(error instanceof Error ? error.message : options?.failMessage ?? String(error))
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [debouncedKey, options?.failMessage])

  useEffect(() => { void load(0) }, [load])

  /** Fetches again, keeping as many rows as are shown now (after a save, an import, a status change...). */
  const reload = useCallback(() => load(0, Math.min(Math.max(rows.length, PAGE_SIZE), 200)), [load, rows.length])
  const hasMore = rows.length < total
  const onScroll = (event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget
    if (!loading && hasMore && target.scrollHeight - target.scrollTop - target.clientHeight < 120) void load(rows.length)
  }
  return { rows, setRows, total, summary, loading, hasMore, onScroll, reload }
}

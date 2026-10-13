import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import dayjs from 'dayjs'

/**
 * Translations for the app and for messages the server sends as codes.
 *
 * Texts live in locales/<language>/<namespace>.json and are looked up as "<namespace>.<key>", e.g. t('common.save')
 * or t('server.INVALID_EMAIL_PASSWORD'). {name} placeholders are filled from params. A key with _zero/_one/_two/_few/
 * _many/_other variants is chosen by params.count (Arabic has all six forms). Missing texts fall back to English,
 * then to the key, so a forgotten translation is visible but never breaks the page.
 * English is bundled; the other languages load when chosen.
 */
export type Language = 'en' | 'ar' | 'tr' | 'es' | 'fr' | 'pt'
export const languages: { code: Language; name: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'pt', name: 'Português', dir: 'ltr' },
]
export type Params = Record<string, string | number | null | undefined>
type Dictionary = Record<string, unknown>

const english = flatten(import.meta.glob<Dictionary>('./locales/en/*.json', { eager: true, import: 'default' }))
const loaders = import.meta.glob<Dictionary>(['./locales/*/*.json', '!./locales/en/*.json'], { import: 'default' })
const loaded: Partial<Record<Language, Record<string, string>>> = { en: english }

/** { './locales/en/common.json': { save: 'Save', nested: { a: 'b' } } } -> { 'common.save': 'Save', 'common.nested.a': 'b' } */
function flatten(files: Record<string, Dictionary>) {
  const out: Record<string, string> = {}
  const walk = (prefix: string, value: unknown) => {
    if (typeof value === 'string') out[prefix] = value
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(prefix + '.' + k, v)
  }
  for (const [file, dict] of Object.entries(files)) walk(file.split('/').pop()!.replace(/\.json$/, ''), dict)
  return out
}

async function load(language: Language) {
  if (loaded[language]) return
  const files = Object.entries(loaders).filter(([file]) => file.startsWith(`./locales/${language}/`))
  loaded[language] = flatten(Object.fromEntries(await Promise.all(files.map(async ([file, read]) => [file, await read()] as const))))
}

const STORAGE_KEY = 'crateway_language'
function initialLanguage(): Language {
  try { const saved = localStorage.getItem(STORAGE_KEY); if (languages.some(l => l.code === saved)) return saved as Language } catch { /* storage unavailable */ }
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return languages.some(l => l.code === browser) ? browser as Language : 'en'
}

let current: Language = 'en'
/** Formatting locale: Arabic keeps Western digits (common for business documents in the Gulf). */
export const formatLocale = (language: Language = current) => ({ en: 'en-GB', ar: 'ar-u-nu-latn', tr: 'tr-TR', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR' })[language]

function lookup(language: Language, key: string) { return loaded[language]?.[key] ?? english[key] }

/** Translates outside React (plain modules, the API client). Inside components use useT() so the page follows a language change. */
export function t(key: string, params?: Params, language: Language = current): string {
  let text: string | undefined
  if (params && typeof params.count === 'number') {
    const form = new Intl.PluralRules(formatLocale(language)).select(params.count)
    text = (params.count === 0 ? lookup(language, key + '_zero') : undefined) ?? lookup(language, `${key}_${form}`) ?? lookup(language, key + '_other')
  }
  text ??= lookup(language, key)
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing text: ${key}`)
    return key
  }
  return params ? text.replace(/\{(\w+)\}/g, (all, name) => {
    const value = params[name]
    return value === undefined || value === null ? all : typeof value === 'number' ? value.toLocaleString(formatLocale(language)) : String(value)
  }) : text
}

/** True when a text exists (in any language, English included). */
export const has = (key: string) => lookup(current, key) !== undefined

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => value.toLocaleString(formatLocale(), options)
export const formatDate = (value: string | number | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) => new Date(value).toLocaleString(formatLocale(), options)
export const formatDateTime = (value: string | number | Date) => formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })

/**
 * The text for an error the API sent: its code in the user's language (with the values it sent), otherwise the English
 * message, otherwise a message for the HTTP status.
 */
export function serverMessage(body: { code?: string; message?: string; params?: Params; errors?: Record<string, string[]> } | null | undefined, status?: number): string {
  const code = body?.code
  if (code === 'VALIDATION_FAILED') return t('common.errors.validation', { fields: body?.params?.fields ?? '' })
  if (code && code !== 'UNKNOWN' && lookup(current, 'server.' + code) !== undefined) return t('server.' + code, body?.params)
  if (body?.message) return body.message
  if (body?.errors) return Object.values(body.errors).flat().join(' ')
  const byStatus = status ? `common.errors.http${status}` : ''
  return status && lookup(current, byStatus) !== undefined ? t(byStatus) : t('common.errors.requestFailed', { status: status ?? '' })
}

/**
 * English text the server sent outside an error (for example an extraction warning stored with a result) shown in the
 * user's language, when it is a catalogued server message; any other text is returned unchanged.
 */
let reverse: { exact: Map<string, string>; templates: { code: string; pattern: RegExp; names: string[] }[] } | undefined
export function localizeServerText(text: string | null | undefined): string {
  if (!text) return ''
  if (current === 'en') return text
  if (!reverse) {
    reverse = { exact: new Map(), templates: [] }
    for (const [key, english_] of Object.entries(english)) {
      if (!key.startsWith('server.')) continue
      const code = key.slice(7), names = [...english_.matchAll(/\{(\w+)\}/g)].map(m => m[1])
      if (names.length === 0) { reverse.exact.set(english_, code); continue }
      const pattern = '^' + english_.split(/\{\w+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'
      reverse.templates.push({ code, pattern: new RegExp(pattern, 's'), names })
    }
  }
  const trimmed = text.trim(), exact = reverse.exact.get(trimmed)
  if (exact) return t('server.' + exact)
  for (const { code, pattern, names } of reverse.templates) {
    const match = trimmed.match(pattern)
    if (match) return t('server.' + code, Object.fromEntries(names.map((n, i) => [n, match[i + 1]])))
  }
  return text
}

type Context = { language: Language; dir: 'ltr' | 'rtl'; t: (key: string, params?: Params) => string; setLanguage: (language: Language) => void }
const I18nContext = createContext<Context>({ language: 'en', dir: 'ltr', t: (key, params) => t(key, params, 'en'), setLanguage: () => {} })

/** Wrap the app once; children re-render in the new language when it changes. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(() => { const first = initialLanguage(); return loaded[first] ? first : 'en' })
  const apply = useCallback((next: Language) => {
    current = next
    const dir = languages.find(l => l.code === next)!.dir
    document.documentElement.lang = next; document.documentElement.dir = dir
    dayjs.locale(next === 'pt' ? 'pt-br' : next === 'en' ? 'en-gb' : next)
    setState(next)
  }, [])
  const setLanguage = useCallback((next: Language) => {
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* storage unavailable */ }
    void load(next).then(() => apply(next))
  }, [apply])
  // The saved/browser language may need its texts loaded first; English shows meanwhile.
  useEffect(() => { const first = initialLanguage(); if (first !== 'en') void load(first).then(() => apply(first)); else apply('en') }, [apply])
  const value = useMemo<Context>(() => ({ language, dir: languages.find(l => l.code === language)!.dir, t: (key, params) => t(key, params, language), setLanguage }), [language, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** In components: const { t } = useT(); t('common.save') */
export const useT = () => useContext(I18nContext)

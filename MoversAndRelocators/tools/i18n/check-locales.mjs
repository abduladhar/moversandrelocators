// Checks the client translations.
//   node tools/i18n/check-locales.mjs            all namespaces
//   node tools/i18n/check-locales.mjs sales pickups   only these namespaces
// Reports: invalid JSON, keys missing in a language, placeholders that differ from English, keys a language has that
// English does not, and t('ns.key') calls in src/ whose key is not in English. Exit code 1 when anything is wrong.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const localeDir = path.join(root, 'frontend/src/i18n/locales')
const srcDir = path.join(root, 'frontend/src')
const languages = ['en', 'ar', 'tr', 'es', 'fr', 'pt']
const only = process.argv.slice(2)
const plural = /_(zero|one|two|few|many|other)$/
const problems = []

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = String(v)
  }
  return out
}
function read(language, ns) {
  const file = path.join(localeDir, language, ns + '.json')
  if (!fs.existsSync(file)) return null
  try { return flatten(JSON.parse(fs.readFileSync(file, 'utf8'))) } catch (e) { problems.push(`${language}/${ns}.json: invalid JSON (${e.message})`); return {} }
}
const holes = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

const namespaces = fs.readdirSync(path.join(localeDir, 'en')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  .filter(ns => only.length === 0 || only.includes(ns))
const english = {}
for (const ns of namespaces) {
  const en = read('en', ns) ?? {}
  for (const [k, v] of Object.entries(en)) english[`${ns}.${k}`] = v
  // Base keys: plural families count once; a language may use a different set of forms but must have _other.
  const bases = new Map()
  for (const k of Object.keys(en)) bases.set(k.replace(plural, ''), plural.test(k))
  for (const language of languages.slice(1)) {
    const dict = read(language, ns)
    if (!dict) { problems.push(`${language}/${ns}.json is missing`); continue }
    for (const [base, isPlural] of bases) {
      const enText = isPlural ? en[base + '_other'] : en[base]
      const variants = isPlural ? Object.keys(dict).filter(k => k.replace(plural, '') === base && plural.test(k)) : (base in dict ? [base] : [])
      if (variants.length === 0 || (isPlural && !(base + '_other' in dict))) { problems.push(`${language}/${ns}: missing ${base}${isPlural ? '_other' : ''}`); continue }
      for (const v of variants) {
        const want = holes(enText ?? '').split(',').filter(Boolean), got = holes(dict[v]).split(',').filter(Boolean)
        // Plural forms may drop {count} (e.g. Arabic "item" for one), but must not invent placeholders.
        const missing = want.filter(h => !got.includes(h) && !(isPlural && h === 'count')), extra = got.filter(h => !want.includes(h))
        if (missing.length || extra.length) problems.push(`${language}/${ns}: ${v} placeholders differ (english {${want}} vs {${got}})`)
      }
    }
    for (const k of Object.keys(dict)) if (!bases.has(k.replace(plural, ''))) problems.push(`${language}/${ns}: extra key ${k} (not in English)`)
  }
}

// Keys used in code: t('ns.key') / t("ns.key") with a literal key.
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(dir, e.name)] : [])
}
const known = new Set(Object.keys(english).map(k => k.replace(plural, '')))
for (const file of files(srcDir)) {
  const text = fs.readFileSync(file, 'utf8')
  // Literal keys only; a key built at runtime ('shared.movement.' + value) ends with a dot and is skipped.
  for (const m of text.matchAll(/\b(?:t|tr|translate)\(\s*['"]([a-zA-Z][\w]*)\.([\w.]*\w)['"]/g)) {
    const [ns, key] = [m[1], m[2]]
    if (only.length && !only.includes(ns)) continue
    if (!fs.existsSync(path.join(localeDir, 'en', ns + '.json'))) { problems.push(`${path.relative(root, file)}: t('${ns}.${key}') — no namespace ${ns}`); continue }
    if (!known.has(`${ns}.${key}`)) problems.push(`${path.relative(root, file)}: t('${ns}.${key}') is not in en/${ns}.json`)
  }
}

if (problems.length) { console.log(problems.join('\n')); console.log(`\n${problems.length} problem(s).`); process.exit(1) }
console.log(`Translations OK: ${namespaces.length} namespace(s), ${Object.keys(english).length} English texts, ${languages.length} languages.`)

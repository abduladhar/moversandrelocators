// Builds the server message catalog: every user-facing message the API can send, keyed by a stable code.
//
//   node tools/i18n/extract-server-messages.mjs          rewrite the catalog (keeps existing codes)
//   node tools/i18n/extract-server-messages.mjs --check  fail if the catalog is out of date (CI)
//
// Sources scanned in backend/src: the text given to `throw new …Exception(…)` (plain, interpolated $"…{x}…",
// and `value + " text"` joins), `message = "…"` in controllers, and string constants named *Message.
// Output (same content, two places):
//   backend/src/Movers.Api/Localization/server-messages.json  code -> English template, used by the API to tag responses
//   frontend/src/i18n/locales/en/server.json                   the English texts the client translates from
// Templates use {name} placeholders; the API sends the values as params.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const backendCatalog = path.join(root, 'backend/src/Movers.Api/Localization/server-messages.json')
const frontendCatalog = path.join(root, 'frontend/src/i18n/locales/en/server.json')
const check = process.argv.includes('--check')

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name)
    // Localization/ sets its own codes (VALIDATION_FAILED); bin/obj are build output.
    if (e.isDirectory()) return ['bin', 'obj', 'Localization'].includes(e.name) ? [] : files(full)
    return e.name.endsWith('.cs') ? [full] : []
  })
}

/** Reads a C# string literal starting at i (" or $"); returns { text, holes, end } or null for verbatim/raw strings. */
function literal(src, i) {
  const interpolated = src[i] === '$'
  let j = interpolated ? i + 2 : i + 1
  if (src[j - 1] !== '"' || src[j] === '"' && src[j + 1] === '"') return null // raw """ strings are not messages
  let text = '', holes = []
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { const n = src[j + 1]; text += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue }
    if (c === '"') return { text, holes, end: j + 1 }
    if (interpolated && c === '{') {
      if (src[j + 1] === '{') { text += '{'; j += 2; continue }
      // Hole: balance braces/parens and skip nested strings.
      let depth = 1, k = j + 1, expr = ''
      while (k < src.length && depth > 0) {
        const d = src[k]
        if (d === '"') { const inner = literal(src, k); if (!inner) return null; expr += src.slice(k, inner.end); k = inner.end; continue }
        if (d === '{' || d === '(') depth++
        if (d === '}' || d === ')') depth--
        if (depth > 0) expr += d
        k++
      }
      const name = holeName(expr, holes)
      holes.push(name); text += `{${name}}`; j = k; continue
    }
    if (interpolated && c === '}' && src[j + 1] === '}') { text += '}'; j += 2; continue }
    text += c; j++
  }
  return null
}

function holeName(expr, taken) {
  // Drop call arguments and formatting calls: previous.Value.ToString("u") -> previous.Value, kind.Replace('-', ' ') -> kind.
  let plain = expr.trim()
  if (!/^\(/.test(plain)) plain = plain.split(/:(?![^(]*\))/)[0].trim()
  plain = plain.replace(/\((?:[^()]|\([^()]*\))*\)/g, '').replace(/(\.(ToString|Replace|Trim|ToLowerInvariant|ToUpperInvariant|ToLower|ToUpper|Value))+$/, '')
  let name = /^[A-Za-z_][\w.]*$/.test(plain) ? plain.split('.').pop() : 'value'
  if (/^\(.*\)$/.test(expr.trim())) name = 'value'
  name = name[0].toLowerCase() + name.slice(1)
  let unique = name, n = 2
  while (taken.includes(unique)) unique = name + n++
  return unique
}

/** End of the call starting at an opening parenthesis (balanced, strings skipped). */
function callEnd(src, open) {
  let depth = 0
  for (let k = open; k < src.length; k++) {
    const c = src[k]
    if (c === '"' || (c === '$' && src[k + 1] === '"')) { const l = literal(src, k); if (l) { k = l.end - 1; continue } }
    if (c === '(') depth++
    if (c === ')' && --depth === 0) return k
  }
  return src.length
}

const isMessage = t => t.trim().length >= 8 && /\s/.test(t.trim()) && !/^[\w.]+$/.test(t) && !t.includes('/api/')

function messagesIn(src) {
  const found = []
  const add = (text) => { const t = text.trim(); if (isMessage(t)) found.push(t) }
  // A joined message such as `label + " is required (maximum " + max + " characters)."` becomes one template
  // "{label} is required (maximum {max} characters)."; the values between the literals become placeholders.
  // A value between literals: a member chain with calls, e.g. previous.Value.ToString("u") or kind.Replace('-', ' ').
  const operand = /^\s*([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*|\((?:[^()"']|"[^"]*"|'[^']*'|\([^()]*\))*\))*)\s*/
  const literalsIn = (start, end) => {
    for (let k = start; k < end; k++) {
      if (src[k] === '"' || (src[k] === '$' && src[k + 1] === '"')) {
        const l = literal(src, k); if (!l) continue
        const holes = [...l.holes]
        let text = l.text
        const before = src.slice(Math.max(start, k - 80), k).match(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\((?:[^()]|\([^()]*\))*\))*)\s*\+\s*$/)
        if (before) { const name = holeName(before[1], holes); holes.push(name); text = `{${name}}` + text }
        let at = l.end
        for (;;) {
          const plus = src.slice(at).match(/^\s*\+\s*/); if (!plus) break
          const next = at + plus[0].length
          if (src[next] === '"' || (src[next] === '$' && src[next + 1] === '"')) {
            const more = literal(src, next); if (!more) break
            text += more.text.replace(/\{(\w+)\}/g, (_, h) => { const n = holeName(h, holes); holes.push(n); return `{${n}}` }); at = more.end; continue
          }
          const value = src.slice(next).match(operand); if (!value) break
          const name = holeName(value[1], holes); holes.push(name); text += `{${name}}`; at = next + value[0].length
        }
        add(text)
        k = at - 1
      }
    }
  }
  for (const m of src.matchAll(/throw new \w*Exception\(/g)) literalsIn(m.index + m[0].length - 1, callEnd(src, m.index + m[0].length - 1))
  // message = "…" (error bodies) and warning = "…" (warnings stored with a result, shown via localizeServerText).
  for (const m of src.matchAll(/\b(?:message|warning)\s*=\s*(?=\$?")/g)) { const l = literal(src, m.index + m[0].length); if (l) add(l.text) }
  for (const m of src.matchAll(/const string \w*Message\s*=\s*(?=\$?")/g)) { const l = literal(src, m.index + m[0].length); if (l) add(l.text) }
  return found
}

const texts = [...new Set(files(path.join(root, 'backend/src')).flatMap(f => messagesIn(fs.readFileSync(f, 'utf8'))))].sort()

// Keep the codes already given out, so a message keeps its code (and its translations) across runs.
const previous = fs.existsSync(backendCatalog) ? JSON.parse(fs.readFileSync(backendCatalog, 'utf8')) : {}
const codeOf = new Map(Object.entries(previous).map(([code, text]) => [text, code]))
// Codes of messages that no longer exist are free again, so a corrected message keeps its natural code.
const used = new Set(texts.filter(t => codeOf.has(t)).map(t => codeOf.get(t)))
const stop = new Set(['A', 'AN', 'THE', 'THIS', 'THAT', 'IS', 'ARE', 'BE', 'OF', 'TO', 'FOR', 'AND', 'OR', 'IN', 'ON', 'IT', 'BY', 'WITH', 'AT', 'AS'])
function newCode(text) {
  const words = text.replace(/\{[^}]*\}/g, ' ').toUpperCase().match(/[A-Z0-9]+/g) ?? ['MESSAGE']
  const key = words.filter(w => !stop.has(w)).slice(0, 6).join('_') || 'MESSAGE'
  let code = key, n = 2
  while (used.has(code)) code = `${key}_${n++}`
  used.add(code); return code
}
const catalog = {}
for (const text of texts) catalog[codeOf.get(text) ?? newCode(text)] = text
const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)))
const json = JSON.stringify(sorted, null, 2) + '\n'

if (check) {
  const current = fs.existsSync(backendCatalog) ? fs.readFileSync(backendCatalog, 'utf8') : ''
  if (current.replace(/\r\n/g, '\n') !== json) { console.error('Server message catalog is out of date: run node tools/i18n/extract-server-messages.mjs'); process.exit(1) }
  console.log(`Server message catalog is up to date (${texts.length} messages).`)
} else {
  for (const file of [backendCatalog, frontendCatalog]) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, json) }
  const added = texts.filter(t => !codeOf.has(t)).length, removed = Object.values(previous).filter(t => !texts.includes(t)).length
  console.log(`${texts.length} server messages (${added} new, ${removed} removed) written to the API and the client.`)
}

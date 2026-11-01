// Design system check: screens take colours from the tokens (src/theme.ts, --cw-* in styles.css), not from raw hex
// values in inline styles. Run: node tests/design-tokens.test.mjs
// Allowed: the report designer and print previews (they imitate paper), and white/near-white paper surfaces.
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../src')
const skip = /[\\/]reportingV2[\\/]/
const paper = /^#(fff|ffffff|e3e8ef)$/i
const problems = []
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx') && !skip.test(p)) check(p) } }
const check = file => fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
  for (const style of line.matchAll(/style=\{\{([^}]*)\}\}/g))
    for (const hex of style[1].matchAll(/#[0-9a-fA-F]{3,8}\b/g))
      if (!paper.test(hex[0])) problems.push(`${path.relative(root, file)}:${i + 1} ${hex[0]} — use a token (var(--cw-…) or tokens from theme.ts)`)
})
walk(root)
if (problems.length) { console.error(problems.join('\n')); console.error(`\n${problems.length} raw colour(s) in inline styles.`); process.exit(1) }
console.log('Design tokens OK: no raw colours in inline styles.')

import { Fragment, type ReactNode } from 'react'

/**
 * Renders the assistant's Markdown answer as React elements (never as HTML, so nothing in an answer can run).
 * Supports headings, paragraphs, bullet and numbered lists, tables, code, bold / italic and links. A link to
 * "open:<list>/<number>" opens that record's list in the app; http(s) links open in a new tab; anything else is text.
 */
export function AssistantMarkdown({ text, onOpen }: { text: string; onOpen: (list: string, query: string) => void }) {
  return <div className="assistant-md" dir="auto">{blocks(text.replace(/\r\n/g, '\n'), onOpen)}</div>
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line)
const isDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())

function blocks(source: string, onOpen: (list: string, query: string) => void): ReactNode[] {
  const lines = source.split('\n'), out: ReactNode[] = []
  let i = 0
  const inl = (s: string) => inline(s, onOpen)
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (line.trim().startsWith('```')) {
      const body: string[] = []; i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      i++; out.push(<pre key={out.length}><code>{body.join('\n')}</code></pre>); continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) { const Tag = heading[1].length <= 2 ? 'h3' : 'h4'; out.push(<Tag key={out.length}>{inl(heading[2])}</Tag>); i++; continue }
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line); const rows: string[][] = []; i += 2
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]))
      // Numbers line up on the right.
      const numeric = head.map((_, c) => rows.length > 0 && rows.every(r => !r[c] || /^[-+]?[\d.,\s%]+[A-Z]{0,3}$|^[A-Z]{3}\s?[-+]?[\d.,]+$/.test(r[c])))
      out.push(<div key={out.length} className="assistant-table"><table><thead><tr>{head.map((h, c) => <th key={c} className={numeric[c] ? 'is-num' : undefined}>{inl(h)}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{head.map((_, c) => <td key={c} className={numeric[c] ? 'is-num' : undefined}>{inl(r[c] ?? '')}</td>)}</tr>)}</tbody></table></div>)
      continue
    }
    if (/^\s*([-*•])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line); const items: string[] = []
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*([-*•])\s+/).test(lines[i])) {
        let item = lines[i++].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*([-*•])\s+/, '')
        // Indented continuation lines belong to the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) item += ' ' + lines[i++].trim()
        items.push(item)
      }
      const List = ordered ? 'ol' : 'ul'
      out.push(<List key={out.length}>{items.map((item, n) => <li key={n}>{inl(item)}</li>)}</List>); continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) && !lines[i].trim().startsWith('```') && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !(isTableRow(lines[i]) && isDivider(lines[i + 1] ?? ''))) para.push(lines[i++])
    out.push(<p key={out.length}>{para.map((l, n) => <Fragment key={n}>{n > 0 && <br />}{inl(l)}</Fragment>)}</p>)
  }
  return out
}

const TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)/

function inline(text: string, onOpen: (list: string, query: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  while (rest) {
    const m = TOKEN.exec(rest)
    if (!m) { out.push(rest); break }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    const token = m[0], key = out.length
    if (m[1]) out.push(<code key={key}>{token.slice(1, -1)}</code>)
    else if (m[2] || m[3]) out.push(<strong key={key}>{inline(token.slice(2, -2), onOpen)}</strong>)
    else if (m[4]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!
      const open = /^open:([a-z-]+)\/(.+)$/.exec(href)
      if (open) out.push(<button key={key} type="button" className="assistant-link" onClick={() => onOpen(open[1], decodeURIComponent(open[2]))}>{label}</button>)
      else if (/^https?:\/\//.test(href)) out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)
      else out.push(label)
    }
    else out.push(<em key={key}>{inline(token.slice(1, -1), onOpen)}</em>)
    rest = rest.slice(m.index + token.length)
  }
  return out
}

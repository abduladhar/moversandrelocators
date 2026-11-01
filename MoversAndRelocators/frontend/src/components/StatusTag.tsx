import type { ReactNode } from 'react'
import { useT } from '../i18n'

/** The five status meanings used across Crateway. Each has one look everywhere (see --cw-* tokens in styles.css). */
export type StatusMeaning = 'neutral' | 'progress' | 'done' | 'attention' | 'problem'

const PRESETS: Record<string, StatusMeaning> = {
  default: 'neutral', grey: 'neutral', gray: 'neutral',
  blue: 'progress', geekblue: 'progress', cyan: 'progress', processing: 'progress', purple: 'progress',
  green: 'done', lime: 'done', success: 'done',
  gold: 'attention', orange: 'attention', yellow: 'attention', warning: 'attention',
  red: 'problem', volcano: 'problem', magenta: 'problem', pink: 'problem', error: 'problem',
}

/** Status colours come from code (Ant Design preset names) or from status masters, where users may pick any hex colour;
 * both map to a meaning so the same idea always looks the same. */
export function statusMeaning(color?: string | null): StatusMeaning {
  if (!color) return 'neutral'
  const preset = PRESETS[color.toLowerCase()]
  if (preset) return preset
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim())?.[1]
  if (!hex) return 'neutral'
  const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d < 0.15) return 'neutral'
  const hue = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60
  const h = (hue + 360) % 360
  return h < 20 || h >= 330 ? 'problem' : h < 65 ? 'attention' : h < 170 ? 'done' : 'progress'
}

type Props = { active: boolean } | { color?: string | null; meaning?: StatusMeaning; children: ReactNode }

/** A status shown as a coloured dot and its label; readable in tables, tiles and print.
 * `<StatusTag active={…} />` is the Active / Inactive badge used by master and admin lists. */
export function StatusTag(props: Props) {
  const { t } = useT()
  if ('active' in props) return <span className={'status-tag is-' + (props.active ? 'done' : 'neutral')}>{t(props.active ? 'common.active' : 'common.inactive')}</span>
  return <span className={'status-tag is-' + (props.meaning ?? statusMeaning(props.color))}>{props.children}</span>
}

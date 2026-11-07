import { useEffect, useRef, useState } from 'react'
import { Typography } from 'antd'
import { useT, type Language } from '../i18n'

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<Turnstile> | null = null
/** Loads Cloudflare's Turnstile script once, only on pages that show a captcha. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptUrl; script.async = true; script.defer = true
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load'))
    script.onerror = () => { loading = null; reject(new Error('Turnstile did not load')) }
    document.head.appendChild(script)
  })
}
const turnstileLanguage: Record<Language, string> = { en: 'en', ar: 'ar', tr: 'tr', es: 'es', fr: 'fr', pt: 'pt-br' }

/**
 * "Are you a person?" check (Cloudflare Turnstile) as a form control: value is the token Cloudflare gives once the
 * visitor passes, cleared again when it expires. The server checks the token; each one works only once, so remount
 * (change the React key) after a failed send.
 */
export function CaptchaWidget({ siteKey, value, onChange }: { siteKey: string; value?: string | null; onChange?: (token: string | null) => void }) {
  const { t, language } = useT()
  const box = useRef<HTMLDivElement>(null), change = useRef(onChange)
  const [failed, setFailed] = useState(false)
  change.current = onChange
  useEffect(() => {
    let widget: string | undefined, gone = false
    loadTurnstile().then(turnstile => {
      if (gone || !box.current) return
      widget = turnstile.render(box.current, { sitekey: siteKey, language: turnstileLanguage[language], theme: 'light', size: 'flexible',
        callback: (token: string) => { setFailed(false); change.current?.(token) },
        'expired-callback': () => change.current?.(null),
        'error-callback': () => { setFailed(true); change.current?.(null) } })
    }).catch(() => setFailed(true))
    return () => { gone = true; if (widget) window.turnstile?.remove(widget) }
  }, [siteKey, language])
  return <div className="captcha-widget" data-passed={value ? 'true' : undefined}>
    <div ref={box} />
    {failed && <Typography.Text type="danger">{t('customer.leadForm.captchaFailed')}</Typography.Text>}
  </div>
}

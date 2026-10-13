import { useId } from 'react'
import { useT } from '../i18n'

/** Product name shown in the app (sign-in, sidebar, browser tab). */
export const PRODUCT_NAME = 'Crateway'

/** Small "Powered by Crateway" line for customer-facing link pages (uploads, quotations, confirmations). */
export function PoweredBy() {
  const { t } = useT()
  // Pinned to the bottom of the screen; the spacer keeps it from covering the last buttons of the page.
  return <><div className="powered-by-space" aria-hidden="true" /><div className="powered-by" aria-label={t('shell.brand.poweredByLabel', { product: PRODUCT_NAME })}><span>{t('shell.brand.poweredBy')}</span><BrandMark size={18} /><b>crateway</b></div></>
}

/** Crateway mark: a slatted crate above a forward arrow, the "way" (same artwork as public/crateway-mark.svg). */
export function BrandMark({ size = 36 }: { size?: number }) {
  const id = 'cw' + useId().replace(/:/g, '')
  return <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" focusable="false">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f8a68" /><stop offset="1" stopColor="#0f4a39" /></linearGradient></defs>
    <rect width="72" height="72" rx="18" fill={`url(#${id})`} />
    <path d="M16 22 L36 13 L56 22 L36 31 Z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    <path d="M16 22 V41 L36 50 L56 41 V22 M36 31 V50" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
    <path d="M16 31.5 L36 40.5 L56 31.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" opacity=".8" />
    <path d="M16 61 H55 M49 55 L55 61 L49 67" fill="none" stroke="#e0b84a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

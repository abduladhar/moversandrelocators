import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Button } from 'antd'
import { ClearOutlined } from '@ant-design/icons'
import { useT } from '../i18n'

export type SignaturePadHandle = { toDataUrl: () => string | null; clear: () => void }

/** Finger, stylus or mouse signature capture. Exports a trimmed-width PNG data URL, or null when nothing was drawn. */
export const SignaturePad = forwardRef<SignaturePadHandle, { label?: string }>(function SignaturePad({ label: labelProp }, ref) {
  const { t } = useT(), label = labelProp ?? t('customer.signature.signHere')
  const canvas = useRef<HTMLCanvasElement>(null), drawing = useRef(false), last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  // Match the backing store to the rendered size (and pixel ratio) so strokes are crisp and land under the pointer.
  useEffect(() => {
    const el = canvas.current; if (!el) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2), rect = el.getBoundingClientRect()
    el.width = Math.round(rect.width * ratio); el.height = Math.round(rect.height * ratio)
    const ctx = el.getContext('2d'); if (!ctx) return
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10241b'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; last.current = point(e) }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return
    const next = point(e); ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(next.x, next.y); ctx.stroke()
    last.current = next; if (empty) setEmpty(false)
  }
  const up = () => { drawing.current = false; last.current = null }
  const clear = () => { const el = canvas.current; const ctx = el?.getContext('2d'); if (el && ctx) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, el.width, el.height); ctx.restore() } setEmpty(true) }

  useImperativeHandle(ref, () => ({
    clear,
    toDataUrl: () => {
      const el = canvas.current; if (!el || empty) return null
      // Store at most 600px wide on a white background to keep the record small.
      const scale = Math.min(1, 600 / el.width), out = document.createElement('canvas')
      out.width = Math.round(el.width * scale); out.height = Math.round(el.height * scale)
      const ctx = out.getContext('2d'); if (!ctx) return null
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(el, 0, 0, out.width, out.height)
      return out.toDataURL('image/png')
    },
  }), [empty])

  return <div className="signature-pad">
    <canvas ref={canvas} aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
    {empty && <span className="signature-pad-hint">{label}</span>}
    <div className="signature-pad-line" />
    <Button size="small" type="text" icon={<ClearOutlined />} className="signature-pad-clear" onClick={clear} disabled={empty}>{t('common.clear')}</Button>
  </div>
})

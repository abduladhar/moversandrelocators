import { useState } from 'react'
import { Modal } from 'antd'
import { useT } from '../i18n'

/** Where an item is in its picture: thousandths (0–1000) of the picture's width and height, from the top-left corner. */
export type PictureMark = { x: number; y: number; width: number; height: number }

/**
 * An inventory item's picture. A video frame often shows several items, so when the AI marked the item the thumbnail
 * zooms into that area and the enlarged view outlines it on the whole frame (the mark is the AI's estimate).
 */
export function ItemPicture({ src, mark, alt, size = 44 }: { src: string; mark?: PictureMark | null; alt: string; size?: number }) {
  const { t } = useT()
  const [open, setOpen] = useState(false), [crop, setCrop] = useState<React.CSSProperties>()
  // Square crop around the marked item (with some margin), scaled to the thumbnail; without a mark the picture is just cover-fitted.
  const loaded = (img: HTMLImageElement) => {
    if (!mark || !img.naturalWidth) return
    const w = img.naturalWidth, h = img.naturalHeight
    const cx = (mark.x + mark.width / 2) / 1000 * w, cy = (mark.y + mark.height / 2) / 1000 * h
    const side = Math.min(Math.max(mark.width / 1000 * w, mark.height / 1000 * h) * 1.25, w, h)
    const left = Math.min(Math.max(cx - side / 2, 0), w - side), top = Math.min(Math.max(cy - side / 2, 0), h - side)
    const scale = size / side
    setCrop({ position: 'absolute', width: w * scale, height: h * scale, left: -left * scale, top: -top * scale, maxWidth: 'none' })
  }
  const pct = (v: number) => v / 10 + '%'
  return <>
    <button type="button" className="item-picture" style={{ width: size, height: size }} title={mark ? t('sales.itemPicture.showMark') : t('sales.itemPicture.show')} onClick={() => setOpen(true)}>
      <img src={src} alt={alt} onLoad={e => loaded(e.currentTarget)} style={crop ?? { width: '100%', height: '100%', objectFit: 'cover' }} />
    </button>
    <Modal centered width={900} open={open} onCancel={() => setOpen(false)} footer={null} title={alt}>
      <div className="item-picture-full">
        <img src={src} alt={alt} />
        {mark && <span className="item-picture-mark" style={{ left: pct(mark.x), top: pct(mark.y), width: pct(mark.width), height: pct(mark.height) }}><b>{alt}</b></span>}
      </div>
      {mark && <p className="item-picture-hint">{t('sales.itemPicture.markHint')}</p>}
    </Modal>
  </>
}

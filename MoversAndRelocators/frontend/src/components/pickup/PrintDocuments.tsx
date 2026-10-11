import {ReportPrintButton} from '../../reportingV2/ReportPrintButton'
import {formatMoney,useCurrencies} from '../../currency'
import type { ReactNode } from 'react'
import { Button, Modal, QRCode } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import type { PickupDetail, PickupPackage } from '../../types'

const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const belowThousand = (n: number): string => [n >= 100 ? `${ones[Math.floor(n / 100)]} hundred` : '', n % 100 < 20 ? ones[n % 100] : `${tens[Math.floor(n % 100 / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`].filter(Boolean).join(' ')
/** Whole-number amount in words; INR uses lakh/crore grouping, other currencies thousand/million. */
export function amountInWords(amount: number, currency: string) {
  const whole = Math.floor(amount), cents = Math.round((amount - whole) * 100)
  const groups: [number, string][] = currency === 'INR' ? [[10_000_000, 'crore'], [100_000, 'lakh'], [1000, 'thousand']] : [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1000, 'thousand']]
  let rest = whole; const parts: string[] = []
  for (const [size, name] of groups) if (rest >= size) { parts.push(`${amountInWordsBelow(Math.floor(rest / size), currency)} ${name}`); rest %= size }
  if (rest) parts.push(belowThousand(rest))
  const words = parts.length ? parts.join(' ') : 'zero'
  return `${words[0].toUpperCase()}${words.slice(1)}${cents ? ` and ${cents}/100` : ''} only`
}
const amountInWordsBelow = (n: number, currency: string) => n < 1000 ? belowThousand(n) : amountInWords(n, currency).replace(/ only$/, '').toLowerCase()

/** Modal preview of a print-ready document; printing hides the rest of the app (see .printable-doc print CSS). */
export function PrintPreview({ open, title, onClose, children, wide, print }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean; print: { type: string; id: string; query?: Record<string, string> } }) {
  return <Modal centered open={open} title={title} width={wide ? 980 : 720} onCancel={onClose} destroyOnHidden
    footer={[<Button key="close" onClick={onClose}>Close</Button>, <ReportPrintButton key="print" type={print.type} title={title} id={print.id} query={print.query}/>]}>
    <div className="printable-doc">{children}</div>
  </Modal>
}

type Transaction = PickupDetail['transactions'][number]

export function PaymentReceipt({ companyName, detail, payment, currency, receivedBy }: { companyName: string; detail: PickupDetail; payment: Transaction; currency: string; receivedBy: string }) {
  const {data:currencyData}=useCurrencies()
  currency=payment.currency||currency
  const p = detail.pickup, totalCollected = detail.transactions.filter(x => x.type === 'INCOME'&&(x.currency||currency)===currency).reduce((sum, x) => sum + x.amount, 0)
  const amount = formatMoney(payment.amount,currency)
  return <article className="doc-receipt">
    <header><div className="doc-brand"><span>{companyName.charAt(0).toUpperCase()}</span><div><strong>{companyName}</strong><small>Packing &amp; relocation services</small></div></div>
      <div className="doc-title"><h1>Payment receipt</h1><dl><div><dt>Receipt no.</dt><dd>{payment.transactionNumber}</dd></div><div><dt>Date</dt><dd>{new Date(payment.createdAtUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></div></dl></div></header>
    <section className="doc-parties">
      <div><small>Received from</small><strong>{p.customerName}</strong><span>{p.phone}{p.email ? ` · ${p.email}` : ''}</span><span>{p.address}</span></div>
      <div><small>Against</small><strong>Pickup {p.pickupNumber}</strong>{p.quotationNumber && <span>Quotation {p.quotationNumber}</span>}{p.leadNumber && <span>Lead {p.leadNumber}</span>}</div>
    </section>
    <section className="doc-amount"><small>Amount received</small><strong>{amount}</strong><span>{formatMoney(payment.baseAmount,currencyData?.baseCurrency||"USD")}</span></section>
    <table className="doc-table"><tbody>
      <tr><th>Payment for</th><td>{payment.category}</td></tr>
      <tr><th>Payment method</th><td>{payment.paymentMethod}</td></tr>
      {payment.notes && <tr><th>Reference / notes</th><td>{payment.notes}</td></tr>}
      <tr><th>Total collected in this currency</th><td>{formatMoney(totalCollected,currency)}</td></tr>
    </tbody></table>
    <footer className="doc-signatures"><div><span /><small>Received by · {receivedBy}</small></div><div><span /><small>Customer signature</small></div></footer>
    <p className="doc-note">This is a computer-generated receipt for the amount stated above. Please retain it for your records.</p>
  </article>
}

export function BoxLabels({ companyName, detail, packages }: { companyName: string; detail: PickupDetail; packages: PickupPackage[] }) {
  const all = detail.packages
  return <div className="doc-labels">{packages.map(box => {
    const index = all.findIndex(x => x.id === box.id) + 1
    const contents = box.items.map(i => `${i.itemName} × ${i.quantity}`).join(', ')
    return <article key={box.id} className="doc-label">
      <header><strong>{companyName}</strong><span>Box {index} of {all.length}</span></header>
      <div className="doc-label-main">
        <div><small>Tracking number</small><h2>{box.trackingNumber}</h2><p className="doc-label-customer">{detail.pickup.customerName}</p><p>{detail.pickup.pickupNumber} · {box.boxTypeName}</p></div>
        <QRCode value={box.trackingNumber} size={112} bordered={false} type="canvas" />
      </div>
      <dl><div><dt>Room</dt><dd>{box.roomName ?? '—'}</dd></div><div><dt>From</dt><dd>{detail.pickup.address}</dd></div></dl>
      <div className="doc-label-contents"><small>Contents</small><p>{contents || '—'}</p></div>
      {box.isFragile && <div className="doc-label-fragile">FRAGILE · HANDLE WITH CARE · THIS SIDE UP</div>}
    </article>
  })}</div>
}





import {PartyAmount} from './DualAmount'
import {formatMoney,useCurrencies} from '../currency'
import type { Choices, Doc, DocumentRow, Row, Voucher } from '../billingApi'

const titles:Record<string,string>={INVOICE:'Invoice',BILL:'Supplier bill',RECEIPT:'Payment receipt',PAYMENT:'Payment voucher'}
export function BillingPrintDocument({record,kind,documents,companyName,choices}:{record:Row<Doc>|Row<Voucher>;kind:'document'|'voucher';documents:DocumentRow[];companyName:string;choices:Choices}) {
 const {data:currencyData}=useCurrencies()
 const d=record.details, doc=kind==='document'?d as Doc:undefined, voucher=kind==='voucher'?d as Voucher:undefined
 const amount=(value:number)=>formatMoney(value,d.currency)
 const balance=documents.find(x=>x.id===record.id)
 return <article className="printable-doc billing-print">
 <header className="billing-print-header"><div><div className="billing-print-company">{companyName}</div><p>Movers & relocation services</p></div><div><h1>{titles[d.type]||d.type}</h1><strong>{record.number}</strong></div></header>
 {!record.journalId&&!d.voided&&<div className="billing-print-void">DRAFT — NOT POSTED TO ACCOUNTING</div>}
 {d.voided&&<div className="billing-print-void">VOID / REVERSED — {d.voidReason}</div>}
 <section className="billing-print-parties"><div><h2>{d.type==='INVOICE'?'Bill to':d.type==='BILL'?'Supplier':d.type==='RECEIPT'?'Received from':'Paid to'}</h2><strong>{d.partyName}</strong><p>{d.partyCode}</p>{doc?.address&&<p className="billing-print-text">{doc.address}</p>}</div>
 <dl><div><dt>Date</dt><dd>{d.date}</dd></div>{doc&&<div><dt>Due date</dt><dd>{doc.dueDate}</dd></div>}<div><dt>Currency</dt><dd>{d.currency}</dd></div>{d.reference&&<div><dt>Reference</dt><dd>{d.reference}</dd></div>}{voucher&&<div><dt>Cash / bank account</dt><dd>{voucher.accountCode}</dd></div>}</dl></section>
 <table className="billing-print-lines"><thead><tr><th className="billing-print-index">#</th><th>{doc?'Description':'Invoice / bill'}</th>{doc&&<><th>Source reference</th><th>Qty</th><th className="billing-print-amount">Amount per item</th></>}<th className="billing-print-amount">Amount ({d.currency})</th></tr></thead>
 <tbody>{doc?doc.lines.map((l,i)=><tr key={l.chargeId}><td>{i+1}</td><td className="billing-print-text">{l.description}</td><td>{l.sourceLabel}</td><td>{l.quantity??1}</td><td className="billing-print-amount">{amount(l.unitPrice??l.amount)}</td><td className="billing-print-amount">{amount(l.amount)}</td></tr>):voucher?.allocations.map((a,i)=><tr key={a.documentId}><td>{i+1}</td><td>{documents.find(x=>x.id===a.documentId)?.number||a.documentId} · {formatMoney(a.amount,documents.find(x=>x.id===a.documentId)?.details.currency||d.currency)}</td><td className="billing-print-amount">{amount(a.paymentAmount??a.amount)}</td></tr>)}</tbody></table>
 <section className="billing-print-totals"><dl><div><dt>Base amount</dt><dd>{formatMoney(d.baseAmount,currencyData?.baseCurrency||"USD")}</dd></div><div><dt>{doc?'Document total':'Payment total'}</dt><dd>{amount(d.amount)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData}/></small></dd></div>{doc&&!d.voided&&balance&&<><div><dt>Memo adjustment</dt><dd>{amount(balance.balance+balance.paid-doc.amount)}</dd></div><div><dt>Paid amount</dt><dd>{amount(balance.paid)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData} amount={balance.paid}/></small></dd></div><div className="billing-print-due"><dt>Balance due</dt><dd>{amount(balance.balance)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData} amount={balance.balance}/></small></dd></div></>}</dl></section>
 {d.notes&&<section className="billing-print-notes"><h2>Notes</h2><p className="billing-print-text">{d.notes}</p></section>}
 <footer className="billing-print-footer"><span>{companyName}</span><span>{record.number}</span></footer>
 </article>
}







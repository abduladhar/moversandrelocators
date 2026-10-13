import {PartyAmount} from './DualAmount'
import {formatMoney,useCurrencies} from '../currency'
import type { Choices, Doc, DocumentRow, Row, Voucher } from '../billingApi'
import {has,useT} from '../i18n'

export function BillingPrintDocument({record,kind,documents,companyName,choices}:{record:Row<Doc>|Row<Voucher>;kind:'document'|'voucher';documents:DocumentRow[];companyName:string;choices:Choices}) {
 const {t}=useT()
 const {data:currencyData}=useCurrencies()
 const d=record.details, doc=kind==='document'?d as Doc:undefined, voucher=kind==='voucher'?d as Voucher:undefined
 const amount=(value:number)=>formatMoney(value,d.currency)
 const balance=documents.find(x=>x.id===record.id)
 const title=has('billing.print.titles.'+d.type)?t('billing.print.titles.'+d.type):d.type
 return <article className="printable-doc billing-print">
 <header className="billing-print-header"><div><div className="billing-print-company">{companyName}</div><p>{t('billing.print.tagline')}</p></div><div><h1>{title}</h1><strong>{record.number}</strong></div></header>
 {!record.journalId&&!d.voided&&<div className="billing-print-void">{t('billing.print.draft')}</div>}
 {d.voided&&<div className="billing-print-void">{t('billing.print.voided',{reason:d.voidReason??''})}</div>}
 <section className="billing-print-parties"><div><h2>{d.type==='INVOICE'?t('billing.print.billTo'):d.type==='BILL'?t('billing.print.supplier'):d.type==='RECEIPT'?t('billing.print.receivedFrom'):t('billing.print.paidTo')}</h2><strong>{d.partyName}</strong><p>{d.partyCode}</p>{doc?.address&&<p className="billing-print-text">{doc.address}</p>}</div>
 <dl><div><dt>{t('common.date')}</dt><dd>{d.date}</dd></div>{doc&&<div><dt>{t('billing.columns.dueDate')}</dt><dd>{doc.dueDate}</dd></div>}<div><dt>{t('common.currency')}</dt><dd>{d.currency}</dd></div>{d.reference&&<div><dt>{t('billing.columns.reference')}</dt><dd>{d.reference}</dd></div>}{voucher&&<div><dt>{t('billing.pay.cashBankAccount')}</dt><dd>{voucher.accountCode}</dd></div>}</dl></section>
 <table className="billing-print-lines"><thead><tr><th className="billing-print-index">#</th><th>{doc?t('common.description'):t('billing.print.invoiceOrBill')}</th>{doc&&<><th>{t('billing.print.sourceReference')}</th><th>{t('billing.print.qty')}</th><th className="billing-print-amount">{t('billing.print.amountPerItem')}</th></>}<th className="billing-print-amount">{t('billing.print.amountIn',{currency:d.currency})}</th></tr></thead>
 <tbody>{doc?doc.lines.map((l,i)=><tr key={l.chargeId}><td>{i+1}</td><td className="billing-print-text">{l.description}</td><td>{l.sourceLabel}</td><td>{l.quantity??1}</td><td className="billing-print-amount">{amount(l.unitPrice??l.amount)}</td><td className="billing-print-amount">{amount(l.amount)}</td></tr>):voucher?.allocations.map((a,i)=><tr key={a.documentId}><td>{i+1}</td><td>{documents.find(x=>x.id===a.documentId)?.number||a.documentId} · {formatMoney(a.amount,documents.find(x=>x.id===a.documentId)?.details.currency||d.currency)}</td><td className="billing-print-amount">{amount(a.paymentAmount??a.amount)}</td></tr>)}</tbody></table>
 <section className="billing-print-totals"><dl><div><dt>{t('billing.columns.baseAmount')}</dt><dd>{formatMoney(d.baseAmount,currencyData?.baseCurrency||"USD")}</dd></div><div><dt>{doc?t('billing.print.documentTotal'):t('billing.print.paymentTotal')}</dt><dd>{amount(d.amount)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData}/></small></dd></div>{doc&&!d.voided&&balance&&<><div><dt>{t('billing.columns.memoAdjustment')}</dt><dd>{amount(balance.balance+balance.paid-doc.amount)}</dd></div><div><dt>{t('billing.columns.paidAmount')}</dt><dd>{amount(balance.paid)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData} amount={balance.paid}/></small></dd></div><div className="billing-print-due"><dt>{t('billing.print.balanceDue')}</dt><dd>{amount(balance.balance)}<br/><small><PartyAmount details={d} choices={choices} currencies={currencyData} amount={balance.balance}/></small></dd></div></>}</dl></section>
 {d.notes&&<section className="billing-print-notes"><h2>{t('common.notes')}</h2><p className="billing-print-text">{d.notes}</p></section>}
 <footer className="billing-print-footer"><span>{companyName}</span><span>{record.number}</span></footer>
 </article>
}

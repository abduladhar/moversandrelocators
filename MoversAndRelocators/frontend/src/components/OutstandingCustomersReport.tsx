import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {lastBillingReportQuery,request} from '../api'
import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {has,useT} from '../i18n'
import {DataGrid} from './DataGrid'
/** Days past the due date; 0–30 includes invoices not yet due. */
export const agingBuckets=['days0To30','days31To60','days61To90','days91To120','daysOver120'] as const
type Aging=Record<typeof agingBuckets[number],number>
type Totals={currency:string;invoiceCount:number;current:number;overdue:number;outstanding:number;aging:Aging;customerCount?:number}
type Invoice={id:string;number:string;invoiceDate:string;dueDate:string;daysOverdue:number;transactionCurrency:string;transactionOutstanding:number;currency:string;outstanding:number}
type Row=Totals&{customerCode:string;customerName:string;oldestDueDate:string;invoices:Invoice[]}
type Report={date:string;mode:string;customerCode?:string;rows:Row[];totals:Totals[]}
const buckets=[...agingBuckets,'outstanding'] as const
const amount=(r:Totals,b:typeof buckets[number])=>b==='outstanding'?r.outstanding:r.aging[b]
/** partyCode opens the report for that customer and runs it at once (used from the customer list). */
export function OutstandingCustomersReport({partyCode}:{partyCode?:string}={}){
 const {t}=useT(),k='reports.outstandingCustomers.',labels=buckets.map(b=>b==='outstanding'?t(k+'buckets.outstanding'):t('reports.outstandingAging.'+b))
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string|undefined>(partyCode),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState(partyCode?'CUSTOMER':'BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/outstanding-customers?'+new URLSearchParams({date,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t(k+'loadError'))}finally{setLoading(false)}}
 useEffect(()=>{if(partyCode)void load()},[partyCode])
 const exportCsv=()=>{
  if(!data)return
  const c=(x:string)=>t('reports.columns.'+x)
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.outstandingCustomers'),data.date,data.mode,data.customerCode||t('reports.placeholders.allCustomers')],[c('customerCode'),c('customer'),c('currency'),t(k+'columns.invoices'),c('oldestDueDate'),...labels],...data.rows.map(r=>[r.customerCode,r.customerName,r.currency,r.invoiceCount,r.oldestDueDate,...buckets.map(b=>amount(r,b))]),[],[t('reports.totals.byCurrency'),t(k+'columns.customers'),t(k+'columns.invoices'),...labels],...data.totals.map(x=>[x.currency,x.customerCount,x.invoiceCount,...buckets.map(b=>amount(x,b))]),[],[c('customerCode'),c('invoice'),c('invoiceDate'),c('dueDate'),c('transactionCurrency'),c('transactionOutstanding'),c('reportCurrency'),c('reportOutstanding')],...data.rows.flatMap(r=>r.invoices.map(i=>[r.customerCode,i.number,i.invoiceDate,i.dueDate,i.transactionCurrency,i.transactionOutstanding,i.currency,i.outstanding]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='outstanding-customers.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card variant={partyCode?'borderless':undefined} styles={partyCode?{body:{padding:0}}:undefined} title={partyCode?undefined:t('reports.cardTitle',{number:18,title:t('reports.names.outstandingCustomers')})} extra={partyCode?undefined:<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.customer')}<Select className="accounting-report-select" aria-label={t(k+'ariaCustomer')} allowClear showSearch optionFilterProp="label" placeholder={t('reports.placeholders.allCustomers')} value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t(k+'ariaDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t(k+'ariaCurrency')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},{value:'CUSTOMER',label:t('reports.currencyOptions.eachCustomer')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>{partyCode&&<ReportPrintButton type="ACCOUNTING_17" title={[t('reports.names.outstandingCustomers'),customers.find(c=>c.code===customer)?.name].filter(Boolean).join(' · ')} disabled={!data||loading} query={()=>lastBillingReportQuery('outstanding-customers')}/>}
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t(k+'alertTitle')} description={t(k+'alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.asOf',{date:data.date})} · {data.customerCode||t('reports.placeholders.allCustomers')} · {has('reports.modes.'+data.mode)?t('reports.modes.'+data.mode):data.mode}</p>
 <DataGrid<Row> rowKey={r=>r.customerCode+'|'+r.currency} dataSource={data.rows} scroll={{x:1100}} pagination={{pageSize:25}} expandable={{expandedRowRender:r=><DataGrid<Invoice> rowKey="id" dataSource={r.invoices} pagination={false} scroll={{x:900}} columns={[{title:t('reports.columns.invoice'),dataIndex:'number'},{title:t('reports.columns.invoiceDate'),dataIndex:'invoiceDate'},{title:t('reports.columns.dueDate'),dataIndex:'dueDate'},{title:t('reports.columns.daysOverdue'),dataIndex:'daysOverdue',align:'right'},{title:t('reports.columns.transactionOutstanding'),align:'right',render:(_,i)=>formatMoney(i.transactionOutstanding,i.transactionCurrency)},{title:t('reports.columns.reportOutstanding'),align:'right',render:(_,i)=>formatMoney(i.outstanding,i.currency)}]}/>}} columns={[{title:t('reports.columns.customerCode'),dataIndex:'customerCode'},{title:t('reports.columns.customer'),dataIndex:'customerName'},{title:t(k+'columns.invoices'),dataIndex:'invoiceCount'},{title:t('reports.columns.oldestDueDate'),dataIndex:'oldestDueDate'},...buckets.map((b,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(amount(r,b),r.currency)}))]}/> <h3>{t('reports.totals.byCurrency')}</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},...buckets.map((b,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(amount(r,b),r.currency)}))]}/>
 </>}
 </Card>
}

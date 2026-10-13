import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT,has} from '../i18n'
type Totals={currency:string;current:number;days1To30:number;days31To60:number;days61To90:number;daysOver90:number;outstanding:number}
type Row=Totals&{id:string;number:string;customerCode:string;customerName:string;invoiceDate:string;dueDate:string;daysOverdue:number;transactionCurrency:string;transactionOutstanding:number}
type Report={date:string;mode:string;customerCode?:string;rows:Row[];totals:Totals[]}
const buckets=['current','days1To30','days31To60','days61To90','daysOver90','outstanding'] as const
export function ReceivableAgingReport(){
 const {t}=useT(),labels=buckets.map(k=>t('reports.receivableAging.buckets.'+k)),label=(g:string,v:string)=>has('reports.'+g+'.'+v)?t('reports.'+g+'.'+v):v
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/receivable-aging?'+new URLSearchParams({date,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.receivableAging'),data.date,data.mode,data.customerCode||t('reports.placeholders.allCustomers')],[t('reports.columns.customerCode'),t('reports.columns.customer'),t('reports.columns.invoice'),t('reports.columns.invoiceDate'),t('reports.columns.dueDate'),t('reports.columns.daysOverdue'),t('reports.columns.transactionCurrency'),t('reports.columns.transactionOutstanding'),t('reports.columns.reportCurrency'),...labels],...data.rows.map(r=>[r.customerCode,r.customerName,r.number,r.invoiceDate,r.dueDate,r.daysOverdue,r.transactionCurrency,r.transactionOutstanding,r.currency,...buckets.map(k=>r[k])]),[],[t('reports.totals.byCurrency'),...labels],...data.totals.map(x=>[x.currency,...buckets.map(k=>x[k])])]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='accounts-receivable-aging.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:10,title:t('reports.names.receivableAging')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.customer')}<Select className="accounting-report-select" aria-label={t('reports.receivableAging.ariaCustomer')} allowClear showSearch optionFilterProp="label" placeholder={t('reports.placeholders.allCustomers')} value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t('reports.receivableAging.ariaDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.receivableAging.ariaCurrency')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},{value:'CUSTOMER',label:t('reports.currencyOptions.eachCustomer')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t('reports.receivableAging.alertTitle')} description={t('reports.receivableAging.alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.asOf',{date:data.date})} · {data.customerCode||t('reports.placeholders.allCustomers')} · {label('modes',data.mode)}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} scroll={{x:1800}} pagination={{pageSize:25}} columns={[{title:t('reports.columns.customer'),dataIndex:'customerName'},{title:t('reports.columns.invoice'),dataIndex:'number'},{title:t('reports.columns.invoiceDate'),dataIndex:'invoiceDate'},{title:t('reports.columns.dueDate'),dataIndex:'dueDate'},{title:t('reports.columns.daysOverdue'),dataIndex:'daysOverdue'},{title:t('reports.columns.transactionOutstanding'),align:'right',render:(_,r)=>formatMoney(r.transactionOutstanding,r.transactionCurrency)},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/>
 <h3>{t('reports.totals.byCurrency')}</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}

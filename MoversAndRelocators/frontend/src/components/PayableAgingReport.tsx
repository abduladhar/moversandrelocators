import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT,has} from '../i18n'
type Totals={currency:string;current:number;days1To30:number;days31To60:number;days61To90:number;daysOver90:number;outstanding:number}
type Row=Totals&{id:string;number:string;vendorCode:string;vendorName:string;billDate:string;dueDate:string;daysOverdue:number;transactionCurrency:string;transactionOutstanding:number}
type Report={date:string;mode:string;vendorCode?:string;rows:Row[];totals:Totals[]}
const buckets=['current','days1To30','days31To60','days61To90','daysOver90','outstanding'] as const
export function PayableAgingReport(){
 const {t}=useT(),labels=buckets.map(k=>t('reports.payableAging.buckets.'+k)),label=(g:string,v:string)=>has('reports.'+g+'.'+v)?t('reports.'+g+'.'+v):v
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/payable-aging?'+new URLSearchParams({date,currency,...(vendor?{vendorCode:vendor}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.payableAging'),data.date,data.mode,data.vendorCode||t('reports.placeholders.allVendors')],[t('reports.columns.vendorCode'),t('reports.columns.vendor'),t('reports.columns.bill'),t('reports.columns.billDate'),t('reports.columns.dueDate'),t('reports.columns.daysOverdue'),t('reports.columns.transactionCurrency'),t('reports.columns.transactionOutstanding'),t('reports.columns.reportCurrency'),...labels],...data.rows.map(r=>[r.vendorCode,r.vendorName,r.number,r.billDate,r.dueDate,r.daysOverdue,r.transactionCurrency,r.transactionOutstanding,r.currency,...buckets.map(k=>r[k])]),[],[t('reports.totals.byCurrency'),...labels],...data.totals.map(x=>[x.currency,...buckets.map(k=>x[k])])]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='accounts-payable-aging.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:11,title:t('reports.names.payableAging')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.vendor')}<Select className="accounting-report-select" aria-label={t('reports.payableAging.ariaVendor')} allowClear showSearch optionFilterProp="label" placeholder={t('reports.placeholders.allVendors')} value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t('reports.payableAging.ariaDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.payableAging.ariaCurrency')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},{value:'VENDOR',label:t('reports.currencyOptions.eachVendor')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t('reports.payableAging.alertTitle')} description={t('reports.payableAging.alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.asOf',{date:data.date})} · {data.vendorCode||t('reports.placeholders.allVendors')} · {label('modes',data.mode)}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} scroll={{x:1800}} pagination={{pageSize:25}} columns={[{title:t('reports.columns.vendor'),dataIndex:'vendorName'},{title:t('reports.columns.bill'),dataIndex:'number'},{title:t('reports.columns.billDate'),dataIndex:'billDate'},{title:t('reports.columns.dueDate'),dataIndex:'dueDate'},{title:t('reports.columns.daysOverdue'),dataIndex:'daysOverdue'},{title:t('reports.columns.transactionOutstanding'),align:'right',render:(_,r)=>formatMoney(r.transactionOutstanding,r.transactionCurrency)},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/>
 <h3>{t('reports.totals.byCurrency')}</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}

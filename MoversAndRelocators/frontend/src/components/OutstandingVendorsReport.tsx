import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {has,useT} from '../i18n'
import {DataGrid} from './DataGrid'
type Totals={currency:string;billCount:number;current:number;overdue:number;outstanding:number;vendorCount?:number}
type Bill={id:string;number:string;billDate:string;dueDate:string;transactionCurrency:string;transactionOutstanding:number;currency:string;outstanding:number}
type Row=Totals&{vendorCode:string;vendorName:string;oldestDueDate:string;bills:Bill[]}
type Report={date:string;mode:string;vendorCode?:string;rows:Row[];totals:Totals[]}
const buckets=['current','overdue','outstanding'] as const
export function OutstandingVendorsReport(){
 const {t}=useT(),k='reports.outstandingVendors.',labels=buckets.map(b=>t(k+'buckets.'+b))
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/outstanding-vendors?'+new URLSearchParams({date,currency,...(vendor?{vendorCode:vendor}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t(k+'loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const c=(x:string)=>t('reports.columns.'+x)
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.outstandingVendors'),data.date,data.mode,data.vendorCode||t('reports.placeholders.allVendors')],[c('vendorCode'),c('vendor'),c('currency'),t(k+'columns.bills'),c('oldestDueDate'),...labels],...data.rows.map(r=>[r.vendorCode,r.vendorName,r.currency,r.billCount,r.oldestDueDate,...buckets.map(b=>r[b])]),[],[t('reports.totals.byCurrency'),t(k+'columns.vendors'),t(k+'columns.bills'),...labels],...data.totals.map(x=>[x.currency,x.vendorCount,x.billCount,...buckets.map(b=>x[b])]),[],[c('vendorCode'),c('bill'),c('billDate'),c('dueDate'),c('transactionCurrency'),c('transactionOutstanding'),c('reportCurrency'),c('reportOutstanding')],...data.rows.flatMap(r=>r.bills.map(i=>[r.vendorCode,i.number,i.billDate,i.dueDate,i.transactionCurrency,i.transactionOutstanding,i.currency,i.outstanding]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='outstanding-vendors.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:19,title:t('reports.names.outstandingVendors')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.vendor')}<Select className="accounting-report-select" aria-label={t(k+'ariaVendor')} allowClear showSearch optionFilterProp="label" placeholder={t('reports.placeholders.allVendors')} value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t(k+'ariaDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t(k+'ariaCurrency')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},{value:'VENDOR',label:t('reports.currencyOptions.eachVendor')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t(k+'alertTitle')} description={t(k+'alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.asOf',{date:data.date})} · {data.vendorCode||t('reports.placeholders.allVendors')} · {has('reports.modes.'+data.mode)?t('reports.modes.'+data.mode):data.mode}</p>
 <DataGrid<Row> rowKey={r=>r.vendorCode+'|'+r.currency} dataSource={data.rows} scroll={{x:1100}} pagination={{pageSize:25}} expandable={{expandedRowRender:r=><DataGrid<Bill> rowKey="id" dataSource={r.bills} pagination={false} scroll={{x:900}} columns={[{title:t('reports.columns.bill'),dataIndex:'number'},{title:t('reports.columns.billDate'),dataIndex:'billDate'},{title:t('reports.columns.dueDate'),dataIndex:'dueDate'},{title:t('reports.columns.transactionOutstanding'),align:'right',render:(_,i)=>formatMoney(i.transactionOutstanding,i.transactionCurrency)},{title:t('reports.columns.reportOutstanding'),align:'right',render:(_,i)=>formatMoney(i.outstanding,i.currency)}]}/>}} columns={[{title:t('reports.columns.vendorCode'),dataIndex:'vendorCode'},{title:t('reports.columns.vendor'),dataIndex:'vendorName'},{title:t(k+'columns.bills'),dataIndex:'billCount'},{title:t('reports.columns.oldestDueDate'),dataIndex:'oldestDueDate'},...buckets.map((b,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[b],r.currency)}))]}/> <h3>{t('reports.totals.byCurrency')}</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},...buckets.map((b,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[b],r.currency)}))]}/>
 </>}
 </Card>
}

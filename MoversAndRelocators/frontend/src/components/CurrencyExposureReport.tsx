import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT} from '../i18n'
type Doc={id:string;number:string;type:string;party:string;currency:string;foreignBalance:number;carryingBase:number;revaluedBase?:number;gainLoss?:number}
type Row={currency:string;rate?:number;receivable:number;payable:number;netExposure:number;carryingBase:number;revaluedBase?:number;gainLoss?:number;documents:Doc[]}
type Posted={id:string;date:string;reference:string;description:string;transactionCurrency:string;isReversal:boolean;gain:number;loss:number;net:number}
type Report={from:string;to:string;baseCurrency:string;currency:string;rows:Row[];posted:Posted[];warnings:string[];totals:{carryingBase:number;revaluedBase?:number;unrealizedGainLoss?:number;postedGain:number;postedLoss:number;postedNet:number}}
export function CurrencyExposureReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('ALL'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const unavailable=t('reports.currencyExposure.unavailable'),c=(k:string)=>t('reports.currencyExposure.columns.'+k)
 const money=(n:number|null|undefined)=>n==null?unavailable:formatMoney(n,data!.baseCurrency)
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/currency-exposure?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.currencyExposure.loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??unavailable);if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.currencyExposure.csvTitle'),data.from,data.to,data.currency,t('reports.currencyExposure.base'),data.baseCurrency],...data.warnings.map(w=>[t('reports.currencyExposure.warning'),w]),[t('reports.columns.currency'),c('baseUnitsPerUnit'),c('receivable'),c('payable'),c('netExposure'),c('carryingBase'),c('revaluedBase'),c('estimatedGainLoss')],...data.rows.map(r=>[r.currency,r.rate,r.receivable,r.payable,r.netExposure,r.carryingBase,r.revaluedBase,r.gainLoss]),[],[t('reports.columns.document'),t('reports.columns.type'),c('party'),t('reports.columns.currency'),c('foreignBalance'),c('carryingBase'),c('revaluedBase'),c('estimatedGainLoss')],...data.rows.flatMap(r=>r.documents.map(d=>[d.number,d.type,d.party,d.currency,d.foreignBalance,d.carryingBase,d.revaluedBase,d.gainLoss])),[],[t('reports.columns.postingDate'),t('reports.columns.reference'),t('reports.columns.description'),c('journalCurrency'),t('reports.columns.reversal'),t('reports.columns.gain'),t('reports.columns.loss'),t('reports.columns.net')],...data.posted.map(p=>[p.date,p.reference,p.description,p.transactionCurrency,p.isReversal,p.gain,p.loss,p.net]),[t('reports.currencyExposure.postedTotals'),'','','','',data.totals.postedGain,data.totals.postedLoss,data.totals.postedNet],[c('estimatedGainLoss'),data.totals.unrealizedGainLoss]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='currency-exposure.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:24,title:t('reports.names.currencyExposure')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.currencyExposure.fxPostingsFrom')}<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.currencyExposure.exposureAsOf')}<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.transactionCurrency')}<Select className="accounting-report-select" style={{minWidth:220}} value={currency} onChange={setCurrency} options={[{value:'ALL',label:t('reports.currencyOptions.all')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t('reports.currencyExposure.alertTitle')} description={t('reports.currencyExposure.alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.currencyExposure.summary',{to:data.to,period:t('reports.period',{from:data.from,to:data.to}),base:data.baseCurrency,currency:data.currency==='ALL'?t('reports.currencyOptions.all'):data.currency})}</p>{data.warnings.map(w=><Alert key={w} type="warning" title={w}/>)}
 <DataGrid<Row> rowKey="currency" dataSource={data.rows} pagination={false} scroll={{x:1300}} expandable={{expandedRowRender:r=><DataGrid<Doc> rowKey="id" dataSource={r.documents} pagination={{pageSize:10}} columns={[{title:t('reports.columns.document'),dataIndex:'number'},{title:t('reports.columns.type'),dataIndex:'type'},{title:c('party'),dataIndex:'party'},{title:c('foreignBalance'),align:'right',render:(_,d)=>formatMoney(d.foreignBalance,d.currency)},{title:c('carryingBase'),align:'right',render:(_,d)=>money(d.carryingBase)},{title:c('revaluedBase'),align:'right',render:(_,d)=>money(d.revaluedBase)},{title:c('estimatedGainLoss'),align:'right',render:(_,d)=>money(d.gainLoss)}]}/>}} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},{title:c('baseUnitsPerUnit'),dataIndex:'rate',render:v=>v??unavailable},...(['receivable','payable','netExposure'] as const).map(k=>({title:c(k),align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)})),...(['carryingBase','revaluedBase','gainLoss'] as const).map(k=>({title:c(k==='gainLoss'?'estimatedGainLoss':k),align:'right' as const,render:(_:unknown,r:Row)=>money(r[k])}))]}/>
 <p>{t('reports.currencyExposure.estimatedTotal')} <strong>{money(data.totals.unrealizedGainLoss)}</strong></p>
 <h3>{t('reports.currencyExposure.postedHeading')}</h3><DataGrid<Posted> rowKey="id" dataSource={data.posted} pagination={{pageSize:25}} scroll={{x:1000}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.description'),dataIndex:'description'},{title:c('journalCurrency'),dataIndex:'transactionCurrency'},{title:t('reports.columns.type'),render:(_,p)=>p.isReversal?t('reports.columns.reversal'):t('reports.currencyExposure.posting')},...(['gain','loss','net'] as const).map(k=>({title:t('reports.columns.'+k),align:'right' as const,render:(_:unknown,p:Posted)=>money(p[k])}))]}/>
 <p>{t('reports.currencyExposure.postedTotalsLine',{gain:money(data.totals.postedGain),loss:money(data.totals.postedLoss)})} <strong>{money(data.totals.postedNet)}</strong></p></>}
 </Card>
}

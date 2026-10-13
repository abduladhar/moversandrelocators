import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT,has,formatDateTime} from '../i18n'
type Line={lineNumber:number;accountCode:string;accountName:string;debit:number;credit:number}
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;postedBy:string;postedByName:string;postedAtUtc:string;isReversal:boolean;reversesReference?:string;reversedBy:string[];debit:number;credit:number;lines:Line[]}
type Register={from:string;to:string;currency:string;status:string;rows:Entry[];totals:{debit:number;credit:number;count:number}}
export function JournalRegisterReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[status,setStatus]=useState('ALL'),[data,setData]=useState<Register>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const entryTypeLabel=(v:string)=>has('reports.journalRegister.entryTypes.'+v)?t('reports.journalRegister.entryTypes.'+v):v
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Register>('/api/billing/reports/journal-register?'+new URLSearchParams({from,to,currency,status})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.journalRegister.loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.journalRegister'),data.from,data.to,data.currency,data.status],[t('reports.columns.date'),t('reports.columns.reference'),t('reports.columns.description'),t('reports.columns.originalCurrency'),t('reports.columns.postedBy'),t('reports.journalRegister.postedAtUtc'),t('reports.columns.reversalOf'),t('reports.columns.reversedBy'),t('reports.columns.account'),t('reports.columns.accountName'),t('reports.columns.debit'),t('reports.columns.credit')],...data.rows.flatMap(j=>j.lines.map(l=>[j.date,j.reference,j.description,j.transactionCurrency,j.postedByName,j.postedAtUtc,j.reversesReference||'',j.reversedBy.join('; '),l.accountCode,l.accountName,l.debit,l.credit])),[t('reports.totals.total'),'','','','','','','','','',data.totals.debit,data.totals.credit]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='journal-register.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:3,title:t('reports.names.journalRegister')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input aria-label={t('reports.journalRegister.fromAria')} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input aria-label={t('reports.journalRegister.toAria')} type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.journalRegister.currencyAria')} style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <div className="accounting-report-field">{t('reports.filters.entryType')}<Select className="accounting-report-select" aria-label={t('reports.journalRegister.entryTypeAria')} style={{minWidth:160}} value={status} onChange={setStatus} options={['ALL','ORIGINAL','REVERSAL'].map(v=>({value:v,label:entryTypeLabel(v)}))}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.journalRegister.empty')}/>}
 {data&&<><p>{t('reports.journalRegister.summary',{period:t('reports.period',{from:data.from,to:data.to}),currency:data.currency,status:entryTypeLabel(data.status)})}</p>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1200}} pagination={{pageSize:25}} expandable={{expandedRowRender:j=><div style={{padding:12}}><p>{t('reports.journalRegister.postedBy',{name:j.postedByName})}</p><DataGrid<Line> rowKey="lineNumber" pagination={false} dataSource={j.lines} columns={[{title:t('reports.columns.account'),dataIndex:'accountCode'},{title:t('reports.columns.accountName'),dataIndex:'accountName'},{title:t('reports.columns.debit'),align:'right',render:(_,l)=>formatMoney(l.debit,data.currency)},{title:t('reports.columns.credit'),align:'right',render:(_,l)=>formatMoney(l.credit,data.currency)}]}/></div>}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.description'),dataIndex:'description'},{title:t('reports.columns.originalCurrency'),dataIndex:'transactionCurrency'},{title:t('reports.columns.debit'),align:'right',render:(_,j)=>formatMoney(j.debit,data.currency)},{title:t('reports.columns.credit'),align:'right',render:(_,j)=>formatMoney(j.credit,data.currency)},{title:t('reports.columns.postedAt'),dataIndex:'postedAtUtc',render:v=>formatDateTime(v)},{title:t('reports.columns.entryType'),render:(_,j)=>t(j.isReversal?'reports.journalRegister.reversal':'reports.journalRegister.original')},{title:t('reports.columns.reversalOf'),dataIndex:'reversesReference'},{title:t('reports.columns.reversedBy'),render:(_,j)=>j.reversedBy.join(', ')||'—'}]}/>
 <Space wrap style={{marginTop:20,display:'flex',justifyContent:'flex-end'}}><strong>{t('reports.journalRegister.journalCount',{count:data.totals.count})}</strong><strong>{t('reports.journalRegister.totalDebit',{amount:formatMoney(data.totals.debit,data.currency)})}</strong><strong>{t('reports.journalRegister.totalCredit',{amount:formatMoney(data.totals.credit,data.currency)})}</strong></Space>
 {data.rows.some(j=>j.debit!==j.credit)&&<Alert type="error" title={t('reports.journalRegister.unbalanced')}/>}
 </>}
 </Card>
}

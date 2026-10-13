import {useEffect,useState} from 'react'
import {Alert,Button,Input,Select,Space,message} from 'antd'
import {request} from '../api'
import {formatMoney,localDate,useCurrencies} from '../currency'
import {DataGrid} from './DataGrid'
import {has,useT} from '../i18n'
type Row={partyCurrency:string;partyAmount?:number;partyBalance?:number;partyWarning?:string;number:string;type:string;partyName:string;date:string;transactionCurrency:string;transactionAmount:number;baseAmount?:number;baseCurrency:string;reportCurrency:string;reportAmount?:number;balance?:number;warning?:string}
export function CurrencyReport({sourceKind,sourceId}:{sourceKind?:string;sourceId?:string}){
 const {t}=useT()
 const {data:currencyData}=useCurrencies()
 const [mode,setMode]=useState('BASE'),[date,setDate]=useState(localDate()),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);try{const r=await request<{rows:Row[]}>('/api/billing/currency-report?'+new URLSearchParams({mode,date,...(sourceId?{sourceKind:sourceKind!,sourceId}:{})}));setRows(r.rows);setError('')}catch(e){setRows([]);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[mode,date,sourceKind,sourceId])
 // CSV columns are the API field names (a raw data export), so they stay as they are.
 const exportCsv=()=>{
  if(!rows.length){message.info(t('reports.currencyReport.noRows'));return}
  const keys=(Object.keys(rows[0]) as (keyof Row)[]),cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"'
  const blob=new Blob(['﻿'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='financial-report-'+mode+'-'+date+'.csv';a.click();URL.revokeObjectURL(url)
 }
 const docType=(v:string)=>has('billing.docTypes.'+v)?t('billing.docTypes.'+v):v
 return <>
 <Alert type="info" title={t('reports.currencyReport.title')} description={t('reports.currencyReport.description')}/>
 <Space wrap style={{margin:'16px 0'}}><Select aria-label={t('reports.columns.reportCurrency')} value={mode} onChange={setMode} options={[{value:'BASE',label:t('reports.currencyReport.baseOption',{currency:currencyData?.baseCurrency||'…'})},{value:'PARTY',label:t('reports.currencyOptions.party')},{value:'TRANSACTION',label:t('reports.modes.TRANSACTION')}]}/><Input aria-label={t('reports.currencyReport.conversionDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button loading={loading} onClick={()=>void load()}>{t('reports.actions.refresh')}</Button><Button onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button></Space>
 {error&&<Alert type="error" title={error}/>}
 <DataGrid<Row> rowKey="number" dataSource={rows} loading={loading} scroll={{x:1200}} columns={[{title:t('reports.currencyReport.number'),dataIndex:'number'},{title:t('reports.columns.type'),dataIndex:'type',render:(v:string)=>docType(v)},{title:t('reports.columns.party'),dataIndex:'partyName'},{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.transactionAmount'),align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:t('reports.currencyReport.partyAmount'),align:'right',render:(_,r)=>r.partyWarning||formatMoney(r.partyAmount,r.partyCurrency)},{title:t('reports.currencyReport.partyBalance'),align:'right',render:(_,r)=>r.partyBalance==null?'—':formatMoney(r.partyBalance,r.partyCurrency)},{title:t('reports.columns.baseAmount'),align:'right',render:(_,r)=>formatMoney(r.baseAmount,r.baseCurrency)},{title:t('reports.columns.reportAmount'),align:'right',render:(_,r)=>formatMoney(r.reportAmount,r.reportCurrency)},{title:t('reports.columns.balance'),align:'right',render:(_,r)=>r.balance==null?'—':formatMoney(r.balance,r.reportCurrency)},{title:t('reports.currencyReport.rateWarning'),dataIndex:'warning'}]}/>
 </>
}

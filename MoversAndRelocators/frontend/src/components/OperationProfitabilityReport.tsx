import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {has,useT} from '../i18n'
type Totals={revenue:number;expense:number;profit:number;marginPercent?:number}
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;transactionAmount:number;revenue:number;expense:number;isReversal:boolean}
type Row=Totals&{sourceKind:string;sourceId:string;sourceLabel:string;entries:Entry[]}
type Report={from:string;to:string;currency:string;sourceKind:string;sourceId?:string;sourceLabel?:string|null;rows:Row[];totals:Totals}
export function OperationProfitabilityReport(){
 const {t}=useT(),k=(x:string,p?:Record<string,string|number>)=>t('reports.operationProfitability.'+x,p),kindLabel=(v:string)=>has('reports.operationProfitability.kinds.'+v)?k('kinds.'+v):v
 const amountTitles={revenue:t('reports.columns.revenue'),expense:t('reports.columns.expense'),profit:k('columns.profit')}
 const {data:currencies}=useCurrencies(),[sources,setSources]=useState<{kind:string;id:string;label:string}[]>([]),[kind,setKind]=useState('ALL'),[source,setSource]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setSources(c.sources)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/operation-profitability?'+new URLSearchParams({from,to,currency,sourceKind:kind,...(source?{sourceId:source}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:k('loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.operationProfitability'),data.from,data.to,data.currency,data.sourceKind,data.sourceLabel||k('allOperations')],[t('reports.columns.type'),k('operation'),amountTitles.revenue,amountTitles.expense,amountTitles.profit,k('columns.marginPercent')],...data.rows.map(r=>[r.sourceKind,r.sourceLabel,r.revenue,r.expense,r.profit,r.marginPercent]),[t('reports.totals.total'),'',data.totals.revenue,data.totals.expense,data.totals.profit,data.totals.marginPercent],[],[t('reports.columns.type'),k('operation'),t('reports.columns.date'),t('reports.columns.reference'),t('reports.columns.description'),t('reports.columns.reversal'),t('reports.columns.transactionCurrency'),k('columns.signedChargeAmount'),t('reports.columns.reportCurrency'),amountTitles.revenue,amountTitles.expense],...data.rows.flatMap(r=>r.entries.map(e=>[r.sourceKind,r.sourceLabel,e.date,e.reference,e.description,e.isReversal,e.transactionCurrency,e.transactionAmount,data.currency,e.revenue,e.expense]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='operation-profitability.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:23,title:t('reports.names.operationProfitability')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{k('operationType')}<Select className="accounting-report-select" style={{minWidth:170}} value={kind} onChange={v=>{setKind(v);setSource(undefined)}} options={['ALL','SURVEY','PICKUP','PACKING','DELIVERY','WAREHOUSE','JOB'].map(v=>({value:v,label:kindLabel(v)}))}/></div>
 <div className="accounting-report-field">{k('operation')}<Select className="accounting-report-select" allowClear showSearch optionFilterProp="label" placeholder={k('allOperations')} value={source} onChange={setSource} style={{minWidth:240}} options={sources.filter(s=>kind==='ALL'||s.kind===kind).map(s=>({value:s.id,label:kindLabel(s.kind)+' · '+s.label}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={k('alertTitle')} description={k('alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.period',{from:data.from,to:data.to})} · {data.currency} · {kindLabel(data.sourceKind)}</p>
 <DataGrid<Row> rowKey={r=>r.sourceKind+r.sourceId} dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1000}} expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey={(_,i)=>String(i)} dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1200}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.description'),dataIndex:'description'},{title:t('reports.columns.type'),render:(_,e)=>e.isReversal?t('reports.columns.reversal'):k('posting')},{title:t('reports.columns.transactionAmount'),align:'right',render:(_,e)=>formatMoney(e.transactionAmount,e.transactionCurrency)},{title:amountTitles.revenue,align:'right',render:(_,e)=>formatMoney(e.revenue,data.currency)},{title:amountTitles.expense,align:'right',render:(_,e)=>formatMoney(e.expense,data.currency)}]}/>}} columns={[{title:t('reports.columns.type'),dataIndex:'sourceKind',render:v=>kindLabel(v)},{title:k('operation'),dataIndex:'sourceLabel'},...(['revenue','expense','profit'] as const).map(x=>({title:amountTitles[x],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[x],data.currency)})),{title:k('columns.margin'),align:'right',render:(_,r)=>r.marginPercent==null?'—':r.marginPercent.toFixed(2)+'%'}]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>{k('totalRevenue',{amount:formatMoney(data.totals.revenue,data.currency)})}</strong><strong>{k('totalExpense',{amount:formatMoney(data.totals.expense,data.currency)})}</strong><strong>{k('totalProfit',{amount:formatMoney(data.totals.profit,data.currency)})}</strong></Space></>}
 </Card>
}

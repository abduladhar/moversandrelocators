import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={revenue:number;expense:number;profit:number;marginPercent?:number}
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;transactionAmount:number;revenue:number;expense:number;isReversal:boolean}
type Row=Totals&{sourceKind:string;sourceId:string;sourceLabel:string;entries:Entry[]}
type Report={from:string;to:string;currency:string;sourceKind:string;sourceId?:string;sourceLabel?:string|null;rows:Row[];totals:Totals}
export function OperationProfitabilityReport(){
 const {data:currencies}=useCurrencies(),[sources,setSources]=useState<{kind:string;id:string;label:string}[]>([]),[kind,setKind]=useState('ALL'),[source,setSource]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setSources(c.sources)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/operation-profitability?'+new URLSearchParams({from,to,currency,sourceKind:kind,...(source?{sourceId:source}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load profitability')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Operation profitability',data.from,data.to,data.currency,data.sourceKind,data.sourceLabel||'All operations'],['Type','Operation','Revenue','Expense','Profit','Margin %'],...data.rows.map(r=>[r.sourceKind,r.sourceLabel,r.revenue,r.expense,r.profit,r.marginPercent]),['TOTAL','',data.totals.revenue,data.totals.expense,data.totals.profit,data.totals.marginPercent],[],['Type','Operation','Date','Reference','Description','Reversal','Transaction currency','Signed charge amount','Report currency','Revenue','Expense'],...data.rows.flatMap(r=>r.entries.map(e=>[r.sourceKind,r.sourceLabel,e.date,e.reference,e.description,e.isReversal,e.transactionCurrency,e.transactionAmount,data.currency,e.revenue,e.expense]))]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='operation-profitability.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="23. Pickup / warehouse / job profitability" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Operation type<Select className="accounting-report-select" style={{minWidth:170}} value={kind} onChange={v=>{setKind(v);setSource(undefined)}} options={['ALL','SURVEY','PICKUP','PACKING','DELIVERY','WAREHOUSE','JOB'].map(v=>({value:v,label:v}))}/></div>
 <div className="accounting-report-field">Operation<Select className="accounting-report-select" allowClear showSearch optionFilterProp="label" placeholder="All operations" value={source} onChange={setSource} style={{minWidth:240}} options={sources.filter(s=>kind==='ALL'||s.kind===kind).map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Posted operation revenue less posted operation costs" description="Uses charge-level operation links, memo adjustments, reversals and direct expenses paid. Invoice/bill settlements are not counted again. Draft charges, unposted labour/material estimates, customer advances, standalone documents, unlinked manual journals, overhead and settlement exchange differences are excluded. This is operation contribution profit, not company net profit. Dates are posting dates; base amounts use saved exchange values."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{data.from} to {data.to} · {data.currency} · {data.sourceKind}</p>
 <DataGrid<Row> rowKey={r=>r.sourceKind+r.sourceId} dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1000}} expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey={(_,i)=>String(i)} dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1200}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Description',dataIndex:'description'},{title:'Type',render:(_,e)=>e.isReversal?'Reversal':'Posting'},{title:'Transaction amount',align:'right',render:(_,e)=>formatMoney(e.transactionAmount,e.transactionCurrency)},{title:'Revenue',align:'right',render:(_,e)=>formatMoney(e.revenue,data.currency)},{title:'Expense',align:'right',render:(_,e)=>formatMoney(e.expense,data.currency)}]}/>}} columns={[{title:'Type',dataIndex:'sourceKind'},{title:'Operation',dataIndex:'sourceLabel'},...(['revenue','expense','profit'] as const).map(k=>({title:k[0].toUpperCase()+k.slice(1),align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],data.currency)})),{title:'Margin',align:'right',render:(_,r)=>r.marginPercent==null?'—':r.marginPercent.toFixed(2)+'%'}]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>Revenue: {formatMoney(data.totals.revenue,data.currency)}</strong><strong>Expense: {formatMoney(data.totals.expense,data.currency)}</strong><strong>Profit: {formatMoney(data.totals.profit,data.currency)}</strong></Space></>}
 </Card>
}



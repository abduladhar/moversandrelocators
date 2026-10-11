import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Doc={id:string;number:string;type:string;party:string;currency:string;foreignBalance:number;carryingBase:number;revaluedBase?:number;gainLoss?:number}
type Row={currency:string;rate?:number;receivable:number;payable:number;netExposure:number;carryingBase:number;revaluedBase?:number;gainLoss?:number;documents:Doc[]}
type Posted={id:string;date:string;reference:string;description:string;transactionCurrency:string;isReversal:boolean;gain:number;loss:number;net:number}
type Report={from:string;to:string;baseCurrency:string;currency:string;rows:Row[];posted:Posted[];warnings:string[];totals:{carryingBase:number;revaluedBase?:number;unrealizedGainLoss?:number;postedGain:number;postedLoss:number;postedNet:number}}
export function CurrencyExposureReport(){
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('ALL'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const money=(n:number|null|undefined)=>n==null?'Unavailable':formatMoney(n,data!.baseCurrency)
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/currency-exposure?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load exposure')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'Unavailable');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Currency exposure',data.from,data.to,data.currency,'Base',data.baseCurrency],...data.warnings.map(w=>['Warning',w]),['Currency','Base units per unit','Receivable','Payable','Net exposure','Carrying base','Revalued base','Estimated gain/loss'],...data.rows.map(r=>[r.currency,r.rate,r.receivable,r.payable,r.netExposure,r.carryingBase,r.revaluedBase,r.gainLoss]),[],['Document','Type','Party','Currency','Foreign balance','Carrying base','Revalued base','Estimated gain/loss'],...data.rows.flatMap(r=>r.documents.map(d=>[d.number,d.type,d.party,d.currency,d.foreignBalance,d.carryingBase,d.revaluedBase,d.gainLoss])),[],['Posting date','Reference','Description','Journal currency','Reversal','Gain','Loss','Net'],...data.posted.map(p=>[p.date,p.reference,p.description,p.transactionCurrency,p.isReversal,p.gain,p.loss,p.net]),['Posted totals','','','','',data.totals.postedGain,data.totals.postedLoss,data.totals.postedNet],['Estimated gain/loss',data.totals.unrealizedGainLoss]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='currency-exposure.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="24. Currency exposure & exchange differences" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">FX postings from<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">Exposure as of / postings to<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Transaction currency<Select className="accounting-report-select" style={{minWidth:220}} value={currency} onChange={setCurrency} options={[{value:'ALL',label:'All currencies'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Foreign invoice and bill exposure" description="Exposure includes outstanding posted foreign invoices and bills as of the end date. Cash/bank holdings, advances and unlinked manual balances are excluded. Estimated revaluation uses the rate valid at that date and does not post accounting entries. Positive differences are gains; negative differences are losses. Posted movements below include accounts 4200-FX and 5500 (including rounding, manual and closing entries); the currency filter uses journal currency."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>Exposure at {data.to} · Posted movements {data.from} to {data.to} · Base {data.baseCurrency} · {data.currency}</p>{data.warnings.map(w=><Alert key={w} type="warning" title={w}/>)}
 <DataGrid<Row> rowKey="currency" dataSource={data.rows} pagination={false} scroll={{x:1300}} expandable={{expandedRowRender:r=><DataGrid<Doc> rowKey="id" dataSource={r.documents} pagination={{pageSize:10}} columns={[{title:'Document',dataIndex:'number'},{title:'Type',dataIndex:'type'},{title:'Party',dataIndex:'party'},{title:'Foreign balance',align:'right',render:(_,d)=>formatMoney(d.foreignBalance,d.currency)},{title:'Carrying base',align:'right',render:(_,d)=>money(d.carryingBase)},{title:'Revalued base',align:'right',render:(_,d)=>money(d.revaluedBase)},{title:'Estimated gain/loss',align:'right',render:(_,d)=>money(d.gainLoss)}]}/>}} columns={[{title:'Currency',dataIndex:'currency'},{title:'Base units per unit',dataIndex:'rate',render:v=>v??'Unavailable'},...(['receivable','payable','netExposure'] as const).map(k=>({title:k,align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)})),...(['carryingBase','revaluedBase','gainLoss'] as const).map((k,i)=>({title:['Carrying base','Revalued base','Estimated gain/loss'][i],align:'right' as const,render:(_:unknown,r:Row)=>money(r[k])}))]}/>
 <p>Estimated gain/loss: <strong>{money(data.totals.unrealizedGainLoss)}</strong></p>
 <h3>Posted exchange account movements</h3><DataGrid<Posted> rowKey="id" dataSource={data.posted} pagination={{pageSize:25}} scroll={{x:1000}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Description',dataIndex:'description'},{title:'Journal currency',dataIndex:'transactionCurrency'},{title:'Type',render:(_,p)=>p.isReversal?'Reversal':'Posting'},...(['gain','loss','net'] as const).map(k=>({title:k,align:'right' as const,render:(_:unknown,p:Posted)=>money(p[k])}))]}/>
 <p>Posted gain: {money(data.totals.postedGain)} · Posted loss: {money(data.totals.postedLoss)} · Net: <strong>{money(data.totals.postedNet)}</strong></p></>}
 </Card>
}



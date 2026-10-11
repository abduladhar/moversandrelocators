import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;status:string;amount:number;adjustment:number;paid:number;balance:number}
type Row=Totals&{id:string;number:string;vendorCode:string;vendorName:string;date:string;dueDate:string;reference?:string;transactionCurrency:string;transactionAmount:number;transactionBalance:number;notes?:string;voidReason?:string;lines:{description:string;quantity:number;unitPrice?:number;amount:number;sourceLabel:string}[]}
type Report={from:string;to:string;mode:string;status:string;vendorCode?:string;rows:Row[];totals:Totals[]}
const buckets=['amount','adjustment','paid','balance'] as const
const labels=['Bill amount','Memo adjustment','Paid','Balance']
const statuses=['ALL','DRAFT','UNPAID','PART_PAID','SETTLED','VOIDED']
export function BillRegisterReport(){
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[status,setStatus]=useState('ALL'),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/bill-register?'+new URLSearchParams({from,to,status,currency,...(vendor?{vendorCode:vendor}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load register')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Bill register',data.from,data.to,data.status,data.mode,data.vendorCode||'All vendors'],['Vendor code','Vendor','Bill','Bill date','Due date','Reference','Status','Transaction currency','Transaction amount','Transaction balance','Report currency',...labels],...data.rows.map(r=>[r.vendorCode,r.vendorName,r.number,r.date,r.dueDate,r.reference,r.status,r.transactionCurrency,r.transactionAmount,r.transactionBalance,r.currency,...buckets.map(k=>r[k])]),[],['Totals by currency','Status',...labels],...data.totals.map(t=>[t.currency,t.status,...buckets.map(k=>t[k])])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='bill-register.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="13. Bill register" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Vendor<Select className="accounting-report-select" aria-label="Register vendor" allowClear showSearch optionFilterProp="label" placeholder="All vendors" value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><div className="accounting-report-field">Status<Select className="accounting-report-select" style={{minWidth:160}} value={status} onChange={setStatus} options={statuses.map(s=>({value:s,label:s.replaceAll("_"," ")}))}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Register currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'VENDOR',label:'Each vendor’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Bill dates with current settlement status" description="Balances include all currently posted payments and memos, including those after the selected bill period. Draft and voided amounts are shown separately and have no payable balance. Vendor currency uses the rate valid at the period end. Expand an bill to view its charges."/> {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{data.from} to {data.to} · {data.status} · {data.vendorCode||'All vendors'} · {data.mode==='VENDOR'?'Vendor currencies':data.mode==='DEFAULT'?'Default transaction currency':data.mode==='BASE'?'Accounting base currency':data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} expandable={{expandedRowRender:r=><div>{r.lines.map((l,i)=><p key={i}>{l.description} · {l.sourceLabel} · Qty {l.quantity} · {formatMoney(l.amount,r.transactionCurrency)}</p>)}{r.notes&&<p>{r.notes}</p>}{r.voidReason&&<p>Void reason: {r.voidReason}</p>}</div>}} scroll={{x:1800}} pagination={{pageSize:25}} columns={[{title:'Vendor',dataIndex:'vendorName'},{title:'Bill',dataIndex:'number'},{title:'Bill date',dataIndex:'date'},{title:'Due date',dataIndex:'dueDate'},{title:'Reference',dataIndex:'reference'},{title:'Status',dataIndex:'status'},{title:'Transaction amount',align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:'Transaction balance',align:'right',render:(_,r)=>formatMoney(r.transactionBalance,r.transactionCurrency)},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/>
 <h3>Totals by currency and status</h3><DataGrid<Totals> rowKey={r=>r.currency+r.status} dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:'Currency',dataIndex:'currency'},{title:'Status',dataIndex:'status'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}






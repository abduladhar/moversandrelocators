import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;status:string;amount:number;adjustment:number;paid:number;balance:number}
type Row=Totals&{id:string;number:string;customerCode:string;customerName:string;date:string;dueDate:string;reference?:string;transactionCurrency:string;transactionAmount:number;transactionBalance:number;notes?:string;voidReason?:string;lines:{description:string;quantity:number;unitPrice?:number;amount:number;sourceLabel:string}[]}
type Report={from:string;to:string;mode:string;status:string;customerCode?:string;rows:Row[];totals:Totals[]}
const buckets=['amount','adjustment','paid','balance'] as const
const labels=['Invoice amount','Memo adjustment','Paid','Balance']
const statuses=['ALL','DRAFT','UNPAID','PART_PAID','SETTLED','VOIDED']
export function InvoiceRegisterReport(){
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[status,setStatus]=useState('ALL'),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/invoice-register?'+new URLSearchParams({from,to,status,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load aging')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Invoice register',data.from,data.to,data.status,data.mode,data.customerCode||'All customers'],['Customer code','Customer','Invoice','Invoice date','Due date','Reference','Status','Transaction currency','Transaction amount','Transaction balance','Report currency',...labels],...data.rows.map(r=>[r.customerCode,r.customerName,r.number,r.date,r.dueDate,r.reference,r.status,r.transactionCurrency,r.transactionAmount,r.transactionBalance,r.currency,...buckets.map(k=>r[k])]),[],['Totals by currency','Status',...labels],...data.totals.map(t=>[t.currency,t.status,...buckets.map(k=>t[k])])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='invoice-register.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="12. Invoice register" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Customer<Select className="accounting-report-select" aria-label="Aging customer" allowClear showSearch optionFilterProp="label" placeholder="All customers" value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><div className="accounting-report-field">Status<Select className="accounting-report-select" style={{minWidth:160}} value={status} onChange={setStatus} options={statuses.map(s=>({value:s,label:s.replaceAll("_"," ")}))}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Aging currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'CUSTOMER',label:'Each customer’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Invoice dates with current settlement status" description="Balances include all currently posted payments and memos, including those after the selected invoice period. Draft and voided amounts are shown separately and have no receivable balance. Customer currency uses the rate valid at the period end. Expand an invoice to view its charges."/> {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{data.from} to {data.to} · {data.status} · {data.customerCode||'All customers'} · {data.mode==='CUSTOMER'?'Customer currencies':data.mode==='DEFAULT'?'Default transaction currency':data.mode==='BASE'?'Accounting base currency':data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} expandable={{expandedRowRender:r=><div>{r.lines.map((l,i)=><p key={i}>{l.description} · {l.sourceLabel} · Qty {l.quantity} · {formatMoney(l.amount,r.transactionCurrency)}</p>)}{r.notes&&<p>{r.notes}</p>}{r.voidReason&&<p>Void reason: {r.voidReason}</p>}</div>}} scroll={{x:1800}} pagination={{pageSize:25}} columns={[{title:'Customer',dataIndex:'customerName'},{title:'Invoice',dataIndex:'number'},{title:'Invoice date',dataIndex:'date'},{title:'Due date',dataIndex:'dueDate'},{title:'Reference',dataIndex:'reference'},{title:'Status',dataIndex:'status'},{title:'Transaction amount',align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:'Transaction balance',align:'right',render:(_,r)=>formatMoney(r.transactionBalance,r.transactionCurrency)},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/>
 <h3>Totals by currency and status</h3><DataGrid<Totals> rowKey={r=>r.currency+r.status} dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:'Currency',dataIndex:'currency'},{title:'Status',dataIndex:'status'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}





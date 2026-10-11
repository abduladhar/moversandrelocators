import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;partyType:string;status:string;count:number;amount:number}
type Row=Totals&{id:string;number:string;date:string;partyCode:string;partyName:string;documentType:string;documentNumber:string;documentReference?:string;chargeDescription?:string;accountCode:string;reason:string;transactionCurrency:string;transactionAmount:number;reversalNumber?:string;reversalDate?:string}
type Report={from:string;to:string;mode:string;status:string;partyType:string;partyCode?:string;rows:Row[];totals:Totals[]}
const statuses=['ALL','DRAFT','POSTED','VOIDED']
export function DebitMemoRegisterReport(){
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[vendors,setVendors]=useState<Party[]>([]),[partyType,setPartyType]=useState("ALL"),[customer,setCustomer]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[status,setStatus]=useState('ALL'),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>{setCustomers(c.customers);setVendors(c.vendors)}).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/debit-memo-register?'+new URLSearchParams({from,to,status,currency,partyType,...(customer?{partyCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load register')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Debit memo register',data.from,data.to,data.status,data.mode,data.partyType,data.partyCode||'All parties'],['Memo','Date','Party type','Party code','Party','Status','Document type','Original document','Reference','Charge','Account','Reason','Transaction currency','Transaction amount','Report currency','Amount','Reversal','Reversal date'],...data.rows.map(r=>[r.number,r.date,r.partyType,r.partyCode,r.partyName,r.status,r.documentType,r.documentNumber,r.documentReference,r.chargeDescription,r.accountCode,r.reason,r.transactionCurrency,r.transactionAmount,r.currency,r.amount,r.reversalNumber,r.reversalDate]),[],['Currency','Party type','Status','Count','Amount'],...data.totals.map(t=>[t.currency,t.partyType,t.status,t.count,t.amount])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='debit-memo-register.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="17. Debit memo register" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Party type<Select className="accounting-report-select" style={{minWidth:180}} value={partyType} onChange={v=>{setPartyType(v);setCustomer(undefined)}} options={['ALL','CUSTOMER','VENDOR'].map(v=>({value:v,label:v}))}/></div>
 <div className="accounting-report-field">Customer / vendor<Select className="accounting-report-select" aria-label="Memo party" disabled={partyType==='ALL'} allowClear showSearch optionFilterProp="label" placeholder="All parties" value={customer} onChange={setCustomer} style={{minWidth:240}} options={(partyType==='VENDOR'?vendors:customers).map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div> <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><div className="accounting-report-field">Status<Select className="accounting-report-select" style={{minWidth:160}} value={status} onChange={setStatus} options={statuses.map(s=>({value:s,label:s.replaceAll("_"," ")}))}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Receipt currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'PARTY',label:'Customer / vendor currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Debit memo dates with current posting status" description="Customer debits increase receivables; vendor debits increase payables. Totals are separated by party type, currency and status. Draft and voided memos do not represent active posted debits. Party currency uses the period-end rate."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{data.from} to {data.to} · {data.partyType} · {data.partyCode||'All parties'} · {data.status} · {data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1600}} expandable={{expandedRowRender:r=><div><p>Reason: {r.reason}</p><p>Charge: {r.chargeDescription} · Account {r.accountCode}</p>{r.reversalNumber&&<p>Reversal: {r.reversalNumber} · {r.reversalDate}</p>}</div>}} columns={[{title:'Memo',dataIndex:'number'},{title:'Date',dataIndex:'date'},{title:'Party type',dataIndex:'partyType'},{title:'Customer / vendor',dataIndex:'partyName'},{title:'Original document',dataIndex:'documentNumber'},{title:'Reference',dataIndex:'documentReference'},{title:'Status',dataIndex:'status'},{title:'Transaction amount',align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:'Report amount',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>Totals by currency, party type and status</h3><DataGrid<Totals> rowKey={r=>r.currency+r.partyType+r.status} dataSource={data.totals} pagination={false} columns={[{title:'Currency',dataIndex:'currency'},{title:'Party type',dataIndex:'partyType'},{title:'Status',dataIndex:'status'},{title:'Memos',dataIndex:'count'},{title:'Amount',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/></>}
 </Card>
}




import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;status:string;count:number;amount:number}
type Row={id:string;number:string;vendorCode?:string;vendorName:string;date:string;status:string;reference:string;accountName?:string;notes?:string;transactionCurrency:string;transactionAmount:number;allocated:number;unallocated:number;currency:string;amount:number;allocations:{documentId:string;number:string;currency:string;amount:number;paymentAmount:number}[]}
type Report={from:string;to:string;mode:string;status:string;vendorCode?:string;rows:Row[];totals:Totals[]}
const statuses=['ALL','DRAFT','POSTED','VOIDED']
export function PaymentVoucherRegisterReport(){
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[status,setStatus]=useState('ALL'),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/payment-voucher-register?'+new URLSearchParams({from,to,status,currency,...(vendor?{vendorCode:vendor}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load register')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Payment voucher register',data.from,data.to,data.status,data.mode,data.vendorCode||'All vendors'],['Vendor code','Vendor','Payment','Date','Reference','Status','Cash/bank','Transaction currency','Paid','Allocated','Without bill allocation','Report currency','Report amount'],...data.rows.map(r=>[r.vendorCode,r.vendorName,r.number,r.date,r.reference,r.status,r.accountName,r.transactionCurrency,r.transactionAmount,r.allocated,r.unallocated,r.currency,r.amount]),[],['Currency','Status','Count','Total'],...data.totals.map(t=>[t.currency,t.status,t.count,t.amount]),[],['Payment','Bill','Bill currency','Bill allocation','Payment currency','Payment allocation'],...data.rows.flatMap(r=>r.allocations.map(a=>[r.number,a.number,a.currency,a.amount,r.transactionCurrency,a.paymentAmount]))]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='payment-voucher-register.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="15. Payment voucher register" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Vendor<Select className="accounting-report-select" aria-label="Payment vendor" allowClear showSearch optionFilterProp="label" placeholder="All vendors" value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><div className="accounting-report-field">Status<Select className="accounting-report-select" style={{minWidth:160}} value={status} onChange={setStatus} options={statuses.map(s=>({value:s,label:s.replaceAll("_"," ")}))}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Payment currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'VENDOR',label:'Each vendor’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Payment dates with current posting status" description="Includes payment vouchers and operation payments, including direct expenses paid without bill allocations. Allocated operation payments appear once. Draft and voided totals are separate from posted payments. Allocations are shown in both bill and payment currencies. Vendor currency uses the period-end rate."/>
 {error&&<Alert type="error" title={error}/>} {data&&<><p>{data.from} to {data.to} · {data.status} · {data.vendorCode||'All vendors'} · {data.mode==='VENDOR'?'Vendor currencies':data.mode==='DEFAULT'?'Default transaction currency':data.mode==='BASE'?'Accounting base currency':data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1500}} expandable={{expandedRowRender:r=><div>{r.allocations.length===0?<p>Direct expense / no bill allocation</p>:r.allocations.map(a=><p key={a.documentId}>{a.number} · Bill allocation {formatMoney(a.amount,a.currency)} · Payment allocation {formatMoney(a.paymentAmount,r.transactionCurrency)}</p>)}{r.notes&&<p>{r.notes}</p>}</div>}} columns={[{title:'Payment',dataIndex:'number'},{title:'Date',dataIndex:'date'},{title:'Vendor',dataIndex:'vendorName'},{title:'Reference',dataIndex:'reference'},{title:'Cash / bank',dataIndex:'accountName'},{title:'Status',dataIndex:'status'},...(['transactionAmount','allocated','unallocated'] as const).map((k,i)=>({title:['Paid','Allocated','Without bill allocation'][i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.transactionCurrency)})),{title:'Report amount',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>Totals by currency and status</h3><DataGrid<Totals> rowKey={r=>r.currency+r.status} dataSource={data.totals} pagination={false} columns={[{title:'Currency',dataIndex:'currency'},{title:'Status',dataIndex:'status'},{title:'Payments',dataIndex:'count'},{title:'Amount',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/> </>}
 </Card>
}








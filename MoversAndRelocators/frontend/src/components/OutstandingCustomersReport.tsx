import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;invoiceCount:number;current:number;overdue:number;outstanding:number;customerCount?:number}
type Invoice={id:string;number:string;invoiceDate:string;dueDate:string;transactionCurrency:string;transactionOutstanding:number;currency:string;outstanding:number}
type Row=Totals&{customerCode:string;customerName:string;oldestDueDate:string;invoices:Invoice[]}
type Report={date:string;mode:string;customerCode?:string;rows:Row[];totals:Totals[]}
const buckets=['current','overdue','outstanding'] as const
const labels=['Not overdue','Overdue','Outstanding']
export function OutstandingCustomersReport(){
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/outstanding-customers?'+new URLSearchParams({date,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load balances')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Outstanding customer balances',data.date,data.mode,data.customerCode||'All customers'],['Customer code','Customer','Currency','Invoices','Oldest due date',...labels],...data.rows.map(r=>[r.customerCode,r.customerName,r.currency,r.invoiceCount,r.oldestDueDate,...buckets.map(k=>r[k])]),[],['Totals by currency','Customers','Invoices',...labels],...data.totals.map(t=>[t.currency,t.customerCount,t.invoiceCount,...buckets.map(k=>t[k])]),[],['Customer code','Invoice','Invoice date','Due date','Transaction currency','Transaction outstanding','Report currency','Report outstanding'],...data.rows.flatMap(r=>r.invoices.map(i=>[r.customerCode,i.number,i.invoiceDate,i.dueDate,i.transactionCurrency,i.transactionOutstanding,i.currency,i.outstanding]))]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='outstanding-customers.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="18. Outstanding customer balances" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Customer<Select className="accounting-report-select" aria-label="Balance customer" allowClear showSearch optionFilterProp="label" placeholder="All customers" value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">As-of date<Input aria-label="Balance as-of date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Balance currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'CUSTOMER',label:'Each customer’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Customer balances from outstanding posted invoices" description="Includes only postings effective by the as-of date, with payments, memo adjustments and reversals applied historically. Invoices due on that date are not overdue. Unallocated advances and unlinked manual journals are excluded. Customer currency uses the rate valid at the as-of date; totals remain separate for each currency."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>As of {data.date} · {data.customerCode||'All customers'} · {data.mode==='CUSTOMER'?'Customer currencies':data.mode==='DEFAULT'?'Default transaction currency':data.mode==='BASE'?'Accounting base currency':data.mode}</p>
 <DataGrid<Row> rowKey={r=>r.customerCode+'|'+r.currency} dataSource={data.rows} scroll={{x:1100}} pagination={{pageSize:25}} expandable={{expandedRowRender:r=><DataGrid<Invoice> rowKey="id" dataSource={r.invoices} pagination={false} scroll={{x:900}} columns={[{title:'Invoice',dataIndex:'number'},{title:'Invoice date',dataIndex:'invoiceDate'},{title:'Due date',dataIndex:'dueDate'},{title:'Transaction outstanding',align:'right',render:(_,i)=>formatMoney(i.transactionOutstanding,i.transactionCurrency)},{title:'Report outstanding',align:'right',render:(_,i)=>formatMoney(i.outstanding,i.currency)}]}/>}} columns={[{title:'Customer code',dataIndex:'customerCode'},{title:'Customer',dataIndex:'customerName'},{title:'Invoices',dataIndex:'invoiceCount'},{title:'Oldest due date',dataIndex:'oldestDueDate'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/> <h3>Totals by currency</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:'Currency',dataIndex:'currency'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}




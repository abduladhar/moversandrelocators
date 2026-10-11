import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;count:number;amount:number}
type Row=Totals&{id:string;number:string;customerCode:string;customerName:string;date:string;reference?:string;source:string;transactionCurrency:string;transactionAmount:number}
type Customer=Totals&{customerCode:string;customerName:string}
type Report={date:string;mode:string;customerCode?:string;rows:Row[];customers:Customer[];totals:Totals[]}
export function CustomerAdvancesReport(){
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/customer-advances?'+new URLSearchParams({date,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load balances')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Customer advances',data.date,data.mode,data.customerCode||'All customers'],['Receipt','Posting date','Customer code','Customer','Reference','Source','Transaction currency','Advance balance','Report currency','Report balance'],...data.rows.map(r=>[r.number,r.date,r.customerCode,r.customerName,r.reference,r.source,r.transactionCurrency,r.transactionAmount,r.currency,r.amount]),[],['Customer code','Customer','Currency','Advances','Balance'],...data.customers.map(c=>[c.customerCode,c.customerName,c.currency,c.count,c.amount]),[],['Currency','Advances','Balance'],...data.totals.map(t=>[t.currency,t.count,t.amount])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='customer-advances.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="20. Customer advances" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Customer<Select className="accounting-report-select" aria-label="Balance customer" allowClear showSearch optionFilterProp="label" placeholder="All customers" value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">As-of date<Input aria-label="Balance as-of date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Balance currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'CUSTOMER',label:'Each customer’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Posted customer advances as of the selected date" description="Shows unallocated receipts posted to customer advances (account 2100). Draft receipts and receipts allocated directly to invoices are excluded. Reversals effective by the selected date are excluded. Unlinked manual journals are excluded; this report does not allocate or refund advances. Customer currency uses the as-of rate."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>As of {data.date} · {data.customerCode||'All customers'} · {data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1300}} columns={[{title:'Receipt',dataIndex:'number'},{title:'Posting date',dataIndex:'date'},{title:'Customer',dataIndex:'customerName'},{title:'Reference',dataIndex:'reference'},{title:'Source',dataIndex:'source'},{title:'Transaction balance',align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:'Report balance',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>Balances by customer</h3><DataGrid<Customer> rowKey={r=>r.customerCode+'|'+r.currency} dataSource={data.customers} pagination={false} columns={[{title:'Customer',dataIndex:'customerName'},{title:'Currency',dataIndex:'currency'},{title:'Advances',dataIndex:'count'},{title:'Balance',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>Totals by currency</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} columns={[{title:'Currency',dataIndex:'currency'},{title:'Advances',dataIndex:'count'},{title:'Balance',align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/></>}
 </Card>
}



import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Entry={journalId:string;date:string;type:string;number:string;originalNumber:string;reference?:string;transactionCurrency:string;transactionDebit:number;transactionCredit:number;debit:number;credit:number;balance:number;isReversal:boolean;controlAccounts:string[]}
type Statement={from:string;to:string;currency:string;mode:string;customer:{code:string;name:string;address?:string};conversionDate?:string;opening:number;debit:number;credit:number;closing:number;rows:Entry[]}
export function CustomerStatementReport(){
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('CUSTOMER'),[data,setData]=useState<Statement>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{if(!customer){setError('Select a customer.');return}setLoading(true);setError('');try{setData(await request<Statement>('/api/billing/reports/customer-statement?'+new URLSearchParams({from,to,currency,customerCode:customer})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load statement')}finally{setLoading(false)}}
 const balance=(n:number)=>formatMoney(Math.abs(n),data?.currency||'USD')+(n<0?' Cr':n>0?' Dr':'')
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Customer statement',data.customer.code,data.customer.name,data.from,data.to,data.currency,data.mode],['Conversion date',data.conversionDate||'Saved journal values'],['Opening balance',data.opening],['Date','Type','Number','Original document','Reference','Transaction currency','Transaction debit','Transaction credit','Statement debit','Statement credit','Running balance (debit positive)'],...data.rows.map(r=>[r.date,r.type,r.number,r.originalNumber,r.reference,r.transactionCurrency,r.transactionDebit,r.transactionCredit,r.debit,r.credit,r.balance]),['Period debit',data.debit],['Period credit',data.credit],['Closing balance',data.closing]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='customer-statement.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="8. Customer statement" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Customer<Select className="accounting-report-select" aria-label="Statement customer" showSearch optionFilterProp="label" placeholder="Select customer" value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">From date<Input aria-label="Statement from date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input aria-label="Statement to date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Statement currency" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'CUSTOMER',label:'Customer currency · '+(customers.find(c=>c.code===customer)?.currency||currencies?.settings.defaultCurrency||'…')},{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} disabled={!customer} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Select a customer and reporting period."/>}
 {data&&<><h3>{data.customer.name} · {data.customer.code}</h3><p>{data.from} to {data.to} · {data.currency}{data.conversionDate?' · Customer-currency equivalent using the rate valid on '+data.conversionDate:''}</p>
 <Alert style={{marginBottom:16}} type="info" title="Posted customer activity" description="Includes linked invoices, receipts, memos, reversals and customer advances. A debit balance is due from the customer; a credit balance is in their favour. The net balance includes unallocated advances. Manual journals without a customer link are excluded."/>
 <h3>Opening balance: {balance(data.opening)}</h3>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1300}} pagination={{pageSize:25}} columns={[{title:'Date',dataIndex:'date'},{title:'Type',dataIndex:'type'},{title:'Document',dataIndex:'number'},{title:'Reference',dataIndex:'reference'},{title:'Transaction debit',align:'right',render:(_,r)=>formatMoney(r.transactionDebit,r.transactionCurrency)},{title:'Transaction credit',align:'right',render:(_,r)=>formatMoney(r.transactionCredit,r.transactionCurrency)},{title:'Debit ('+data.currency+')',align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:'Credit ('+data.currency+')',align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:'Running balance',align:'right',render:(_,r)=>balance(r.balance)}]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>Period debit: {formatMoney(data.debit,data.currency)}</strong><strong>Period credit: {formatMoney(data.credit,data.currency)}</strong><strong>Closing: {balance(data.closing)}</strong></Space>
 </>}
 </Card>
}



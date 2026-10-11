import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Totals={currency:string;current:number;days1To30:number;days31To60:number;days61To90:number;daysOver90:number;outstanding:number}
type Row=Totals&{id:string;number:string;vendorCode:string;vendorName:string;billDate:string;dueDate:string;daysOverdue:number;transactionCurrency:string;transactionOutstanding:number}
type Report={date:string;mode:string;vendorCode?:string;rows:Row[];totals:Totals[]}
const buckets=['current','days1To30','days31To60','days61To90','daysOver90','outstanding'] as const
const labels=['Not overdue','1–30 days','31–60 days','61–90 days','Over 90 days','Outstanding']
export function PayableAgingReport(){
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/payable-aging?'+new URLSearchParams({date,currency,...(vendor?{vendorCode:vendor}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load aging')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Accounts payable aging',data.date,data.mode,data.vendorCode||'All vendors'],['Vendor code','Vendor','Bill','Bill date','Due date','Days overdue','Transaction currency','Transaction outstanding','Report currency',...labels],...data.rows.map(r=>[r.vendorCode,r.vendorName,r.number,r.billDate,r.dueDate,r.daysOverdue,r.transactionCurrency,r.transactionOutstanding,r.currency,...buckets.map(k=>r[k])]),[],['Totals by currency',...labels],...data.totals.map(t=>[t.currency,...buckets.map(k=>t[k])])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='accounts-payable-aging.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="11. Accounts payable aging" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Vendor<Select className="accounting-report-select" aria-label="Aging vendor" allowClear showSearch optionFilterProp="label" placeholder="All vendors" value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">As-of date<Input aria-label="Aging as-of date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Aging currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},{value:'VENDOR',label:'Each vendor’s currency'},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Outstanding posted bills, aged by due date" description="Includes only postings effective by the as-of date, with payments, memo adjustments and reversals applied historically. Bills due on that date are not overdue. Direct expenses paid without a bill allocation and unlinked manual journals are excluded. Vendor currency uses the rate valid at the as-of date; totals remain separate for each currency."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>As of {data.date} · {data.vendorCode||'All vendors'} · {data.mode==='VENDOR'?'Vendor currencies':data.mode==='DEFAULT'?'Default transaction currency':data.mode==='BASE'?'Accounting base currency':data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} scroll={{x:1800}} pagination={{pageSize:25}} columns={[{title:'Vendor',dataIndex:'vendorName'},{title:'Bill',dataIndex:'number'},{title:'Bill date',dataIndex:'billDate'},{title:'Due date',dataIndex:'dueDate'},{title:'Days overdue',dataIndex:'daysOverdue'},{title:'Transaction outstanding',align:'right',render:(_,r)=>formatMoney(r.transactionOutstanding,r.transactionCurrency)},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],r.currency)}))]}/>
 <h3>Totals by currency</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} scroll={{x:950}} columns={[{title:'Currency',dataIndex:'currency'},...buckets.map((k,i)=>({title:labels[i],align:'right' as const,render:(_:unknown,r:Totals)=>formatMoney(r[k],r.currency)}))]}/>
 </>}
 </Card>
}




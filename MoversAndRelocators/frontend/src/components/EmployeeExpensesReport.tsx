import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'

type Entry={expenseId:string;number:string;date:string;sourceKind:string;sourceId:string;sourceLabel:string;description:string;transactionCurrency:string;transactionAmount:number;amount:number|null;posted:boolean;postingNumber:string|null}
type Row={employeeId:string;employeeNumber:string|null;employeeName:string;count:number;total:number;posted:number;pending:number;bySource:{sourceKind:string;amount:number}[];entries:Entry[]}
type Report={from:string;to:string;currency:string;employeeName:string|null;sourceKind:string;status:string;rows:Row[];missingValues:number;totals:{count:number;total:number;posted:number;pending:number};employees:{id:string;name:string;number:string}[]}

const modules:Record<string,string>={SURVEY:'Survey',PICKUP:'Pickup',PACKING:'Packing',DELIVERY:'Delivery'}

/** Report 27: what each employee paid on surveys, pickups, packing and deliveries in a period (the "Paid by" on each expense). */
export function EmployeeExpensesReport(){
 const {data:currencies}=useCurrencies()
 const [from,setFrom]=useState(localDate().slice(0,8)+'01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE')
 const [employee,setEmployee]=useState<string>(),[kind,setKind]=useState('ALL'),[status,setStatus]=useState('ALL')
 const [data,setData]=useState<Report>(),[employees,setEmployees]=useState<Report['employees']>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('')
  try{const r=await request<Report>('/api/billing/reports/employee-expenses?'+new URLSearchParams({from,to,currency,sourceKind:kind,status,...(employee?{employeeId:employee}:{})}));setData(r);setEmployees(r.employees)}
  catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load employee expenses')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Employee expenses',data.from,data.to,data.currency,data.employeeName||'All employees',data.sourceKind,data.status],
   ['Employee number','Employee','Expenses','Total','Posted','Pending'],...data.rows.map(r=>[r.employeeNumber,r.employeeName,r.count,r.total,r.posted,r.pending]),['','TOTAL',data.totals.count,data.totals.total,data.totals.posted,data.totals.pending],[],
   ['Employee','Date','Module','Job / survey','Expense','Description','Transaction currency','Transaction amount','Amount ('+data.currency+')','Status','Posting'],
   ...data.rows.flatMap(r=>r.entries.map(e=>[r.employeeName,e.date,modules[e.sourceKind]??e.sourceKind,e.sourceLabel,e.number,e.description,e.transactionCurrency,e.transactionAmount,e.amount,e.posted?'Posted':'Pending',e.postingNumber]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='employee-expenses.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="27. Employee expenses" extra={<Tag color="green">Ready</Tag>}>
  <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
   <div className="accounting-report-field">Employee<Select className="accounting-report-select" allowClear showSearch optionFilterProp="label" placeholder="All employees" style={{minWidth:220}} value={employee} onChange={setEmployee} notFoundContent="Run the report to load employees" options={employees.map(e=>({value:e.id,label:e.name+(e.number?' · '+e.number:'')}))}/></div>
   <div className="accounting-report-field">Module<Select className="accounting-report-select" style={{minWidth:150}} value={kind} onChange={setKind} options={[{value:'ALL',label:'All modules'},...Object.entries(modules).map(([value,label])=>({value,label}))]}/></div>
   <div className="accounting-report-field">Status<Select className="accounting-report-select" style={{minWidth:150}} value={status} onChange={setStatus} options={[{value:'ALL',label:'All'},{value:'POSTED',label:'Posted to ledger'},{value:'PENDING',label:'Waiting for posting'}]}/></div>
   <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
   <div className="accounting-report-field">Currency<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
   <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
  </Space>
  <Alert type="info" style={{marginBottom:16}} title="Expenses paid by each employee, from every module" description="Survey, pickup, packing and delivery expenses with a “Paid by” employee, by expense date. Includes expenses still waiting in the accountant's posting queue, so the pending amount is what has not reached the ledger yet. Expenses with no “Paid by” are not listed."/>
  {error&&<Alert type="error" title={error}/>}
  {data&&<>
   <p>{data.from} to {data.to} · {data.currency} · {data.employeeName??'All employees'} · {data.sourceKind==='ALL'?'All modules':modules[data.sourceKind]} · {data.status==='ALL'?'All':data.status==='POSTED'?'Posted':'Pending'}</p>
   {data.missingValues>0&&<Alert type="warning" showIcon style={{marginBottom:12}} title={data.missingValues+' expense(s) have no saved exchange rate and show no converted amount.'}/>}
   <DataGrid<Row> rowKey="employeeId" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:900}} locale={{emptyText:'No employee expenses in this period'}}
    expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey="expenseId" dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1100}} columns={[
     {title:'Date',dataIndex:'date'},{title:'Module',dataIndex:'sourceKind',render:v=>modules[v]??v},{title:'Job / survey',dataIndex:'sourceLabel'},{title:'Expense',dataIndex:'number'},{title:'Description',dataIndex:'description'},
     {title:'Transaction',align:'right',render:(_,e)=>formatMoney(e.transactionAmount,e.transactionCurrency)},{title:'Amount',align:'right',render:(_,e)=>e.amount==null?'—':formatMoney(e.amount,data.currency)},
     {title:'Status',render:(_,e)=>e.posted?<Tag color="green">Posted {e.postingNumber}</Tag>:<Tag color="orange">Pending</Tag>}]}/>}}
    columns={[
     {title:'Employee',render:(_,r)=><div className="primary-cell"><strong>{r.employeeName}</strong><small>{r.employeeNumber??''}</small></div>},
     {title:'By module',render:(_,r)=><Space wrap size={4}>{r.bySource.map(s=><Tag key={s.sourceKind}>{modules[s.sourceKind]} {formatMoney(s.amount,data.currency)}</Tag>)}</Space>},
     {title:'Expenses',dataIndex:'count',align:'right'},
     {title:'Posted',align:'right',render:(_,r)=>formatMoney(r.posted,data.currency)},
     {title:'Pending',align:'right',render:(_,r)=>formatMoney(r.pending,data.currency)},
     {title:'Total',align:'right',render:(_,r)=><strong>{formatMoney(r.total,data.currency)}</strong>}]}/>
   <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>Posted: {formatMoney(data.totals.posted,data.currency)}</strong><strong>Pending: {formatMoney(data.totals.pending,data.currency)}</strong><strong>Total: {formatMoney(data.totals.total,data.currency)}</strong></Space>
  </>}
 </Card>
}

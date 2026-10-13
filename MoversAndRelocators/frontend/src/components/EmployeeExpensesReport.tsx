import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {has,useT} from '../i18n'

type Entry={expenseId:string;number:string;date:string;sourceKind:string;sourceId:string;sourceLabel:string;description:string;transactionCurrency:string;transactionAmount:number;amount:number|null;posted:boolean;postingNumber:string|null}
type Row={employeeId:string;employeeNumber:string|null;employeeName:string;count:number;total:number;posted:number;pending:number;bySource:{sourceKind:string;amount:number}[];entries:Entry[]}
type Report={from:string;to:string;currency:string;employeeName:string|null;sourceKind:string;status:string;rows:Row[];missingValues:number;totals:{count:number;total:number;posted:number;pending:number};employees:{id:string;name:string;number:string}[]}

const modules=['SURVEY','PICKUP','PACKING','DELIVERY']

/** Report 27: what each employee paid on surveys, pickups, packing and deliveries in a period (the "Paid by" on each expense). */
export function EmployeeExpensesReport(){
 const {t}=useT(),k=(x:string,p?:Record<string,string|number>)=>t('reports.employeeExpenses.'+x,p),moduleLabel=(v:string)=>has('reports.employeeExpenses.modules.'+v)?k('modules.'+v):v
 const {data:currencies}=useCurrencies()
 const [from,setFrom]=useState(localDate().slice(0,8)+'01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE')
 const [employee,setEmployee]=useState<string>(),[kind,setKind]=useState('ALL'),[status,setStatus]=useState('ALL')
 const [data,setData]=useState<Report>(),[employees,setEmployees]=useState<Report['employees']>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('')
  try{const r=await request<Report>('/api/billing/reports/employee-expenses?'+new URLSearchParams({from,to,currency,sourceKind:kind,status,...(employee?{employeeId:employee}:{})}));setData(r);setEmployees(r.employees)}
  catch(e){setData(undefined);setError(e instanceof Error?e.message:k('loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.employeeExpenses'),data.from,data.to,data.currency,data.employeeName||k('allEmployees'),data.sourceKind,data.status],
   [k('columns.employeeNumber'),t('reports.filters.employee'),k('columns.expenses'),t('reports.totals.total'),t('reports.status.POSTED'),t('reports.status.PENDING')],...data.rows.map(r=>[r.employeeNumber,r.employeeName,r.count,r.total,r.posted,r.pending]),['',t('reports.totals.total'),data.totals.count,data.totals.total,data.totals.posted,data.totals.pending],[],
   [t('reports.filters.employee'),t('reports.columns.date'),k('columns.module'),k('columns.jobSurvey'),k('columns.expense'),t('reports.columns.description'),t('reports.columns.transactionCurrency'),t('reports.columns.transactionAmount'),k('columns.amountIn',{currency:data.currency}),t('reports.columns.status'),k('columns.posting')],
   ...data.rows.flatMap(r=>r.entries.map(e=>[r.employeeName,e.date,moduleLabel(e.sourceKind),e.sourceLabel,e.number,e.description,e.transactionCurrency,e.transactionAmount,e.amount,e.posted?t('reports.status.POSTED'):t('reports.status.PENDING'),e.postingNumber]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='employee-expenses.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:27,title:t('reports.names.employeeExpenses')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
  <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
   <div className="accounting-report-field">{t('reports.filters.employee')}<Select className="accounting-report-select" allowClear showSearch optionFilterProp="label" placeholder={k('allEmployees')} style={{minWidth:220}} value={employee} onChange={setEmployee} notFoundContent={k('runToLoadEmployees')} options={employees.map(e=>({value:e.id,label:e.name+(e.number?' · '+e.number:'')}))}/></div>
   <div className="accounting-report-field">{k('columns.module')}<Select className="accounting-report-select" style={{minWidth:150}} value={kind} onChange={setKind} options={[{value:'ALL',label:k('allModules')},...modules.map(value=>({value,label:moduleLabel(value)}))]}/></div>
   <div className="accounting-report-field">{t('reports.filters.status')}<Select className="accounting-report-select" style={{minWidth:150}} value={status} onChange={setStatus} options={[{value:'ALL',label:t('reports.status.ALL')},{value:'POSTED',label:k('postedToLedger')},{value:'PENDING',label:k('waitingForPosting')}]}/></div>
   <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
   <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
   <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
  </Space>
  <Alert type="info" style={{marginBottom:16}} title={k('alertTitle')} description={k('alertDescription')}/>
  {error&&<Alert type="error" title={error}/>}
  {data&&<>
   <p>{t('reports.period',{from:data.from,to:data.to})} · {data.currency} · {data.employeeName??k('allEmployees')} · {data.sourceKind==='ALL'?k('allModules'):moduleLabel(data.sourceKind)} · {data.status==='ALL'?t('reports.status.ALL'):data.status==='POSTED'?t('reports.status.POSTED'):t('reports.status.PENDING')}</p>
   {data.missingValues>0&&<Alert type="warning" showIcon style={{marginBottom:12}} title={k('missingValues',{count:data.missingValues})}/>}
   <DataGrid<Row> rowKey="employeeId" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:900}} locale={{emptyText:k('emptyText')}}
    expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey="expenseId" dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1100}} columns={[
     {title:t('reports.columns.date'),dataIndex:'date'},{title:k('columns.module'),dataIndex:'sourceKind',render:v=>moduleLabel(v)},{title:k('columns.jobSurvey'),dataIndex:'sourceLabel'},{title:k('columns.expense'),dataIndex:'number'},{title:t('reports.columns.description'),dataIndex:'description'},
     {title:k('columns.transaction'),align:'right',render:(_,e)=>formatMoney(e.transactionAmount,e.transactionCurrency)},{title:t('reports.columns.amount'),align:'right',render:(_,e)=>e.amount==null?'—':formatMoney(e.amount,data.currency)},
     {title:t('reports.columns.status'),render:(_,e)=>e.posted?<Tag color="green">{k('postedTag',{number:e.postingNumber??''})}</Tag>:<Tag color="orange">{t('reports.status.PENDING')}</Tag>}]}/>}}
    columns={[
     {title:t('reports.filters.employee'),render:(_,r)=><div className="primary-cell"><strong>{r.employeeName}</strong><small>{r.employeeNumber??''}</small></div>},
     {title:k('columns.byModule'),render:(_,r)=><Space wrap size={4}>{r.bySource.map(s=><Tag key={s.sourceKind}>{moduleLabel(s.sourceKind)} {formatMoney(s.amount,data.currency)}</Tag>)}</Space>},
     {title:k('columns.expenses'),dataIndex:'count',align:'right'},
     {title:t('reports.status.POSTED'),align:'right',render:(_,r)=>formatMoney(r.posted,data.currency)},
     {title:t('reports.status.PENDING'),align:'right',render:(_,r)=>formatMoney(r.pending,data.currency)},
     {title:t('reports.totals.total'),align:'right',render:(_,r)=><strong>{formatMoney(r.total,data.currency)}</strong>}]}/>
   <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>{k('totalPosted',{amount:formatMoney(data.totals.posted,data.currency)})}</strong><strong>{k('totalPending',{amount:formatMoney(data.totals.pending,data.currency)})}</strong><strong>{t('reports.totals.totalWithValue',{amount:formatMoney(data.totals.total,data.currency)})}</strong></Space>
  </>}
 </Card>
}

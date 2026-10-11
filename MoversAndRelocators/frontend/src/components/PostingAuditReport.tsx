import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Line={lineNumber:number;accountCode:string;accountName:string;debit:number;credit:number}
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;postedBy:string;postedByName:string;postedAtUtc:string;isReversal:boolean;reversesReference?:string;reversedBy:string[];debit:number;credit:number;lines:Line[]}
type Register={from:string;to:string;currency:string;status:string;userId?:string;userName?:string|null;document?:string;users:{id:string;name:string}[];rows:Entry[];totals:{debit:number;credit:number;count:number}}
export function PostingAuditReport(){
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[status,setStatus]=useState('ALL'),[userId,setUserId]=useState<string>(),[documentFilter,setDocument]=useState(''),[data,setData]=useState<Register>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Register>('/api/billing/reports/posting-audit?'+new URLSearchParams({from,to,currency,status,document:documentFilter,...(userId?{userId}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load journals')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Posting & reversal audit',data.from,data.to,data.currency,data.status,data.userName||"All users",data.document||"All references"],['Date','Reference','Description','Original currency','Posted by','Posted at UTC','Reversal of','Reversed by','Account','Account name','Debit','Credit'],...data.rows.flatMap(j=>j.lines.map(l=>[j.date,j.reference,j.description,j.transactionCurrency,j.postedByName,j.postedAtUtc,j.reversesReference||'',j.reversedBy.join('; '),l.accountCode,l.accountName,l.debit,l.credit])),['TOTAL','','','','','','','','','',data.totals.debit,data.totals.credit]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='posting-audit.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="26. Posting & reversal audit" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">From date<Input aria-label="Journal from date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input aria-label="Journal to date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Journal currency" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <div className="accounting-report-field">Entry type<Select className="accounting-report-select" aria-label="Journal entry type" style={{minWidth:160}} value={status} onChange={setStatus} options={[{value:'ALL',label:'All entries'},{value:'ORIGINAL',label:'Original entries'},{value:'REVERSAL',label:'Reversal entries'},{value:'REVERSED',label:'Reversed originals'},{value:'ACTIVE',label:'Unreversed originals'}]}/></div>
<div className="accounting-report-field">Posted by<Select className="accounting-report-select" allowClear showSearch placeholder="All users" value={userId} onChange={setUserId} style={{minWidth:280}} optionFilterProp="label" options={(data?.users||[]).map(u=>({value:u.id,label:u.name}))}/></div><div className="accounting-report-field">Document reference<Input value={documentFilter} onChange={e=>setDocument(e.target.value)} placeholder="Number or partial reference"/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert style={{marginBottom:16}} type="info" title="Posted journal audit" description="Filters use accounting posting dates. Posting timestamps identify when entries were recorded. User IDs are immutable audit identifiers. Reversed status and original/reversal links reflect current history, including entries outside the selected period. Draft changes, failed posting attempts and unposted cancellations are excluded." />
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Select a reporting period and run the report. Expand a journal to see its debit and credit accounts."/>}
 {data&&<><p>Posted entries · {data.from} to {data.to} · {data.currency} · {data.status}. Reversal links include entries outside this period. Posting times are shown in your local time; CSV timestamps are UTC.</p>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1200}} pagination={{pageSize:25}} expandable={{expandedRowRender:j=><div style={{padding:12}}><p>Posted by: {j.postedByName}</p><DataGrid<Line> rowKey="lineNumber" pagination={false} dataSource={j.lines} columns={[{title:'Account',dataIndex:'accountCode'},{title:'Account name',dataIndex:'accountName'},{title:'Debit',align:'right',render:(_,l)=>formatMoney(l.debit,data.currency)},{title:'Credit',align:'right',render:(_,l)=>formatMoney(l.credit,data.currency)}]}/></div>}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Description',dataIndex:'description'},{title:'Original currency',dataIndex:'transactionCurrency'},{title:'Debit',align:'right',render:(_,j)=>formatMoney(j.debit,data.currency)},{title:'Credit',align:'right',render:(_,j)=>formatMoney(j.credit,data.currency)},{title:'Posted at',dataIndex:'postedAtUtc',render:v=>new Date(v).toLocaleString()},{title:'Entry type',render:(_,j)=>j.isReversal?'Reversal':'Original'},{title:'Reversal of',dataIndex:'reversesReference'},{title:'Reversed by',render:(_,j)=>j.reversedBy.join(', ')||'—'}]}/>
 <Space wrap style={{marginTop:20,display:'flex',justifyContent:'flex-end'}}><strong>{data.totals.count} journals</strong><strong>Total debit: {formatMoney(data.totals.debit,data.currency)}</strong><strong>Total credit: {formatMoney(data.totals.credit,data.currency)}</strong></Space>
 {data.rows.some(j=>j.debit!==j.credit)&&<Alert type="error" title="An unbalanced journal was found. Review its debit and credit lines."/>}
 </>}
 </Card>
}





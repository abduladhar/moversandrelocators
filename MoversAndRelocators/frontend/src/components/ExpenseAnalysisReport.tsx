import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Account} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Entry={journalId:string;date:string;reference:string;description:string;isReversal:boolean;transactionCurrency:string;transactionDebit:number;transactionCredit:number;debit:number;credit:number;amount:number}
type Totals={debit:number;credit:number;amount:number}
type Row=Totals&{code:string;name:string;isActive:boolean;count:number;entries:Entry[]}
type Report={from:string;to:string;currency:string;mode:string;accountCode?:string;rows:Row[];totals:Totals}
export function ExpenseAnalysisReport(){
 const {data:currencies}=useCurrencies(),[accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setAccounts(c.accounts.filter(a=>a.type==='Expense'))).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/expense-analysis?'+new URLSearchParams({from,to,currency,...(account?{accountCode:account}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load expenses')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Expense analysis by account',data.from,data.to,data.currency,data.accountCode||'All expense accounts'],['Code','Account','Postings','Debit','Credit','Net expense'],...data.rows.map(r=>[r.code,r.name,r.count,r.debit,r.credit,r.amount]),['TOTAL','','',data.totals.debit,data.totals.credit,data.totals.amount],[],['Account','Date','Reference','Description','Reversal','Transaction currency','Transaction debit','Transaction credit','Report currency','Debit','Credit','Net expense'],...data.rows.flatMap(r=>r.entries.map(e=>[r.code,e.date,e.reference,e.description,e.isReversal,e.transactionCurrency,e.transactionDebit,e.transactionCredit,data.currency,e.debit,e.credit,e.amount]))]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='expense-analysis.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="21. Expense analysis by account" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">Expense account<Select className="accounting-report-select" aria-label="Expense account" allowClear showSearch optionFilterProp="label" placeholder="All expense accounts" value={account} onChange={setAccount} style={{minWidth:260}} options={accounts.map(a=>({value:a.code,label:a.code+' · '+a.name+(a.isActive?'':' (Inactive)')}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title="Posted expenses by accounting date" description="Net expense is debit less credit, including memos, reversals, manual journals and closing entries posted in the period. Draft charges and bills are excluded. Inactive accounts with history remain visible. Base currency uses saved historical journal values."/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{data.from} to {data.to} · {data.currency} · {data.accountCode||'All expense accounts'}</p>
 <DataGrid<Row> rowKey="code" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:850}} expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey="journalId" dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1300}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Description',dataIndex:'description'},{title:'Type',render:(_,e)=>e.isReversal?'Reversal':'Posting'},{title:'Transaction debit',align:'right',render:(_,e)=>formatMoney(e.transactionDebit,e.transactionCurrency)},{title:'Transaction credit',align:'right',render:(_,e)=>formatMoney(e.transactionCredit,e.transactionCurrency)},...(['debit','credit','amount'] as const).map((k,i)=>({title:['Debit','Credit','Net expense'][i],align:'right' as const,render:(_:unknown,e:Entry)=>formatMoney(e[k],data.currency)}))]}/>}} columns={[{title:'Code',dataIndex:'code'},{title:'Account',dataIndex:'name'},{title:'Postings',dataIndex:'count'},...(['debit','credit','amount'] as const).map((k,i)=>({title:['Debit','Credit','Net expense'][i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[k],data.currency)}))]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>Debit: {formatMoney(data.totals.debit,data.currency)}</strong><strong>Credit: {formatMoney(data.totals.credit,data.currency)}</strong><strong>Net expense: {formatMoney(data.totals.amount,data.currency)}</strong></Space></>}
 </Card>
}



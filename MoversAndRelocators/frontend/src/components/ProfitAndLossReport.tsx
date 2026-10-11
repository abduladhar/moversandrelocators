import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Row={code:string;name:string;type:string;debit:number;credit:number;amount:number}
type Report={from:string;to:string;currency:string;mode:string;rows:Row[];revenue:number;expenses:number;netProfit:number}
export function ProfitAndLossReport(){
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/profit-and-loss?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load profit and loss')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Profit and loss',data.from,data.to,data.currency,data.mode],['Type','Account','Account name','Debit','Credit','Net amount'],...data.rows.map(r=>[r.type,r.code,r.name,r.debit,r.credit,r.amount]),['Total revenue','','','','',data.revenue],['Total expenses','','','','',data.expenses],['Net profit / (loss)','','','','',data.netProfit]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='profit-and-loss.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="4. Profit and loss" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">From date<Input aria-label="Profit and loss from date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input aria-label="Profit and loss to date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Profit and loss currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Select a reporting period and run the report."/>}
 {data&&<><p>{data.from} to {data.to} · {data.currency} · {data.mode==='BASE'?'Consolidated accounting base':data.mode==='DEFAULT'?'Accounting base translated to the default transaction currency at the report-date rate':'Selected transaction currency only'}. Posted revenue and expenses, including memo adjustments and reversals. Drafts and unposted operational costs are excluded.</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}}>
 {[['Revenue',data.revenue],['Expenses',data.expenses],[data.netProfit<0?'Net loss':'Net profit',data.netProfit]] .map(([label,value])=><Card size="small" key={label}><span>{label}</span><h2 style={{color:Number(value)<0?'#b42318':'#196746'}}>{formatMoney(Number(value),data.currency)}</h2></Card>)}
 </div>
 {['Revenue','Expense'].map(type=><section key={type} style={{marginBottom:24}}><h3>{type==='Revenue'?'Revenue':'Expenses'}</h3><DataGrid<Row> rowKey="code" dataSource={data.rows.filter(r=>r.type===type)} pagination={false} scroll={{x:700}} columns={[{title:'Account',dataIndex:'code'},{title:'Account name',dataIndex:'name'},{title:'Debit',align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:'Credit',align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:'Net amount',align:'right',render:(_,r)=>formatMoney(r.amount,data.currency)}]}/><p style={{textAlign:'right',fontWeight:600}}>Total {type==='Revenue'?'revenue':'expenses'}: {formatMoney(type==='Revenue'?data.revenue:data.expenses,data.currency)}</p></section>)}
 </>}
 </Card>
}



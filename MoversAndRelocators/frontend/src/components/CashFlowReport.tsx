import {useContext,useState} from 'react'
import {Alert,Button,Card,Input,Modal,Select,Space,Tag,message} from 'antd'
import {request} from '../api'
import {BillingPermissions,billingApi} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Row={journalId:string;date:string;reference:string;transactionCurrency:string;category:string;counterpartAccounts:string[];cashAccounts:string[];inflow:number;outflow:number;net:number;isReversal:boolean;warning?:string}
type Report={from:string;to:string;currency:string;opening:number;closing:number;netMovement:number;difference:number;isReconciled:boolean;unclassifiedCount:number;classificationComplete:boolean;categories:{category:string;net:number}[];rows:Row[]}
type Mapping={code:string;name:string;type:string;category:string}
export function CashFlowReport(){
 const {data:currencies}=useCurrencies(),permissions=useContext(BillingPermissions)
 const [from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const [mappings,setMappings]=useState<Mapping[]>([]),[open,setOpen]=useState(false),[saving,setSaving]=useState(false)
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/cash-flow?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load cash flow')}finally{setLoading(false)}}
 const showMappings=async()=>{try{setMappings(await request<Mapping[]>('/api/billing/reports/cash-flow/mappings'));setOpen(true)}catch(e){message.error(e instanceof Error?e.message:'Unable to load mappings')}}
 const saveMapping=async(accountCode:string,category:string)=>{setSaving(true);try{await billingApi.save('reports/cash-flow/mappings',{accountCode,category});setMappings(old=>old.map(m=>m.code===accountCode?{...m,category}:m));setData(undefined);message.success('Mapping saved. Run the report again.')}catch(e){message.error(e instanceof Error?e.message:'Unable to save mapping')}finally{setSaving(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Cash flow statement',data.from,data.to,data.currency],['Opening cash',data.opening],...data.categories.map(c=>[c.category,c.net]),['Net movement',data.netMovement],['Closing cash',data.closing],['Reconciliation difference',data.difference],['Classification complete',data.classificationComplete?'Yes':'No'],['Date','Reference','Category','Original currency','Cash accounts','Counterpart accounts','Inflow','Outflow','Net','Reversal','Review'],...data.rows.map(r=>[r.date,r.reference,r.category,r.transactionCurrency,r.cashAccounts.join('; '),r.counterpartAccounts.join('; '),r.inflow,r.outflow,r.net,r.isReversal?'Yes':'No',r.warning||''])]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='cash-flow.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="6. Cash flow statement" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">From date<Input aria-label="Cash flow from date" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input aria-label="Cash flow to date" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Cash flow currency" value={currency} onChange={setCurrency} style={{minWidth:240}} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button><Button onClick={()=>void showMappings()}>Account classifications</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Run the report to see posted cash and bank movements." description="Classification uses the counterpart account mappings. Unclassified or mixed activities need review. Cash transfers are excluded from activity totals."/>}
 {data&&<><p>{data.from} to {data.to} · {data.currency}. Includes accounts marked Cash / bank in the chart of accounts, posted entries and reversals. A transaction-currency view includes only journals in that currency.</p>
 <Alert style={{marginBottom:16}} type={data.isReconciled?'success':'error'} title={data.isReconciled?'Opening cash + movements = closing cash':'Cash reconciliation difference'} description={'Difference: '+formatMoney(data.difference,data.currency)}/>
 {!data.classificationComplete&&<Alert style={{marginBottom:16}} type="warning" title={data.unclassifiedCount+' movements need classification review'} description="Cash balances reconcile independently of classification. Assign account classifications; split journals containing multiple activity categories before treating the classification as complete."/>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:20}}>{[{category:'Opening cash',net:data.opening},...data.categories,{category:'Net movement',net:data.netMovement},{category:'Closing cash',net:data.closing}].map(c=><Card size="small" key={c.category}><small>{c.category}</small><h3>{formatMoney(c.net,data.currency)}</h3></Card>)}</div>
 <DataGrid<Row> rowKey="journalId" dataSource={data.rows} scroll={{x:1200}} pagination={{pageSize:25}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Activity',dataIndex:'category'},{title:'Cash accounts',render:(_,r)=>r.cashAccounts.join(', ')},{title:'Counterpart accounts',render:(_,r)=>r.counterpartAccounts.join(', ')},{title:'Inflow',align:'right',render:(_,r)=>formatMoney(r.inflow,data.currency)},{title:'Outflow',align:'right',render:(_,r)=>formatMoney(r.outflow,data.currency)},{title:'Net movement',align:'right',render:(_,r)=>formatMoney(r.net,data.currency)},{title:'Reversal',render:(_,r)=>r.isReversal?'Yes':'—'},{title:'Review',dataIndex:'warning'}]}/>
 </>}
 <Modal centered width={850} title="Cash-flow account classifications" open={open} onCancel={()=>!saving&&setOpen(false)} footer={<Button disabled={saving} onClick={()=>setOpen(false)}>Close</Button>}>
 <Alert style={{marginBottom:16}} type="info" title="Map non-cash accounts to activities" description="Mappings apply when running reports, including historical periods. Cash and bank accounts are maintained in the chart of accounts. Opening funding and custom assets/liabilities remain unclassified until reviewed."/>
 <DataGrid<Mapping> rowKey="code" dataSource={mappings} pagination={{pageSize:8}} columns={[{title:'Code',dataIndex:'code'},{title:'Account',dataIndex:'name'},{title:'Type',dataIndex:'type'},{title:'Activity',render:(_,m)=><Select className="accounting-report-select" aria-label={'Cash flow category for '+m.code} style={{width:160}} disabled={saving||!permissions.includes('billing.accounts')} value={m.category} onChange={v=>void saveMapping(m.code,v)} options={['Operating','Investing','Financing','Exchange','Unclassified'].map(value=>({value,label:value}))}/>} ]}/>
 </Modal>
 </Card>
}



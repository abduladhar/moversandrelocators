import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Account} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;debit:number;credit:number;balance:number;isReversal:boolean;isTransfer:boolean;counterpartAccounts:string[]}
type Ledger={from:string;to:string;currency:string;account:Account;opening:number;debit:number;credit:number;closing:number;rows:Entry[]}
export function TaxSummaryReport(){
 const cashBook=false
 const title=cashBook?'Cash book & bank book':'Tax summary',debitLabel=cashBook?'Receipts (debit)':'Debit',creditLabel=cashBook?'Payments (credit)':'Credit'
 const {data:currencies}=useCurrencies(),[accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState(cashBook?'1000':'2200'),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Ledger>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setAccounts(c.accounts.filter(a=>a.code==="2200"))).catch(e=>setError(e.message))},[cashBook])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Ledger>('/api/billing/reports/'+(cashBook?'cash-book':'tax-summary')+'?'+new URLSearchParams({from,to,currency,accountCode:account})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load ledger')}finally{setLoading(false)}}
 const balance=(v:number)=>formatMoney(Math.abs(v),data?.currency||'USD')+(v<0?' Cr':v>0?' Dr':'')
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[title,data.account.code,data.account.name,data.from,data.to,data.currency],['Opening balance',data.opening],['Date','Reference','Description','Transaction currency',debitLabel,creditLabel,'Running balance (debit positive)','Reversal','Cash/bank transfer','Counterpart accounts'],...data.rows.map(r=>[r.date,r.reference,r.description,r.transactionCurrency,r.debit,r.credit,r.balance,r.isReversal?'Yes':'No',r.isTransfer?'Yes':'No',r.counterpartAccounts.join('; ')]),['Period totals','','','',data.debit,data.credit],['Closing balance',data.closing]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=(cashBook?'cash-book-':'tax-summary-')+data.account.code+'.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={(cashBook?'7. ':'25. ')+title} extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{cashBook?'Cash / bank account':'Account'}<Select className="accounting-report-select" aria-label="Ledger account" showSearch optionFilterProp="label" value={account} style={{minWidth:270}} onChange={setAccount} options={accounts.map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></div>
 <div className="accounting-report-field">From date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">To date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Ledger currency" style={{minWidth:220}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button>
 </Space>
 <Alert style={{marginBottom:16}} type="info" title="Tax payable accounting summary · account 2200" description="Opening balance, posted debits and credits, and closing balance. A credit balance is a tax liability. Invoice and bill tax codes, rates, taxable amounts and input/output tax classifications are not recorded yet, so this is not a tax return. Debits are not automatically input tax and credits are not automatically output tax. Custom tax accounts are not included." />
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Select an account and period, then run the report."/>}
 {data&&<><p>{data.account.code} · {data.account.name} · {data.from} to {data.to} · {data.currency}. Posted entries only, including memos and reversals. Each row shows the account movement within one journal. {cashBook&&'Transfers appear as payments in the sending account and receipts in the receiving account. Credit closing balances are shown as Cr.'}</p><h3>Opening balance: {balance(data.opening)}</h3>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1100}} pagination={{pageSize:25}} columns={[{title:'Date',dataIndex:'date'},{title:'Reference',dataIndex:'reference'},{title:'Description',dataIndex:'description'},{title:'Original currency',dataIndex:'transactionCurrency'},{title:debitLabel,align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:creditLabel,align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:'Running balance',align:'right',render:(_,r)=>balance(r.balance)},{title:'Counterpart accounts',render:(_,r)=>r.counterpartAccounts.join(', ')},{title:'Transfer',render:(_,r)=>r.isTransfer?'Yes':'—'},{title:'Reversal',dataIndex:'isReversal',render:v=>v?'Yes':'—'}]}/>
 <Space wrap style={{marginTop:20,display:'flex',justifyContent:'flex-end'}}><strong>{debitLabel}: {formatMoney(data.debit,data.currency)}</strong><strong>{creditLabel}: {formatMoney(data.credit,data.currency)}</strong><strong>Closing: {balance(data.closing)}</strong></Space></>}
 </Card>
}





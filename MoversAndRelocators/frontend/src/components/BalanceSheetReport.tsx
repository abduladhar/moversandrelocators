import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
type Row={code:string;name:string;type:string;amount:number}
type Report={date:string;currency:string;mode:string;rows:Row[];assets:number;liabilities:number;recordedEquity:number;accumulatedEarnings:number;equity:number;liabilitiesAndEquity:number;difference:number;isBalanced:boolean}
export function BalanceSheetReport(){
 const {data:currencies}=useCurrencies(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/balance-sheet?'+new URLSearchParams({date,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:'Unable to load balance sheet')}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[['Balance sheet',data.date,data.currency,data.mode],['Section','Account','Account name','Amount'],...data.rows.map(r=>[r.type,r.code,r.name,r.amount]),['Equity','','Accumulated unclosed earnings',data.accumulatedEarnings],['Total assets','','',data.assets],['Total liabilities','','',data.liabilities],['Total equity including earnings','','',data.equity],['Liabilities and equity','','',data.liabilitiesAndEquity],['Difference','','',data.difference]]
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='balance-sheet.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title="5. Balance sheet" extra={<Tag color="green">Ready</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">As-of date<Input aria-label="Balance sheet as-of date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">Currency<Select className="accounting-report-select" aria-label="Balance sheet currency" style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:'Accounting base · '+(currencies?.baseCurrency||'…')},{value:'DEFAULT',label:'Default transaction currency · '+(currencies?.settings.defaultCurrency||'…')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:c.code+' · Transactions only'}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>Run report</Button><Button disabled={!data||loading} onClick={exportCsv}>Export CSV</Button></Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title="Select an as-of date and run the report."/>}
 {data&&<><p>As of {data.date} · {data.currency} · {data.mode==='BASE'?'Consolidated accounting base':data.mode==='DEFAULT'?'Accounting base translated to the default transaction currency at the report-date rate':'Selected transaction currency only'}. Includes all posted entries through this date, including memos and reversals. Drafts are excluded.</p>
 <Alert style={{marginBottom:20}} showIcon type={data.isBalanced?'success':'error'} title={data.isBalanced?'Assets equal liabilities and equity':'Balance sheet does not balance'} description={'Difference: '+formatMoney(data.difference,data.currency)}/>
 {['Asset','Liability','Equity'].map(type=><section key={type} style={{marginBottom:24}}><h3>{type==='Asset'?'Assets':type==='Liability'?'Liabilities':'Equity'}</h3>
 <DataGrid<Row> rowKey="code" pagination={false} dataSource={data.rows.filter(r=>r.type===type)} columns={[{title:'Account',dataIndex:'code'},{title:'Account name',dataIndex:'name'},{title:'Amount',align:'right',render:(_,r)=>formatMoney(r.amount,data.currency)}]}/>
 {type==='Equity'&&<p style={{textAlign:'right'}}>Accumulated unclosed earnings: <strong>{formatMoney(data.accumulatedEarnings,data.currency)}</strong></p>}
 <p style={{textAlign:'right',fontWeight:600}}>Total: {formatMoney(type==='Asset'?data.assets:type==='Liability'?data.liabilities:data.equity,data.currency)}</p></section>)}
 <p>Accumulated earnings include revenue and expense balances not yet closed to equity. Amounts already transferred to equity are included in their equity accounts.</p>
 <Space wrap style={{display:'flex',justifyContent:'flex-end'}}><strong>Assets: {formatMoney(data.assets,data.currency)}</strong><strong>Liabilities + equity: {formatMoney(data.liabilitiesAndEquity,data.currency)}</strong></Space>
 </>}
 </Card>
}



import {useEffect,useState} from 'react'
import {Alert,Button,Input,Select,Space,message} from 'antd'
import {request} from '../api'
import {formatMoney,localDate,useCurrencies} from '../currency'
import {DataGrid} from './DataGrid'
type Row={partyCurrency:string;partyAmount?:number;partyBalance?:number;partyWarning?:string;number:string;type:string;partyName:string;date:string;transactionCurrency:string;transactionAmount:number;baseAmount?:number;baseCurrency:string;reportCurrency:string;reportAmount?:number;balance?:number;warning?:string}
export function CurrencyReport({sourceKind,sourceId}:{sourceKind?:string;sourceId?:string}){
 const {data:currencyData}=useCurrencies()
 const [mode,setMode]=useState('BASE'),[date,setDate]=useState(localDate()),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);try{const r=await request<{rows:Row[]}>('/api/billing/currency-report?'+new URLSearchParams({mode,date,...(sourceId?{sourceKind:sourceKind!,sourceId}:{})}));setRows(r.rows);setError('')}catch(e){setRows([]);setError(e instanceof Error?e.message:'Unable to load report')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[mode,date,sourceKind,sourceId])
 const exportCsv=()=>{
  if(!rows.length){message.info('No rows to export');return}
  const keys=(Object.keys(rows[0]) as (keyof Row)[]),cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"'
  const blob=new Blob(['\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='financial-report-'+mode+'-'+date+'.csv';a.click();URL.revokeObjectURL(url)
 }
 return <>
 <Alert type="info" title="Financial currency report" description="Base values use saved transaction rates. Party-currency values convert those base amounts using the rate effective on the selected conversion date. Missing historical rates are shown explicitly; currencies are never added together."/>
 <Space wrap style={{margin:'16px 0'}}><Select aria-label="Report currency" value={mode} onChange={setMode} options={[{value:'BASE',label:'Base currency · '+(currencyData?.baseCurrency||'…')},{value:'PARTY',label:'Customer / vendor currency'},{value:'TRANSACTION',label:'Transaction currency'}]}/><Input aria-label="Conversion date" type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button loading={loading} onClick={()=>void load()}>Refresh report</Button><Button onClick={exportCsv}>Export CSV</Button></Space>
 {error&&<Alert type="error" title={error}/>}
 <DataGrid<Row> rowKey="number" dataSource={rows} loading={loading} scroll={{x:1200}} columns={[{title:'Number',dataIndex:'number'},{title:'Type',dataIndex:'type'},{title:'Customer / vendor',dataIndex:'partyName'},{title:'Date',dataIndex:'date'},{title:'Transaction amount',align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:'Customer / vendor amount',align:'right',render:(_,r)=>r.partyWarning||formatMoney(r.partyAmount,r.partyCurrency)},{title:'Customer / vendor balance',align:'right',render:(_,r)=>r.partyBalance==null?'—':formatMoney(r.partyBalance,r.partyCurrency)},{title:'Base amount',align:'right',render:(_,r)=>formatMoney(r.baseAmount,r.baseCurrency)},{title:'Report amount',align:'right',render:(_,r)=>formatMoney(r.reportAmount,r.reportCurrency)},{title:'Balance',align:'right',render:(_,r)=>r.balance==null?'—':formatMoney(r.balance,r.reportCurrency)},{title:'Rate warning',dataIndex:'warning'}]}/>
 </>
}



import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Account} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT} from '../i18n'
type Entry={journalId:string;date:string;reference:string;description:string;isReversal:boolean;transactionCurrency:string;transactionDebit:number;transactionCredit:number;debit:number;credit:number;amount:number}
type Totals={debit:number;credit:number;amount:number}
type Row=Totals&{code:string;name:string;isActive:boolean;count:number;entries:Entry[]}
type Report={from:string;to:string;currency:string;mode:string;accountCode?:string;rows:Row[];totals:Totals}
export function RevenueAnalysisReport(){
 const {t}=useT(),k=(x:string,p?:Record<string,string|number>)=>t('reports.revenueAnalysis.'+x,p),amountTitles=[t('reports.columns.debit'),t('reports.columns.credit'),k('netRevenue')]
 const {data:currencies}=useCurrencies(),[accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setAccounts(c.accounts.filter(a=>a.type==='Revenue'))).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/revenue-analysis?'+new URLSearchParams({from,to,currency,...(account?{accountCode:account}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:k('loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.revenueAnalysis'),data.from,data.to,data.currency,data.accountCode||k('allRevenueAccounts')],[t('reports.columns.code'),t('reports.columns.account'),t('reports.columns.postings'),...amountTitles],...data.rows.map(r=>[r.code,r.name,r.count,r.debit,r.credit,r.amount]),[t('reports.totals.total'),'','',data.totals.debit,data.totals.credit,data.totals.amount],[],[t('reports.columns.account'),t('reports.columns.date'),t('reports.columns.reference'),t('reports.columns.description'),t('reports.columns.reversal'),t('reports.columns.transactionCurrency'),t('reports.columns.transactionDebit'),t('reports.columns.transactionCredit'),t('reports.columns.reportCurrency'),...amountTitles],...data.rows.flatMap(r=>r.entries.map(e=>[r.code,e.date,e.reference,e.description,e.isReversal,e.transactionCurrency,e.transactionDebit,e.transactionCredit,data.currency,e.debit,e.credit,e.amount]))]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='revenue-analysis.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:22,title:t('reports.names.revenueAnalysis')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{k('revenueAccount')}<Select className="accounting-report-select" aria-label={k('revenueAccount')} allowClear showSearch optionFilterProp="label" placeholder={k('allRevenueAccounts')} value={account} onChange={setAccount} style={{minWidth:260}} options={accounts.map(a=>({value:a.code,label:a.isActive?a.code+' · '+a.name:k('inactiveAccount',{account:a.code+' · '+a.name})}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={k('alertTitle')} description={k('alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.period',{from:data.from,to:data.to})} · {data.currency} · {data.accountCode||k('allRevenueAccounts')}</p>
 <DataGrid<Row> rowKey="code" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:850}} expandable={{expandedRowRender:r=><DataGrid<Entry> rowKey="journalId" dataSource={r.entries} pagination={{pageSize:10}} scroll={{x:1300}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.description'),dataIndex:'description'},{title:t('reports.columns.type'),render:(_,e)=>e.isReversal?t('reports.columns.reversal'):k('posting')},{title:t('reports.columns.transactionDebit'),align:'right',render:(_,e)=>formatMoney(e.transactionDebit,e.transactionCurrency)},{title:t('reports.columns.transactionCredit'),align:'right',render:(_,e)=>formatMoney(e.transactionCredit,e.transactionCurrency)},...(['debit','credit','amount'] as const).map((x,i)=>({title:amountTitles[i],align:'right' as const,render:(_:unknown,e:Entry)=>formatMoney(e[x],data.currency)}))]}/>}} columns={[{title:t('reports.columns.code'),dataIndex:'code'},{title:t('reports.columns.account'),dataIndex:'name'},{title:t('reports.columns.postings'),dataIndex:'count'},...(['debit','credit','amount'] as const).map((x,i)=>({title:amountTitles[i],align:'right' as const,render:(_:unknown,r:Row)=>formatMoney(r[x],data.currency)}))]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>{k('totalDebit',{amount:formatMoney(data.totals.debit,data.currency)})}</strong><strong>{k('totalCredit',{amount:formatMoney(data.totals.credit,data.currency)})}</strong><strong>{k('totalNet',{amount:formatMoney(data.totals.amount,data.currency)})}</strong></Space></>}
 </Card>
}

import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT} from '../i18n'
type Row={code:string;name:string;type:string;debit:number;credit:number;amount:number}
type Report={from:string;to:string;currency:string;mode:string;rows:Row[];revenue:number;expenses:number;netProfit:number}
export function ProfitAndLossReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/profit-and-loss?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.profitAndLoss.loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.profitAndLoss'),data.from,data.to,data.currency,data.mode],[t('reports.columns.type'),t('reports.columns.account'),t('reports.columns.accountName'),t('reports.columns.debit'),t('reports.columns.credit'),t('reports.profitAndLoss.netAmount')],...data.rows.map(r=>[r.type,r.code,r.name,r.debit,r.credit,r.amount]),[t('reports.profitAndLoss.totalRevenue'),'','','','',data.revenue],[t('reports.profitAndLoss.totalExpenses'),'','','','',data.expenses],[t('reports.profitAndLoss.netProfitLoss'),'','','','',data.netProfit]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='profit-and-loss.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:4,title:t('reports.names.profitAndLoss')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input aria-label={t('reports.profitAndLoss.fromAria')} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input aria-label={t('reports.profitAndLoss.toAria')} type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.profitAndLoss.currencyAria')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.profitAndLoss.empty')}/>}
 {data&&<><p>{t('reports.profitAndLoss.summary',{period:t('reports.period',{from:data.from,to:data.to}),currency:data.currency,mode:t(data.mode==='BASE'?'reports.profitAndLoss.modeBase':data.mode==='DEFAULT'?'reports.profitAndLoss.modeDefault':'reports.profitAndLoss.modeTransaction')})}</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16,marginBottom:24}}>
 {([['revenue',t('reports.columns.revenue'),data.revenue],['expenses',t('reports.profitAndLoss.expenses'),data.expenses],['net',t(data.netProfit<0?'reports.profitAndLoss.netLoss':'reports.profitAndLoss.netProfit'),data.netProfit]] as const).map(([key,label,value])=><Card size="small" key={key}><span>{label}</span><h2 style={{color:Number(value)<0?'#b42318':'#196746'}}>{formatMoney(Number(value),data.currency)}</h2></Card>)}
 </div>
 {['Revenue','Expense'].map(type=><section key={type} style={{marginBottom:24}}><h3>{type==='Revenue'?t('reports.columns.revenue'):t('reports.profitAndLoss.expenses')}</h3><DataGrid<Row> rowKey="code" dataSource={data.rows.filter(r=>r.type===type)} pagination={false} scroll={{x:700}} columns={[{title:t('reports.columns.account'),dataIndex:'code'},{title:t('reports.columns.accountName'),dataIndex:'name'},{title:t('reports.columns.debit'),align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:t('reports.columns.credit'),align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:t('reports.profitAndLoss.netAmount'),align:'right',render:(_,r)=>formatMoney(r.amount,data.currency)}]}/><p style={{textAlign:'end',fontWeight:600}}>{t('reports.generalLedger.labelValue',{label:t(type==='Revenue'?'reports.profitAndLoss.totalRevenue':'reports.profitAndLoss.totalExpenses'),amount:formatMoney(type==='Revenue'?data.revenue:data.expenses,data.currency)})}</p></section>)}
 </>}
 </Card>
}

import {useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {has,useT} from '../i18n'
type Row={code:string;name:string;type:string;amount:number}
type Report={date:string;currency:string;mode:string;rows:Row[];assets:number;liabilities:number;recordedEquity:number;accumulatedEarnings:number;equity:number;liabilitiesAndEquity:number;difference:number;isBalanced:boolean}
export function BalanceSheetReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/balance-sheet?'+new URLSearchParams({date,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 const section=(type:string)=>t(type==='Asset'?'reports.balanceSheet.assets':type==='Liability'?'reports.balanceSheet.liabilities':'reports.balanceSheet.equity')
 const typeLabel=(type:string)=>has('reports.accountTypes.'+type)?t('reports.accountTypes.'+type):type
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.balanceSheet'),data.date,data.currency,data.mode],[t('reports.balanceSheet.section'),t('reports.columns.account'),t('reports.columns.accountName'),t('reports.columns.amount')],...data.rows.map(r=>[typeLabel(r.type),r.code,r.name,r.amount]),[section('Equity'),'',t('reports.balanceSheet.accumulatedEarnings'),data.accumulatedEarnings],[t('reports.balanceSheet.totalAssets'),'','',data.assets],[t('reports.balanceSheet.totalLiabilities'),'','',data.liabilities],[t('reports.balanceSheet.totalEquity'),'','',data.equity],[t('reports.balanceSheet.liabilitiesAndEquity'),'','',data.liabilitiesAndEquity],[t('reports.balanceSheet.difference'),'','',data.difference]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='balance-sheet.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:5,title:t('reports.names.balanceSheet')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t('reports.balanceSheet.dateAria')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.balanceSheet.currencyAria')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button></Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.balanceSheet.selectDate')}/>}
 {data&&<><p>{t('reports.balanceSheet.summary',{date:data.date,currency:data.currency,mode:data.mode==='BASE'?t('reports.balanceSheet.modeBase'):data.mode==='DEFAULT'?t('reports.balanceSheet.modeDefault'):t('reports.balanceSheet.modeTransaction')})}</p>
 <Alert style={{marginBottom:20}} showIcon type={data.isBalanced?'success':'error'} title={data.isBalanced?t('reports.balanceSheet.balanced'):t('reports.balanceSheet.notBalanced')} description={t('reports.balanceSheet.differenceValue',{amount:formatMoney(data.difference,data.currency)})}/>
 {['Asset','Liability','Equity'].map(type=><section key={type} style={{marginBottom:24}}><h3>{section(type)}</h3>
 <DataGrid<Row> rowKey="code" pagination={false} dataSource={data.rows.filter(r=>r.type===type)} columns={[{title:t('reports.columns.account'),dataIndex:'code'},{title:t('reports.columns.accountName'),dataIndex:'name'},{title:t('reports.columns.amount'),align:'right',render:(_,r)=>formatMoney(r.amount,data.currency)}]}/>
 {type==='Equity'&&<p style={{textAlign:'end'}}>{t('reports.balanceSheet.accumulatedEarnings')}: <strong>{formatMoney(data.accumulatedEarnings,data.currency)}</strong></p>}
 <p style={{textAlign:'end',fontWeight:600}}>{t('reports.totals.totalWithValue',{amount:formatMoney(type==='Asset'?data.assets:type==='Liability'?data.liabilities:data.equity,data.currency)})}</p></section>)}
 <p>{t('reports.balanceSheet.earningsNote')}</p>
 <Space wrap style={{display:'flex',justifyContent:'flex-end'}}><strong>{t('reports.balanceSheet.assetsValue',{amount:formatMoney(data.assets,data.currency)})}</strong><strong>{t('reports.balanceSheet.liabilitiesEquityValue',{amount:formatMoney(data.liabilitiesAndEquity,data.currency)})}</strong></Space>
 </>}
 </Card>
}

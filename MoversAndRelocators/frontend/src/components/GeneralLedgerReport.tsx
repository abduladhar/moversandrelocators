import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Account} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT} from '../i18n'
type Entry={journalId:string;date:string;reference:string;description:string;transactionCurrency:string;debit:number;credit:number;balance:number;isReversal:boolean;isTransfer:boolean;counterpartAccounts:string[]}
type Ledger={from:string;to:string;currency:string;account:Account;opening:number;debit:number;credit:number;closing:number;rows:Entry[]}
export function GeneralLedgerReport({cashBook=false}:{cashBook?:boolean}){
 const {t}=useT()
 const title=t(cashBook?'reports.names.cashBook':'reports.names.generalLedger'),debitLabel=t(cashBook?'reports.generalLedger.receiptsDebit':'reports.columns.debit'),creditLabel=t(cashBook?'reports.generalLedger.paymentsCredit':'reports.columns.credit')
 const {data:currencies}=useCurrencies(),[accounts,setAccounts]=useState<Account[]>([]),[account,setAccount]=useState(cashBook?'1000':'1100'),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Ledger>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setAccounts(c.accounts.filter(a=>!cashBook||a.isCashBank))).catch(e=>setError(e.message))},[cashBook])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Ledger>('/api/billing/reports/'+(cashBook?'cash-book':'general-ledger')+'?'+new URLSearchParams({from,to,currency,accountCode:account})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.generalLedger.loadError'))}finally{setLoading(false)}}
 const balance=(v:number)=>{const amount=formatMoney(Math.abs(v),data?.currency||'USD');return v<0?t('reports.generalLedger.cr',{amount}):v>0?t('reports.generalLedger.dr',{amount}):amount}
 const exportCsv=()=>{
  if(!data)return
  const esc=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const yn=(v:boolean)=>v?t('common.yes'):t('common.no')
  const rows=[[title,data.account.code,data.account.name,data.from,data.to,data.currency],[t('reports.generalLedger.openingBalance'),data.opening],[t('reports.columns.date'),t('reports.columns.reference'),t('reports.columns.description'),t('reports.columns.transactionCurrency'),debitLabel,creditLabel,t('reports.generalLedger.runningBalanceDebitPositive'),t('reports.columns.reversal'),t('reports.generalLedger.cashBankTransfer'),t('reports.columns.counterpartAccounts')],...data.rows.map(r=>[r.date,r.reference,r.description,r.transactionCurrency,r.debit,r.credit,r.balance,yn(r.isReversal),yn(r.isTransfer),r.counterpartAccounts.join('; ')]),[t('reports.generalLedger.periodTotals'),'','','',data.debit,data.credit],[t('reports.generalLedger.closingBalance'),data.closing]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=(cashBook?'cash-book-':'general-ledger-')+data.account.code+'.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:cashBook?7:2,title})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t(cashBook?'reports.filters.cashBankAccount':'reports.filters.account')}<Select className="accounting-report-select" aria-label={t('reports.generalLedger.accountAria')} showSearch optionFilterProp="label" value={account} style={{minWidth:270}} onChange={setAccount} options={accounts.map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.generalLedger.currencyAria')} style={{minWidth:220}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.generalLedger.empty')}/>}
 {data&&<><p>{t('reports.generalLedger.summary',{code:data.account.code,name:data.account.name,period:t('reports.period',{from:data.from,to:data.to}),currency:data.currency})} {cashBook&&t('reports.generalLedger.cashBookNote')}</p><h3>{t('reports.generalLedger.labelValue',{label:t('reports.generalLedger.openingBalance'),amount:balance(data.opening)})}</h3>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1100}} pagination={{pageSize:25}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.description'),dataIndex:'description'},{title:t('reports.columns.originalCurrency'),dataIndex:'transactionCurrency'},{title:debitLabel,align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:creditLabel,align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:t('reports.columns.runningBalance'),align:'right',render:(_,r)=>balance(r.balance)},{title:t('reports.columns.counterpartAccounts'),render:(_,r)=>r.counterpartAccounts.join(', ')},{title:t('reports.columns.transfer'),render:(_,r)=>r.isTransfer?t('common.yes'):'—'},{title:t('reports.columns.reversal'),dataIndex:'isReversal',render:v=>v?t('common.yes'):'—'}]}/>
 <Space wrap style={{marginTop:20,display:'flex',justifyContent:'flex-end'}}><strong>{t('reports.generalLedger.labelValue',{label:debitLabel,amount:formatMoney(data.debit,data.currency)})}</strong><strong>{t('reports.generalLedger.labelValue',{label:creditLabel,amount:formatMoney(data.credit,data.currency)})}</strong><strong>{t('reports.generalLedger.closing',{amount:balance(data.closing)})}</strong></Space></>}
 </Card>
}

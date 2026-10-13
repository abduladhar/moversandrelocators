import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {useT} from '../i18n'
type Entry={journalId:string;date:string;type:string;number:string;originalNumber:string;reference?:string;transactionCurrency:string;transactionDebit:number;transactionCredit:number;debit:number;credit:number;balance:number;isReversal:boolean;controlAccounts:string[]}
type Statement={from:string;to:string;currency:string;mode:string;vendor:{code:string;name:string;address?:string};conversionDate?:string;opening:number;debit:number;credit:number;closing:number;rows:Entry[]}
export function VendorStatementReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[vendors,setVendors]=useState<Party[]>([]),[vendor,setVendor]=useState<string>(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('VENDOR'),[data,setData]=useState<Statement>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setVendors(c.vendors)).catch(e=>setError(e.message))},[])
 const load=async()=>{if(!vendor){setError(t('reports.vendorStatement.selectVendor'));return}setLoading(true);setError('');try{setData(await request<Statement>('/api/billing/reports/vendor-statement?'+new URLSearchParams({from,to,currency,vendorCode:vendor})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.customerStatement.loadError'))}finally{setLoading(false)}}
 const balance=(n:number)=>{const amount=formatMoney(Math.abs(n),data?.currency||'USD');return n<0?t('reports.generalLedger.dr',{amount}):n>0?t('reports.generalLedger.cr',{amount}):amount}
 const lv=(label:string,amount:string)=>t('reports.generalLedger.labelValue',{label,amount})
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.vendorStatement'),data.vendor.code,data.vendor.name,data.from,data.to,data.currency,data.mode],[t('reports.customerStatement.conversionDate'),data.conversionDate||t('reports.customerStatement.savedJournalValues')],[t('reports.generalLedger.openingBalance'),data.opening],[t('reports.columns.date'),t('reports.columns.type'),t('reports.customerStatement.number'),t('reports.columns.originalDocument'),t('reports.columns.reference'),t('reports.columns.transactionCurrency'),t('reports.columns.transactionDebit'),t('reports.columns.transactionCredit'),t('reports.customerStatement.statementDebit'),t('reports.customerStatement.statementCredit'),t('reports.vendorStatement.runningBalanceCreditPositive')],...data.rows.map(r=>[r.date,r.type,r.number,r.originalNumber,r.reference,r.transactionCurrency,r.transactionDebit,r.transactionCredit,r.debit,r.credit,r.balance]),[t('reports.customerStatement.periodDebit'),data.debit],[t('reports.customerStatement.periodCredit'),data.credit],[t('reports.generalLedger.closingBalance'),data.closing]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='vendor-statement.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:9,title:t('reports.names.vendorStatement')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.vendor')}<Select className="accounting-report-select" aria-label={t('reports.vendorStatement.vendorAria')} showSearch optionFilterProp="label" placeholder={t('reports.vendorStatement.vendorPlaceholder')} value={vendor} onChange={setVendor} style={{minWidth:240}} options={vendors.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input aria-label={t('reports.customerStatement.fromAria')} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input aria-label={t('reports.customerStatement.toAria')} type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.customerStatement.currencyAria')} style={{minWidth:230}} value={currency} onChange={setCurrency} options={[{value:'VENDOR',label:t('reports.vendorStatement.vendorCurrencyOption',{currency:vendors.find(c=>c.code===vendor)?.currency||currencies?.settings.defaultCurrency||'…'})},{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} disabled={!vendor} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.vendorStatement.empty')}/>}
 {data&&<><h3>{data.vendor.name} · {data.vendor.code}</h3><p>{t('reports.period',{from:data.from,to:data.to})} · {data.currency}{data.conversionDate?' · '+t('reports.vendorStatement.conversionNote',{date:data.conversionDate}):''}</p>
 <Alert style={{marginBottom:16}} type="info" title={t('reports.vendorStatement.alertTitle')} description={t('reports.vendorStatement.alertDescription')}/>
 <h3>{lv(t('reports.generalLedger.openingBalance'),balance(data.opening))}</h3>
 <DataGrid<Entry> rowKey="journalId" dataSource={data.rows} scroll={{x:1300}} pagination={{pageSize:25}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.type'),dataIndex:'type'},{title:t('reports.columns.document'),dataIndex:'number'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.transactionDebit'),align:'right',render:(_,r)=>formatMoney(r.transactionDebit,r.transactionCurrency)},{title:t('reports.columns.transactionCredit'),align:'right',render:(_,r)=>formatMoney(r.transactionCredit,r.transactionCurrency)},{title:t('reports.columns.debitIn',{currency:data.currency}),align:'right',render:(_,r)=>formatMoney(r.debit,data.currency)},{title:t('reports.columns.creditIn',{currency:data.currency}),align:'right',render:(_,r)=>formatMoney(r.credit,data.currency)},{title:t('reports.columns.runningBalance'),align:'right',render:(_,r)=>balance(r.balance)}]}/>
 <Space wrap style={{display:'flex',justifyContent:'flex-end',marginTop:20}}><strong>{lv(t('reports.customerStatement.periodDebit'),formatMoney(data.debit,data.currency))}</strong><strong>{lv(t('reports.customerStatement.periodCredit'),formatMoney(data.credit,data.currency))}</strong><strong>{t('reports.generalLedger.closing',{amount:balance(data.closing)})}</strong></Space>
 </>}
 </Card>
}

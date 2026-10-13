import {useEffect,useState} from 'react'
import {Alert,Button,Card,Input,Select,Space,Tag} from 'antd'
import {request} from '../api'
import {billingApi,type Party} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {has,useT} from '../i18n'
import {DataGrid} from './DataGrid'
type Totals={currency:string;count:number;amount:number}
type Row=Totals&{id:string;number:string;customerCode:string;customerName:string;date:string;reference?:string;source:string;transactionCurrency:string;transactionAmount:number}
type Customer=Totals&{customerCode:string;customerName:string}
type Report={date:string;mode:string;customerCode?:string;rows:Row[];customers:Customer[];totals:Totals[]}
export function CustomerAdvancesReport(){
 const {t}=useT(),k='reports.customerAdvances.'
 const {data:currencies}=useCurrencies(),[customers,setCustomers]=useState<Party[]>([]),[customer,setCustomer]=useState<string>(),[date,setDate]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 useEffect(()=>{billingApi.choices().then(c=>setCustomers(c.customers)).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/customer-advances?'+new URLSearchParams({date,currency,...(customer?{customerCode:customer}:{})})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t(k+'loadError'))}finally{setLoading(false)}}
 const exportCsv=()=>{
  if(!data)return
  const c=(x:string)=>t('reports.columns.'+x)
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.customerAdvances'),data.date,data.mode,data.customerCode||t('reports.placeholders.allCustomers')],[c('receipt'),c('postingDate'),c('customerCode'),c('customer'),c('reference'),c('source'),c('transactionCurrency'),t(k+'columns.advanceBalance'),c('reportCurrency'),c('reportBalance')],...data.rows.map(r=>[r.number,r.date,r.customerCode,r.customerName,r.reference,r.source,r.transactionCurrency,r.transactionAmount,r.currency,r.amount]),[],[c('customerCode'),c('customer'),c('currency'),c('advances'),c('balance')],...data.customers.map(x=>[x.customerCode,x.customerName,x.currency,x.count,x.amount]),[],[c('currency'),c('advances'),c('balance')],...data.totals.map(x=>[x.currency,x.count,x.amount])]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='customer-advances.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:20,title:t('reports.names.customerAdvances')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.customer')}<Select className="accounting-report-select" aria-label={t(k+'ariaCustomer')} allowClear showSearch optionFilterProp="label" placeholder={t('reports.placeholders.allCustomers')} value={customer} onChange={setCustomer} style={{minWidth:240}} options={customers.map(c=>({value:c.code,label:c.name+' · '+c.code}))}/></div>
 <div className="accounting-report-field">{t('reports.filters.asOfDate')}<Input aria-label={t(k+'ariaDate')} type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t(k+'ariaCurrency')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},{value:'CUSTOMER',label:t('reports.currencyOptions.eachCustomer')},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 <Alert type="info" style={{marginBottom:16}} title={t(k+'alertTitle')} description={t(k+'alertDescription')}/>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.asOf',{date:data.date})} · {data.customerCode||t('reports.placeholders.allCustomers')} · {has('reports.modes.'+data.mode)?t('reports.modes.'+data.mode):data.mode}</p>
 <DataGrid<Row> rowKey="id" dataSource={data.rows} pagination={{pageSize:25}} scroll={{x:1300}} columns={[{title:t('reports.columns.receipt'),dataIndex:'number'},{title:t('reports.columns.postingDate'),dataIndex:'date'},{title:t('reports.columns.customer'),dataIndex:'customerName'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.source'),dataIndex:'source'},{title:t('reports.columns.transactionBalance'),align:'right',render:(_,r)=>formatMoney(r.transactionAmount,r.transactionCurrency)},{title:t('reports.columns.reportBalance'),align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>{t(k+'byCustomer')}</h3><DataGrid<Customer> rowKey={r=>r.customerCode+'|'+r.currency} dataSource={data.customers} pagination={false} columns={[{title:t('reports.columns.customer'),dataIndex:'customerName'},{title:t('reports.columns.currency'),dataIndex:'currency'},{title:t('reports.columns.advances'),dataIndex:'count'},{title:t('reports.columns.balance'),align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/>
 <h3>{t('reports.totals.byCurrency')}</h3><DataGrid<Totals> rowKey="currency" dataSource={data.totals} pagination={false} columns={[{title:t('reports.columns.currency'),dataIndex:'currency'},{title:t('reports.columns.advances'),dataIndex:'count'},{title:t('reports.columns.balance'),align:'right',render:(_,r)=>formatMoney(r.amount,r.currency)}]}/></>}
 </Card>
}

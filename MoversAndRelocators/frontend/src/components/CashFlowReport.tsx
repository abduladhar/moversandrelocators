import {useContext,useState} from 'react'
import {Alert,Button,Card,Input,Modal,Select,Space,Tag,message} from 'antd'
import {request} from '../api'
import {BillingPermissions,billingApi} from '../billingApi'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {has,useT} from '../i18n'
type Row={journalId:string;date:string;reference:string;transactionCurrency:string;category:string;counterpartAccounts:string[];cashAccounts:string[];inflow:number;outflow:number;net:number;isReversal:boolean;warning?:string}
type Report={from:string;to:string;currency:string;opening:number;closing:number;netMovement:number;difference:number;isReconciled:boolean;unclassifiedCount:number;classificationComplete:boolean;categories:{category:string;net:number}[];rows:Row[]}
type Mapping={code:string;name:string;type:string;category:string}
export function CashFlowReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),permissions=useContext(BillingPermissions)
 const [from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const [mappings,setMappings]=useState<Mapping[]>([]),[open,setOpen]=useState(false),[saving,setSaving]=useState(false)
 /** Activity categories come from the server as English names (Operating, Investing…); show them translated, unknown ones as sent. */
 const activity=(c:string)=>has('reports.cashFlow.activities.'+c)?t('reports.cashFlow.activities.'+c):c
 const typeLabel=(v:string)=>has('reports.accountTypes.'+v)?t('reports.accountTypes.'+v):v
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/cash-flow?'+new URLSearchParams({from,to,currency})))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 const showMappings=async()=>{try{setMappings(await request<Mapping[]>('/api/billing/reports/cash-flow/mappings'));setOpen(true)}catch(e){message.error(e instanceof Error?e.message:t('reports.cashFlow.mappingsLoadError'))}}
 const saveMapping=async(accountCode:string,category:string)=>{setSaving(true);try{await billingApi.save('reports/cash-flow/mappings',{accountCode,category});setMappings(old=>old.map(m=>m.code===accountCode?{...m,category}:m));setData(undefined);message.success(t('reports.cashFlow.mappingSaved'))}catch(e){message.error(e instanceof Error?e.message:t('reports.cashFlow.mappingSaveError'))}finally{setSaving(false)}}
 const yesNo=(v:boolean)=>v?t('common.yes'):t('common.no')
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  const rows=[[t('reports.names.cashFlow'),data.from,data.to,data.currency],[t('reports.cashFlow.openingCash'),data.opening],...data.categories.map(c=>[activity(c.category),c.net]),[t('reports.cashFlow.netMovement'),data.netMovement],[t('reports.cashFlow.closingCash'),data.closing],[t('reports.cashFlow.reconciliationDifference'),data.difference],[t('reports.cashFlow.classificationComplete'),yesNo(data.classificationComplete)],[t('reports.columns.date'),t('reports.columns.reference'),t('reports.cashFlow.category'),t('reports.columns.originalCurrency'),t('reports.columns.cashAccounts'),t('reports.columns.counterpartAccounts'),t('reports.columns.inflow'),t('reports.columns.outflow'),t('reports.columns.net'),t('reports.columns.reversal'),t('reports.cashFlow.review')],...data.rows.map(r=>[r.date,r.reference,activity(r.category),r.transactionCurrency,r.cashAccounts.join('; '),r.counterpartAccounts.join('; '),r.inflow,r.outflow,r.net,yesNo(r.isReversal),r.warning||''])]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='cash-flow.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card title={t('reports.cardTitle',{number:6,title:t('reports.names.cashFlow')})} extra={<Tag color="green">{t('reports.ready')}</Tag>}>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input aria-label={t('reports.cashFlow.fromAria')} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="accounting-report-field">{t('reports.filters.toDate')}<Input aria-label={t('reports.cashFlow.toAria')} type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.cashFlow.currencyAria')} value={currency} onChange={setCurrency} style={{minWidth:240}} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button><Button onClick={()=>void showMappings()}>{t('reports.cashFlow.classifications')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {!data&&!error&&<Alert type="info" title={t('reports.cashFlow.runHint')} description={t('reports.cashFlow.runHintDescription')}/>}
 {data&&<><p>{t('reports.cashFlow.summary',{from:data.from,to:data.to,currency:data.currency})}</p>
 <Alert style={{marginBottom:16}} type={data.isReconciled?'success':'error'} title={data.isReconciled?t('reports.cashFlow.reconciled'):t('reports.cashFlow.notReconciled')} description={t('reports.cashFlow.differenceValue',{amount:formatMoney(data.difference,data.currency)})}/>
 {!data.classificationComplete&&<Alert style={{marginBottom:16}} type="warning" title={t('reports.cashFlow.needsReview',{count:data.unclassifiedCount})} description={t('reports.cashFlow.needsReviewDescription')}/>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:20}}>{[{key:'opening',category:t('reports.cashFlow.openingCash'),net:data.opening},...data.categories.map(c=>({key:c.category,category:activity(c.category),net:c.net})),{key:'net',category:t('reports.cashFlow.netMovement'),net:data.netMovement},{key:'closing',category:t('reports.cashFlow.closingCash'),net:data.closing}].map(c=><Card size="small" key={c.key}><small>{c.category}</small><h3>{formatMoney(c.net,data.currency)}</h3></Card>)}</div>
 <DataGrid<Row> rowKey="journalId" dataSource={data.rows} scroll={{x:1200}} pagination={{pageSize:25}} columns={[{title:t('reports.columns.date'),dataIndex:'date'},{title:t('reports.columns.reference'),dataIndex:'reference'},{title:t('reports.columns.activity'),dataIndex:'category',render:(v:string)=>activity(v)},{title:t('reports.columns.cashAccounts'),render:(_,r)=>r.cashAccounts.join(', ')},{title:t('reports.columns.counterpartAccounts'),render:(_,r)=>r.counterpartAccounts.join(', ')},{title:t('reports.columns.inflow'),align:'right',render:(_,r)=>formatMoney(r.inflow,data.currency)},{title:t('reports.columns.outflow'),align:'right',render:(_,r)=>formatMoney(r.outflow,data.currency)},{title:t('reports.cashFlow.netMovement'),align:'right',render:(_,r)=>formatMoney(r.net,data.currency)},{title:t('reports.columns.reversal'),render:(_,r)=>r.isReversal?t('common.yes'):'—'},{title:t('reports.cashFlow.review'),dataIndex:'warning'}]}/>
 </>}
 <Modal centered width={850} title={t('reports.cashFlow.classificationsTitle')} open={open} onCancel={()=>!saving&&setOpen(false)} footer={<Button disabled={saving} onClick={()=>setOpen(false)}>{t('common.close')}</Button>}>
 <Alert style={{marginBottom:16}} type="info" title={t('reports.cashFlow.mapTitle')} description={t('reports.cashFlow.mapDescription')}/>
 <DataGrid<Mapping> rowKey="code" dataSource={mappings} pagination={{pageSize:8}} columns={[{title:t('reports.columns.code'),dataIndex:'code'},{title:t('reports.columns.account'),dataIndex:'name'},{title:t('reports.columns.type'),dataIndex:'type',render:(v:string)=>typeLabel(v)},{title:t('reports.columns.activity'),render:(_,m)=><Select className="accounting-report-select" aria-label={t('reports.cashFlow.categoryAria',{code:m.code})} style={{width:160}} disabled={saving||!permissions.includes('billing.accounts')} value={m.category} onChange={v=>void saveMapping(m.code,v)} options={['Operating','Investing','Financing','Exchange','Unclassified'].map(value=>({value,label:activity(value)}))}/>} ]}/>
 </Modal>
 </Card>
}

import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {PostingAuditReport} from '../components/PostingAuditReport'
import {TaxSummaryReport} from '../components/TaxSummaryReport'
import {CurrencyExposureReport} from '../components/CurrencyExposureReport'
import {OperationProfitabilityReport} from '../components/OperationProfitabilityReport'
import {EmployeeExpensesReport} from '../components/EmployeeExpensesReport'
import {RevenueAnalysisReport} from '../components/RevenueAnalysisReport'
import {ExpenseAnalysisReport} from '../components/ExpenseAnalysisReport'
import {CustomerAdvancesReport} from '../components/CustomerAdvancesReport'
import {OutstandingVendorsReport} from '../components/OutstandingVendorsReport'
import {OutstandingCustomersReport} from '../components/OutstandingCustomersReport'
import {DebitMemoRegisterReport} from '../components/DebitMemoRegisterReport'
import {CreditMemoRegisterReport} from '../components/CreditMemoRegisterReport'
import {PaymentVoucherRegisterReport} from '../components/PaymentVoucherRegisterReport'
import {ReceiptRegisterReport} from '../components/ReceiptRegisterReport'
import {BillRegisterReport} from '../components/BillRegisterReport'
import {InvoiceRegisterReport} from '../components/InvoiceRegisterReport'
import {PayableAgingReport} from '../components/PayableAgingReport'
import {ReceivableAgingReport} from '../components/ReceivableAgingReport'
import {VendorStatementReport} from '../components/VendorStatementReport'
import {CustomerStatementReport} from '../components/CustomerStatementReport'
import {CashFlowReport} from '../components/CashFlowReport'
import {BalanceSheetReport} from '../components/BalanceSheetReport'
import {ProfitAndLossReport} from '../components/ProfitAndLossReport'
import {JournalRegisterReport} from '../components/JournalRegisterReport'
import {GeneralLedgerReport} from '../components/GeneralLedgerReport'
import {useEffect,useState,type ReactNode} from 'react'
import {Alert,Button,Card,Empty,Input,Select,Space,Tooltip} from 'antd'
import {UserOutlined,ArrowLeftOutlined,AuditOutlined,BankOutlined,BarChartOutlined,BookOutlined,CalculatorOutlined,CreditCardOutlined,DollarOutlined,FieldTimeOutlined,FileDoneOutlined,FileTextOutlined,GlobalOutlined,HistoryOutlined,IdcardOutlined,LineChartOutlined,MinusCircleOutlined,PercentageOutlined,PieChartOutlined,PlusCircleOutlined,ProfileOutlined,RiseOutlined,SearchOutlined,ShopOutlined,SwapOutlined,TeamOutlined,WalletOutlined} from '@ant-design/icons'
import {lastBillingReportUrl,request} from '../api'
import {localDate,useCurrencies,formatMoney} from '../currency'
import {DataGrid} from '../components/DataGrid'

import {useT} from '../i18n'

/** Name key of each accounting report (reports.names.<key>, reports.descriptions.<key>); the index also names the print types ACCOUNTING_<n>. */
export const accountingReports=[
 'trialBalance','generalLedger','journalRegister','profitAndLoss','balanceSheet','cashFlow','cashBook','customerStatement','vendorStatement','receivableAging','payableAging','invoiceRegister','billRegister','receiptRegister','paymentVoucherRegister','creditMemoRegister','debitMemoRegister','outstandingCustomers','outstandingVendors','customerAdvances','expenseAnalysis','revenueAnalysis','operationProfitability','currencyExposure','taxSummary','postingAudit','employeeExpenses'
]
/** Endpoint of each accounting report, by index. Print sends the server the query of the report last run on screen. */
const reportSlugs=['trial-balance','general-ledger','journal-register','profit-and-loss','balance-sheet','cash-flow','cash-book','customer-statement','vendor-statement','receivable-aging','payable-aging','invoice-register','bill-register','receipt-register','payment-voucher-register','credit-memo-register','debit-memo-register','outstanding-customers','outstanding-vendors','customer-advances','expense-analysis','revenue-analysis','operation-profitability','currency-exposure','tax-summary','posting-audit','employee-expenses']
const printQuery=(index:number)=>{
 const [path,query]=lastBillingReportUrl().split('?')
 return path==='/api/billing/reports/'+reportSlugs[index]?query??'':null
}
type BalanceRow={code:string;name:string;type:string;openingDebit:number;openingCredit:number;debit:number;credit:number;closingDebit:number;closingCredit:number}
type Report={currency:string;from:string;to:string;rows:BalanceRow[];totals:Omit<BalanceRow,'code'|'name'|'type'>}

/** Report sections for the menu page (title: reports.groups.<key>); numbers are indexes into accountingReports. */
const reportGroups:{key:string;icon:ReactNode;color:string;reports:number[]}[]=[
 {key:'statements',icon:<BankOutlined/>,color:'#176b52',reports:[0,3,4,5]},
 {key:'ledgers',icon:<BookOutlined/>,color:'#315ca8',reports:[1,2,6]},
 {key:'customers',icon:<TeamOutlined/>,color:'#0f766e',reports:[7,9,11,13,15,17,19]},
 {key:'vendors',icon:<ShopOutlined/>,color:'#a3640e',reports:[8,10,12,14,16,18]},
 {key:'analysis',icon:<PieChartOutlined/>,color:'#7a3f86',reports:[20,21,22,26,23,24]},
 {key:'audit',icon:<AuditOutlined/>,color:'#5f6b7a',reports:[25]},
]
/** Tile icon of each report (same order as accountingReports). */
const reportIcons=[<CalculatorOutlined/>,<BookOutlined/>,<ProfileOutlined/>,<RiseOutlined/>,<BankOutlined/>,<SwapOutlined/>,<WalletOutlined/>,<IdcardOutlined/>,<ShopOutlined/>,<FieldTimeOutlined/>,<FieldTimeOutlined/>,
 <FileTextOutlined/>,<FileDoneOutlined/>,<DollarOutlined/>,<CreditCardOutlined/>,<MinusCircleOutlined/>,<PlusCircleOutlined/>,<TeamOutlined/>,<ShopOutlined/>,<WalletOutlined/>,
 <PieChartOutlined/>,<BarChartOutlined/>,<LineChartOutlined/>,<GlobalOutlined/>,<PercentageOutlined/>,<AuditOutlined/>,<UserOutlined/>]
const groupOf=(index:number)=>reportGroups.find(g=>g.reports.includes(index))!

/** The report component for an index (same order as accountingReports). */
const reportView=(index:number):ReactNode=>[
 <TrialBalanceReport/>,<GeneralLedgerReport key="general-ledger"/>,<JournalRegisterReport/>,<ProfitAndLossReport/>,<BalanceSheetReport/>,<CashFlowReport/>,
 <GeneralLedgerReport key="cash-book" cashBook/>,<CustomerStatementReport/>,<VendorStatementReport/>,<ReceivableAgingReport/>,<PayableAgingReport/>,
 <InvoiceRegisterReport/>,<BillRegisterReport/>,<ReceiptRegisterReport/>,<PaymentVoucherRegisterReport/>,<CreditMemoRegisterReport/>,<DebitMemoRegisterReport/>,
 <OutstandingCustomersReport/>,<OutstandingVendorsReport/>,<CustomerAdvancesReport/>,<ExpenseAnalysisReport/>,<RevenueAnalysisReport/>,
 <OperationProfitabilityReport/>,<CurrencyExposureReport/>,<TaxSummaryReport/>,<PostingAuditReport/>,<EmployeeExpensesReport/>
][index]

const RECENT_KEY='movers.accountingReports.recent'
const readRecent=():number[]=>{try{const v=JSON.parse(localStorage.getItem(RECENT_KEY)??'[]');return Array.isArray(v)?v.filter(n=>Number.isInteger(n)&&n>=0&&n<accountingReports.length):[]}catch{return []}}
const fromHash=()=>{const slug=window.location.hash.match(/^#report=([a-z-]+)$/)?.[1];const i=slug?reportSlugs.indexOf(slug):-1;return i>=0?i:null}

/**
 * Accounting reports: a menu page listing every report by section, and each report on its own page.
 * The open report is kept in the address (#report=<slug>) so the browser Back button returns to the menu.
 */
export function AccountingReportsPage(){
 const {t}=useT()
 const [selected,setSelected]=useState<number|null>(fromHash),[query,setQuery]=useState(''),[recent,setRecent]=useState<number[]>(readRecent)
 const name=(i:number)=>t('reports.names.'+accountingReports[i]),description=(i:number)=>t('reports.descriptions.'+accountingReports[i]),groupTitle=(key:string)=>t('reports.groups.'+key)
 useEffect(()=>{const sync=()=>setSelected(fromHash());window.addEventListener('popstate',sync)
  // Leaving Accounting reports: drop #report= so the next visit starts on the menu.
  return()=>{window.removeEventListener('popstate',sync);if(window.location.hash.startsWith('#report='))window.history.replaceState(null,'',window.location.pathname+window.location.search)}},[])
 const open=(index:number)=>{
  window.history.pushState(null,'','#report='+reportSlugs[index]);setSelected(index);window.scrollTo({top:0})
  const next=[index,...recent.filter(x=>x!==index)].slice(0,4);setRecent(next);try{localStorage.setItem(RECENT_KEY,JSON.stringify(next))}catch{/* per-viewer convenience only */}
 }
 const back=()=>{if(fromHash()!==null)window.history.back();else setSelected(null)}

 if(selected!==null){
  const group=groupOf(selected)
  return <div className="accounting-report-page">
   <div className="accounting-report-bar">
    <Button icon={<ArrowLeftOutlined/>} onClick={back}>{t('reports.page.allReports')}</Button>
    <div className="accounting-report-heading"><small style={{color:group.color}}>{group.icon} {groupTitle(group.key)}</small><h2>{name(selected)}</h2><p>{description(selected)}</p></div>
    <Space wrap className="accounting-report-tools">
     <Select aria-label={t('reports.page.switchReport')} showSearch optionFilterProp="label" style={{minWidth:260}} value={selected} onChange={open}
      options={reportGroups.map(g=>({label:groupTitle(g.key),options:g.reports.map(i=>({value:i,label:name(i)}))}))}/>
     <ReportPrintButton type={'ACCOUNTING_'+selected} title={name(selected)} query={()=>printQuery(selected)}/>
    </Space>
   </div>
   <div key={selected}>{reportView(selected)}</div>
  </div>
 }

 const q=query.trim().toLowerCase()
 const matches=(i:number)=>!q||(name(i)+' '+description(i)).toLowerCase().includes(q)
 const groups=reportGroups.map(g=>({...g,reports:g.reports.filter(matches)})).filter(g=>g.reports.length)
 const tile=(i:number)=><Tooltip key={i} title={description(i)} mouseEnterDelay={0.4}><button type="button" className="master-data-tile" onClick={()=>open(i)}>
  <span className="master-data-icon" aria-hidden="true">{reportIcons[i]}</span><span>{name(i)}</span>
 </button></Tooltip>
 // Same look as Master data: heading with search, sections with a title bar and icon tiles.
 return <div className="master-data-page accounting-menu">
  <div className="master-data-heading">
   <div><h1>{t('reports.page.title')}</h1><p>{t('reports.page.intro')}</p></div>
   <Input className="master-data-search" aria-label={t('reports.page.search')} placeholder={t('reports.page.search')} prefix={<SearchOutlined/>} allowClear value={query} onChange={e=>setQuery(e.target.value)}/>
  </div>
  <div className="master-data-groups">
   {!q&&recent.length>0&&<section className="master-data-group"><h2><HistoryOutlined/> {t('reports.page.recent')}</h2><div className="master-data-tiles">{recent.map(tile)}</div></section>}
   {groups.map(g=><section key={g.key} className="master-data-group"><h2>{groupTitle(g.key)}</h2><div className="master-data-tiles">{g.reports.map(tile)}</div></section>)}
   {!groups.length&&<Empty description={t('reports.page.noMatch',{query})}/>}
  </div>
 </div>
}

/** 1. Trial balance (opening, period and closing debit/credit per account). */
function TrialBalanceReport(){
 const {t}=useT()
 const {data:currencies}=useCurrencies(),[from,setFrom]=useState(localDate().slice(0,4)+'-01-01'),[to,setTo]=useState(localDate()),[currency,setCurrency]=useState('BASE'),[data,setData]=useState<Report>(),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const load=async()=>{setLoading(true);setError('');try{setData(await request<Report>('/api/billing/reports/trial-balance?from='+from+'&to='+to+'&currency='+currency))}catch(e){setData(undefined);setError(e instanceof Error?e.message:t('reports.errors.load'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const keys=['openingDebit','openingCredit','debit','credit','closingDebit','closingCredit'] as const
 const labels=keys.map(k=>t('reports.trialBalance.'+k))
 const exportCsv=()=>{
  if(!data)return
  const esc=(v:unknown)=>'"'+String(v??'').replace(/"/g,'""')+'"'
  const rows=[[t('reports.names.trialBalance'),data.from,data.to,data.currency],[t('reports.columns.account'),t('reports.columns.name'),...labels],...data.rows.map(r=>[r.code,r.name,...keys.map(k=>r[k])]),['',t('reports.trialBalance.totalUpper'),...keys.map(k=>data.totals[k])]]
  const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}))
  const a=document.createElement('a');a.href=url;a.download='trial-balance.csv';a.click();URL.revokeObjectURL(url)
 }
 return <Card>
 <Space className="accounting-report-filters" wrap align="end" style={{marginBottom:20}}>
 <div className="accounting-report-field">{t('reports.filters.fromDate')}<Input aria-label={t('reports.filters.fromDate')} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.toDate')}<Input aria-label={t('reports.filters.toDate')} type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
 <div className="accounting-report-field">{t('reports.filters.currency')}<Select className="accounting-report-select" aria-label={t('reports.trialBalance.currencyAria')} style={{minWidth:240}} value={currency} onChange={setCurrency} options={[{value:'BASE',label:t('reports.currencyOptions.base',{currency:currencies?.baseCurrency||'…'})},{value:'DEFAULT',label:t('reports.currencyOptions.default',{currency:currencies?.settings.defaultCurrency||'…'})},...(currencies?.currencies||[]).map(c=>({value:c.code,label:t('reports.currencyOptions.transactionsOnly',{currency:c.code})}))]}/></div>
 <Button type="primary" loading={loading} onClick={()=>void load()}>{t('reports.actions.run')}</Button><Button disabled={!data||loading} onClick={exportCsv}>{t('reports.actions.exportCsv')}</Button>
 </Space>
 {error&&<Alert type="error" title={error}/>}
 {data&&<><p>{t('reports.trialBalance.summary',{from:data.from,to:data.to,currency:data.currency})}</p>
 <DataGrid<BalanceRow> rowKey="code" dataSource={data.rows} scroll={{x:1100}} pagination={false} columns={[{title:t('reports.columns.account'),dataIndex:'code'},{title:t('reports.columns.name'),dataIndex:'name'},...keys.map((key,i)=>({title:labels[i],dataIndex:key,align:'right' as const,render:(v:number)=>formatMoney(v,data.currency)}))]}/>
 <div style={{display:'flex',gap:24,flexWrap:'wrap',justifyContent:'flex-end',marginTop:20}}>{keys.map((key,i)=><div key={key} style={{textAlign:'end'}}><small>{labels[i]}</small><br/><strong>{formatMoney(data.totals[key],data.currency)}</strong></div>)}</div>
 {Math.abs(data.totals.closingDebit-data.totals.closingCredit)>.0001&&<Alert type="error" title={t('reports.trialBalance.notBalanced')}/>}
 </>}
 </Card>
}

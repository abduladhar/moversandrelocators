import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { MemoPanel } from './MemoPanel'
import { NewBillingDocumentForm } from './NewBillingDocumentForm'
import {DualAmount} from './DualAmount'
import { CurrencyFields, formatMoney, useCurrencies } from '../currency'
import { CurrencyMasters, CurrencyExchangeRates } from './CurrencyMasters'
import { CurrencyReport } from './CurrencyReport'
import { CashPostingPanel } from './CashPostingPanel'
import { ChargeAccountMappings } from './ChargeAccountMappings'
import { BillingPrintDocument } from './BillingPrintDocument'
import { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Tag, message } from 'antd'
import { AppstoreOutlined, ArrowLeftOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons'
import { BillingPermissions, billingApi, type Account, type Charge, type Choices, type Doc, type DocumentRow, type Row, type Voucher } from '../billingApi'
import { DataGrid } from './DataGrid'
import { RowActions } from './RowActions'
import { formatNumber, has, t as translate, useT } from '../i18n'
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const money=(v:number)=>formatNumber(v,{minimumFractionDigits:2,maximumFractionDigits:2})
/** Billing sections (menu order). label is read in the current language each time it is used; labelKey is the translation key. */
const pageNames:Record<string,string>={'credit-memos':'creditMemos','debit-memos':'debitMemos',INVOICE:'invoices',BILL:'bills',charges:'charges',cash:'cash',vouchers:'vouchers','currency-report':'currencyReport',currencies:'currencies','exchange-rates':'exchangeRates',mappings:'mappings',accounts:'accounts'}
export const billingPages=Object.entries(pageNames).map(([key,name])=>({key,labelKey:'billing.pages.'+name,get label(){return translate('billing.pages.'+name)}}))
/** Translated label of a document type or account type sent by the server; unknown values are shown as they are. */
export const billingLabel=(t:(key:string)=>string,group:'docTypes'|'accountTypes',value:string)=>has('billing.'+group+'.'+value)?t('billing.'+group+'.'+value):value
type Props={sourceKind?:string;sourceId?:string;companyName:string;section?:string}
export function BillingPanel(props:Props) {
 const permissions=useContext(BillingPermissions)
 return permissions.includes('billing.view')?<BillingWorkspace {...props}/>:null
}
function BillingWorkspace({sourceKind,sourceId,companyName,section}:Props) {
 const {t}=useT()
 const [localSection,setLocalSection]=useState<string>(); const activeSection=section||localSection
 const {data:currencyData}=useCurrencies()
 const permissions=useContext(BillingPermissions),can=(p:string)=>permissions.includes('billing.'+p)
 const [choices,setChoices]=useState<Choices>({chargeMasters:[],accounts:[],sources:[],customers:[],vendors:[]}),[charges,setCharges]=useState<Row<Charge>[]>([]),[documents,setDocuments]=useState<DocumentRow[]>([]),[vouchers,setVouchers]=useState<Row<Voucher>[]>([])
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([])
 const [mode,setMode]=useState<'charge'|'new-document'|'issue'|'pay'|'account'|'void'|null>(null),[paymentType,setPaymentType]=useState('RECEIPT'),[target,setTarget]=useState<{id:string;version:string;kind:string;posted:boolean}>()
 const [preview,setPreview]=useState<Row<Doc>|Row<Voucher>>(),[previewType,setPreviewType]=useState<'document'|'voucher'>('document')
 const [settlements,setSettlements]=useState<Record<string,number>>({})
 const [allocations,setAllocations]=useState<Record<string,number>>({}),[references,setReferences]=useState<Record<string,string>>({})
 const [form]=Form.useForm(),busy=useRef(false),requestId=useRef('')
 const exchangeRate=Form.useWatch('exchangeRate',form)
 const direction=Form.useWatch('direction',form)||'INCOME',currency=Form.useWatch('currency',form)||currencyData?.settings.defaultCurrency||'AED',partyCode=Form.useWatch('partyCode',form)
 const load=async()=>{
  setLoading(true)
  try{const [c,ch,d,v]=await Promise.all([billingApi.choices(),billingApi.charges(),billingApi.documents(),billingApi.vouchers()]);setChoices(c);setCharges(ch);setDocuments(d);setVouchers(v);setError('')}
  catch(e){setError(e instanceof Error?e.message:t('billing.errors.load'))}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[sourceKind,sourceId])
 const scoped=(kind:string,id:string)=>!sourceId||(kind===sourceKind&&id===sourceId)
 const visibleCharges=charges.filter(x=>scoped(x.details.sourceKind,x.details.sourceId))
 const visibleDocs=documents.filter(x=>x.details.lines.some(l=>scoped(l.sourceKind,l.sourceId)))
 const docIds=new Set(visibleDocs.map(x=>x.id))
 const visibleVouchers=vouchers.filter(x=>!sourceId||x.details.allocations.some(a=>docIds.has(a.documentId)))
 const search=(x:unknown)=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())
 const pending=visibleCharges.filter(x=>!x.details.cancelled&&!x.details.documentId)
 const chosen=pending.filter(x=>selected.includes(x.id))
 const compatible=chosen.every(c=>c.details.direction===chosen[0]?.details.direction&&c.details.partyCode===chosen[0]?.details.partyCode&&c.details.currency===chosen[0]?.details.currency)
 const open=(next:typeof mode)=>{
  form.resetFields();form.setFieldsValue({direction:'INCOME',currency:currencyData?.settings.defaultCurrency||'AED',date:today(),dueDate:today(),isActive:true,type:'Expense',accountCode:'1000',lines:[{amount:0}]});requestId.current=crypto.randomUUID();setMode(next)
 }
 const pay=(type:string)=>{setPaymentType(type);setAllocations({});setSettlements({});setReferences({});open('pay')}
 const paymentDocs=documents.filter(d=>!!d.journalId&&!d.details.voided&&d.balance>0&&d.details.type===(paymentType==='RECEIPT'?'INVOICE':'BILL')&&(paymentType!=='RECEIPT'||d.details.partyCode===partyCode))
 const paymentGroups=Array.from(new Set(paymentDocs.filter(d=>(allocations[d.id]||0)>0).map(d=>d.details.partyCode))).map(code=>({partyCode:code,name:paymentDocs.find(d=>d.details.partyCode===code)!.details.partyName,reference:references[code]||'',allocations:paymentDocs.filter(d=>d.details.partyCode===code&&(allocations[d.id]||0)>0).map(d=>({documentId:d.id,version:d.version,amount:allocations[d.id],paymentAmount:d.details.currency===currency?allocations[d.id]:settlements[d.id]}))}))
 const perform=async(action:()=>Promise<unknown>)=>{
  if(busy.current)return;busy.current=true;setSaving(true)
  try{await action();setMode(null);setSelected([]);message.success(t('common.saved'));await load()}
  catch(e){message.error(e instanceof Error?e.message:t('billing.errors.save'))}
  finally{busy.current=false;setSaving(false)}
 }
 const submit=async()=>{
  try{
   const v=await form.validateFields()
   if(mode==='charge'||mode==='new-document'){const source=choices.sources.find(s=>s.id===(sourceId||v.sourceId)&&(!sourceKind||s.kind===sourceKind));if(!source&&(mode==='charge'||sourceId||v.sourceId)){message.error(t('billing.errors.selectSource'));return}await perform(()=>billingApi.save(mode==='new-document'?'documents/new':'charge-batches',{...v,type:direction==='INCOME'?'INVOICE':'BILL',requestId:requestId.current,sourceKind:source?.kind,sourceId:source?.id}))}
   if(mode==='issue')await perform(()=>billingApi.save('documents',{...v,requestId:requestId.current,charges:chosen.map(c=>({id:c.id,version:c.version}))}))
   if(mode==='account')await perform(()=>billingApi.save('accounts',v))
   if(mode==='pay'){
    if(!paymentGroups.length||paymentGroups.some(g=>!g.reference.trim()||g.allocations.some(a=>!a.paymentAmount))){message.error(t('billing.errors.paymentGroups'));return}
    await perform(()=>billingApi.save('payments',{...v,type:paymentType,requestId:requestId.current,groups:paymentGroups}))
   }
   if(mode==='void'&&target)await perform(()=>billingApi.save(target.kind+'/'+target.id+'/void',{...v,version:target.version}))
  }catch(e){if(e instanceof Error)message.error(e.message)}
 }
 const reverse=(r:Row<Doc>|Row<Voucher>,kind:string)=>{setTarget({id:r.id,version:r.version,kind,posted:!!r.journalId});open('void')}
 const show=async(r:Row<Doc>|Row<Voucher>,kind:'document'|'voucher')=>{
  try {
   const latest=await billingApi.documents();setDocuments(latest)
   const current=kind==='document'?latest.find(d=>d.id===r.id):(await billingApi.vouchers()).find(v=>v.id===r.id)
   if(!current)throw new Error(t('billing.errors.documentGone'))
   setPreview(current);setPreviewType(kind)
  }catch(e){message.error(e instanceof Error?e.message:t('billing.errors.preview'))}
 }
 const currencyField=<CurrencyFields form={form}/>
 const partyOptions=(direction==='INCOME'?choices.customers:choices.vendors).filter(p=>p.isActive).map(p=>({value:p.code,label:p.name+' · '+p.code}))
 const page=(key:string)=>billingPages.find(p=>p.key===key)!.label
 const docStatus=(r:DocumentRow)=>r.details.voided?t('billing.status.voided'):r.balance===0?t('billing.status.paid'):r.paid>0?t('billing.status.partPaid'):t('billing.status.unpaid')
 const pages=[
 {key:'credit-memos',label:page('credit-memos'),children:<MemoPanel type="CREDIT_MEMO" sourceId={sourceId} sourceKind={sourceKind}/>},{key:'debit-memos',label:page('debit-memos'),children:<MemoPanel type="DEBIT_MEMO" sourceId={sourceId} sourceKind={sourceKind}/>},
 {key:'currency-report',label:page('currency-report'),children:<CurrencyReport sourceKind={sourceKind} sourceId={sourceId}/>},
 {key:'cash',label:page('cash'),children:<CashPostingPanel sourceKind={sourceKind} sourceId={sourceId}/>},
 {key:'charges',label:page('charges'),children:<>
 <Alert type="info" showIcon title={t('billing.charges.help')}/>
 <Space wrap style={{margin:'16px 0'}}>{can('capture')&&<Button type="primary" onClick={()=>{open('charge');form.setFieldValue('accountCode',undefined)}}>{t('billing.charges.add')}</Button>}{can('issue')&&<Button disabled={!chosen.length||!compatible} onClick={()=>open('issue')}>{t('billing.charges.convert',{count:chosen.length})}</Button>}</Space>
 {!compatible&&<Alert type="warning" title={t('billing.charges.incompatible')}/>}
 <DataGrid<Row<Charge>> rowKey="id" loading={loading} dataSource={visibleCharges.filter(search)} rowSelection={can('issue')?{selectedRowKeys:selected,onChange:k=>setSelected(k.map(String)),getCheckboxProps:r=>({disabled:!!r.details.documentId||r.details.cancelled})}:undefined} scroll={{x:1100}} columns={[
 {title:t('billing.columns.number'),dataIndex:'number'},{title:t('billing.columns.source'),dataIndex:['details','sourceLabel']},{title:t('common.type'),dataIndex:['details','direction'],render:v=>v==='INCOME'?t('billing.charges.customerCharge'):t('billing.charges.vendorCharge')},{title:t('billing.columns.party'),dataIndex:['details','partyName']},{title:t('common.description'),dataIndex:['details','description']},{title:t('billing.columns.account'),dataIndex:['details','accountCode']},{title:t('common.currency'),dataIndex:['details','currency']},{title:t('common.amount'),align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:t('billing.columns.baseAmount'),align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},
 {title:t('common.status'),render:(_,r)=>r.details.cancelled?t('billing.status.cancelled'):r.details.documentId?t('billing.status.converted'):t('billing.status.unconverted')},
 {title:t('common.actions'),key:'actions',render:(_,r)=>!r.details.cancelled&&!r.details.documentId&&can('capture')?<RowActions><Button danger onClick={()=>Modal.confirm({title:t('billing.charges.cancelConfirm'),onOk:()=>perform(()=>billingApi.save('charges/'+r.id+'/cancel',{id:r.id,version:r.version}))})}>{t('billing.charges.cancel')}</Button></RowActions>:null}
 ]}/></>},
 ...(['INVOICE','BILL'] as const).map(type=>({key:type,label:page(type),children:<>
 <DataGrid<DocumentRow> rowKey="id" dataSource={visibleDocs.filter(x=>x.details.type===type).filter(search)} scroll={{x:1050}} columns={[
 {title:t('billing.columns.number'),dataIndex:'number'},{title:type==='INVOICE'?t('common.customer'):t('billing.columns.vendor'),dataIndex:['details','partyName']},{title:t('common.date'),dataIndex:['details','date']},{title:t('billing.columns.dueDate'),dataIndex:['details','dueDate']},{title:t('billing.columns.reference'),dataIndex:['details','reference']},{title:t('common.currency'),dataIndex:['details','currency']},{title:t('common.amount'),align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:t('billing.columns.baseAmount'),align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},{title:t('billing.columns.memoAdjustment'),align:'right',render:(_,r)=>formatMoney(r.details.voided?0:r.balance+r.paid-r.details.amount,r.details.currency)},{title:t('billing.columns.paidAmount'),align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData} amount={r.paid}/>},{title:t('billing.columns.balance'),align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData} amount={r.balance}/>},{title:t('billing.columns.accounting'),render:(_,r)=><Tag color={r.journalId?'green':'orange'}>{r.journalId?t('billing.status.posted'):t('billing.status.draft')}</Tag>},{title:t('common.status'),render:(_,r)=><Tag color={r.details.voided?'default':r.balance===0?'green':'orange'}>{docStatus(r)}</Tag>},
 {title:t('common.actions'),key:'actions',render:(_,r)=><RowActions>{can('pay')&&!r.journalId&&!r.details.voided&&<Button type="primary" disabled={saving} onClick={()=>perform(()=>billingApi.save('documents/'+r.id+'/post',{id:r.id,version:r.version}))}>{t('billing.actions.postToAccounting')}</Button>}<Button onClick={()=>show(r,'document')}>{t('billing.actions.viewPrint')}</Button>{can('issue')&&!r.details.voided&&r.paid===0&&<Button danger onClick={()=>reverse(r,'documents')}>{r.journalId?t('billing.actions.void'):t('billing.actions.cancelDraft')}</Button>}</RowActions>}
 ]}/></>})),
 {key:'vouchers',label:page('vouchers'),children:<DataGrid<Row<Voucher>> rowKey="id" dataSource={visibleVouchers.filter(search)} scroll={{x:900}} columns={[
 {title:t('billing.columns.voucher'),dataIndex:'number'},{title:t('common.type'),dataIndex:['details','type'],render:v=>billingLabel(t,'docTypes',v)},{title:t('billing.columns.party'),dataIndex:['details','partyName']},{title:t('common.date'),dataIndex:['details','date']},{title:t('billing.columns.reference'),dataIndex:['details','reference']},{title:t('common.currency'),dataIndex:['details','currency']},{title:t('common.amount'),align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:t('billing.columns.baseAmount'),align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},{title:t('common.status'),render:(_,r)=>r.details.voided?t('billing.status.cancelledReversed'):r.journalId?t('billing.status.posted'):t('billing.status.draft')},
 {title:t('common.actions'),key:'actions',render:(_,r)=><RowActions>{can('pay')&&!r.journalId&&!r.details.voided&&<Button type="primary" disabled={saving} onClick={()=>perform(()=>billingApi.save('vouchers/'+r.id+'/post',{id:r.id,version:r.version}))}>{t('billing.actions.postToAccounting')}</Button>}<Button onClick={()=>show(r,'voucher')}>{t('billing.actions.viewPrint')}</Button>{can('pay')&&!r.details.voided&&<Button danger onClick={()=>reverse(r,'vouchers')}>{r.journalId?t('billing.actions.reverseVoucher'):t('billing.actions.cancelDraft')}</Button>}</RowActions>}
 ]}/>},
 ...(!sourceId?[{key:'currencies',label:page('currencies'),children:<CurrencyMasters/>},{key:'exchange-rates',label:page('exchange-rates'),children:<CurrencyExchangeRates/>},{key:'mappings',label:page('mappings'),children:<ChargeAccountMappings/>},{key:'accounts',label:page('accounts'),children:<>
 {can('accounts')&&<Button type="primary" onClick={()=>open('account')} style={{marginBottom:16}}>{t('billing.accounts.add')}</Button>}
 <DataGrid<Account> rowKey="code" dataSource={choices.accounts.filter(search)} columns={[{title:t('common.code'),dataIndex:'code'},{title:t('billing.columns.account'),dataIndex:'name'},{title:t('common.type'),dataIndex:'type',render:v=>billingLabel(t,'accountTypes',v)},{title:t('billing.columns.cashBank'),dataIndex:'isCashBank',render:v=>v?t('common.yes'):'—'},{title:t('common.status'),dataIndex:'isActive',render:v=>v?t('common.active'):t('common.inactive')},{title:t('common.actions'),key:'actions',render:(_,r)=>can('accounts')&&!['1000','1100','1200','1300','2000','2100','2200','3000','4000','4100','5000','5100','5200','5300','5400','4200-FX','5500','4300','5600'].includes(r.code)?<RowActions><Button onClick={()=>{open('account');form.setFieldsValue(r)}}>{t('common.edit')}</Button></RowActions>:null}]}/></>}]:[])
 ]
 const modalTitle=mode==='new-document'?(direction==='INCOME'?t('billing.panel.newInvoice'):t('billing.panel.newBill')):mode==='charge'?t('billing.modal.addCharges'):mode==='issue'?t('billing.modal.convertCharges'):mode==='pay'?(paymentType==='RECEIPT'?t('billing.modal.receivePayment'):t('billing.modal.payBills')):mode==='void'?(target?.posted?t('billing.modal.reverseDocument'):t('billing.actions.cancelDraft')):t('billing.pages.accounts')
 const okText=mode==='new-document'?(direction==='INCOME'?t('billing.modal.createInvoice'):t('billing.modal.createBill')):mode==='issue'?t('billing.modal.issueDocument'):mode==='pay'?t('billing.modal.saveDraftVouchers'):t('common.save')
 return <div className="billing-workspace">
 <header className="billing-page-heading">
 <h1>{billingPages.find(p=>p.key===activeSection)?.label||t('billing.panel.title')}</h1>
 {(activeSection==='INVOICE'||activeSection==='BILL')&&<p>{activeSection==='INVOICE'?t('billing.panel.invoicesIntro'):t('billing.panel.billsIntro')}</p>}
 </header>
 {(activeSection==='INVOICE'||activeSection==='BILL'||activeSection==='vouchers')&&<Alert style={{marginBottom:16}} type="info" showIcon title={t('billing.panel.postingAlertTitle')} description={t('billing.panel.postingAlertDescription')}/>}
 <div className="billing-toolbar">
 <div className="billing-toolbar-filters">
 <Input.Search className="billing-search" aria-label={t('billing.panel.searchLabel')} placeholder={t('billing.panel.searchPlaceholder')} value={query} onChange={e=>setQuery(e.target.value)} allowClear/>
 <Button icon={<ReloadOutlined/>} loading={loading} onClick={()=>void load()}>{t('common.refresh')}</Button>
 </div>
 {(activeSection==='INVOICE'||activeSection==='BILL')&&<div className="billing-toolbar-actions">
 {can('pay')&&<Button onClick={()=>pay(activeSection==='INVOICE'?'RECEIPT':'PAYMENT')}>{activeSection==='INVOICE'?t('billing.panel.receivePayment'):t('billing.panel.makeVendorPayments')}</Button>}
 {can('issue')&&can('capture')&&<Button type="primary" icon={<PlusOutlined/>} onClick={()=>{open('new-document');form.setFieldValue('direction',activeSection==='INVOICE'?'INCOME':'EXPENSE')}}>{activeSection==='INVOICE'?t('billing.panel.newInvoice'):t('billing.panel.newBill')}</Button>}
 </div>}
 </div>
 {error&&<Alert type="error" title={error}/>}
 {!section&&activeSection&&<Button icon={<ArrowLeftOutlined/>} onClick={()=>setLocalSection(undefined)} style={{marginBottom:16}}>{t('billing.panel.billingMenu')}</Button>}
 {activeSection?<>{pages.find(p=>p.key===activeSection)?.children}</>:<div className="navigation-menu-tiles">{billingPages.filter(p=>pages.some(x=>x.key===p.key)).map(p=><button key={p.key} className="navigation-menu-tile" onClick={()=>setLocalSection(p.key)}><span className="navigation-menu-icon"><AppstoreOutlined/></span><span>{p.label}</span></button>)}</div>}
 <Modal className={mode==='new-document'?'billing-document-modal':undefined} centered width={mode==='new-document'?1040:mode==='pay'?1050:720} open={!!mode} title={modalTitle} onCancel={()=>!saving&&setMode(null)} onOk={()=>void submit()} okText={okText} cancelText={t('common.cancel')} confirmLoading={saving} destroyOnHidden>
 <Form form={form} className="billing-entry-form" layout="vertical" disabled={saving}>
 {mode==='new-document'&&<NewBillingDocumentForm form={form} choices={choices} currencies={currencyData} sourceId={sourceId} direction={direction} currency={currency}/>}
 {mode==='charge'&&<>
 {!sourceId&&<Form.Item name="sourceId" label={t('billing.chargeForm.source')} rules={[{required:true,message:t('common.required')}]}><Select allowClear placeholder={t('billing.chargeForm.sourcePlaceholder')} showSearch optionFilterProp="label" options={choices.sources.map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></Form.Item>}
 <Form.Item name="direction" label={t('common.type')} rules={[{required:true,message:t('common.required')}]}><Select options={[{value:'INCOME',label:t('billing.chargeForm.directionIncome')},{value:'EXPENSE',label:t('billing.chargeForm.directionExpense')}]} onChange={()=>form.setFieldsValue({partyCode:undefined,lines:[{amount:0}]})}/></Form.Item>
 <Form.Item name="partyCode" label={direction==='INCOME'?t('common.customer'):t('billing.columns.vendor')} rules={[{required:true,message:t('common.required')}]}><Select showSearch optionFilterProp="label" options={partyOptions} onChange={code=>form.setFieldValue('currency',(direction==='INCOME'?choices.customers:choices.vendors).find(p=>p.code===code)?.currency||currencyData?.settings.defaultCurrency)}/></Form.Item>
 {currencyField}
 <Form.List name="lines" rules={[{validator:async(_,v)=>{if(!v?.length)throw new Error(t('billing.chargeForm.addAtLeastOne'))}}]}>{(rows,{add,remove},errors)=><>
 {rows.map(row=><Card key={row.key} className="billing-charge-card" size="small" style={{marginBottom:20}} title={t('billing.chargeForm.chargeTitle',{number:row.name+1})} extra={<Button danger onClick={()=>remove(row.name)}>{t('common.remove')}</Button>}>
 <Form.Item name={[row.name,'chargeMasterId']} label={t('billing.columns.charge')} rules={[{required:true,message:t('common.required')}]}><Select showSearch optionFilterProp="label" options={choices.chargeMasters.filter(m=>m.isActive&&(direction==='INCOME'?m.incomeAccount:m.expenseAccount)).map(m=>({value:m.id,label:m.name}))} onChange={id=>{const m=choices.chargeMasters.find(x=>x.id===id);if(m){form.setFieldValue(['lines',row.name,'amount'],m.defaultRate);form.setFieldValue(['lines',row.name,'description'],m.name)}}}/></Form.Item>
 <Form.Item name={[row.name,'description']} label={t('common.description')}><Input maxLength={500}/></Form.Item>
 <Form.Item className="amount-field" name={[row.name,'amount']} label={t('common.amount')} rules={[{required:true,message:t('common.required')}]}><InputNumber controls={false} min={0.0001} max={1000000000} precision={currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2} style={{width:'100%'}}/></Form.Item></Card>)}
 <Button onClick={()=>add({amount:0})}>{t('billing.chargeForm.addAnother')}</Button><Form.ErrorList errors={errors.errors}/></>}</Form.List>
 <p>{t('billing.chargeForm.accountsHint')}</p>
 </>}
 {mode==='issue'&&<><Alert type="info" title={t('billing.issue.summary',{count:chosen.length,amount:money(chosen.reduce((s,c)=>s+c.details.amount,0))})} description={t('billing.issue.description')}/><Form.Item name="date" label={t('billing.issue.documentDate')} rules={[{required:true,message:t('common.required')}]}><Input type="date"/></Form.Item><Form.Item name="dueDate" label={t('billing.columns.dueDate')} rules={[{required:true,message:t('common.required')}]}><Input type="date"/></Form.Item><Form.Item name="reference" label={t('billing.issue.reference')}><Input maxLength={120}/></Form.Item><Form.Item name="notes" label={t('common.notes')}><Input.TextArea maxLength={2000}/></Form.Item></>}
 {mode==='pay'&&<>
 <Alert type="info" showIcon title={paymentType==='RECEIPT'?t('billing.pay.receiptHelp'):t('billing.pay.paymentHelp')} description={t('billing.pay.description')}/>
 <div className="job-form-grid">{currencyField}<Form.Item name="date" label={t('billing.pay.paymentDate')} rules={[{required:true,message:t('common.required')}]}><Input type="date"/></Form.Item>
 <Form.Item name="accountCode" label={t('billing.pay.cashBankAccount')} rules={[{required:true,message:t('common.required')}]}><Select options={choices.accounts.filter(a=>a.isActive&&a.isCashBank).map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></Form.Item>
 {paymentType==='RECEIPT'&&<Form.Item name="partyCode" label={t('common.customer')} rules={[{required:true,message:t('common.required')}]}><Select showSearch optionFilterProp="label" options={choices.customers.map(p=>({value:p.code,label:p.name+' · '+p.code}))} onChange={code=>{setAllocations({});setReferences({});form.setFieldValue('currency',choices.customers.find(p=>p.code===code)?.currency||currencyData?.settings.defaultCurrency)}}/></Form.Item>}</div>
 <DataGrid<DocumentRow> rowKey="id" dataSource={paymentDocs} pagination={{pageSize:8}} scroll={{x:650}} columns={[{title:t('billing.columns.document'),dataIndex:'number'},{title:t('billing.columns.partyShort'),dataIndex:['details','partyName']},{title:t('billing.columns.balance'),align:'right',render:(_,d)=>formatMoney(d.balance,d.details.currency)},{title:t('billing.columns.allocateDocumentCurrency'),render:(_,d)=><InputNumber controls={false} aria-label={t('billing.pay.allocateAria',{number:d.number})} min={0} max={d.balance} precision={currencyData?.currencies.find(c=>c.code===d.details.currency)?.decimalPlaces??2} value={allocations[d.id]||0} onChange={v=>{setAllocations(old=>({...old,[d.id]:v||0}));setSettlements(old=>({...old,[d.id]:Number(((v||0)*(d.details.baseAmount||0)/d.details.amount/(exchangeRate||1)).toFixed(currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2))}))}}/>},{title:t('billing.columns.paymentAmountIn',{currency}),render:(_,d)=>d.details.currency===currency?formatMoney(allocations[d.id]||0,currency):<InputNumber controls={false} min={0} precision={currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2} value={settlements[d.id]} onChange={v=>setSettlements(old=>({...old,[d.id]:v||0}))}/>} ]}/>
 {paymentGroups.map(g=><Card key={g.partyCode} size="small" title={g.name+' · '+currency+' '+money(g.allocations.reduce((s,a)=>s+(a.paymentAmount||0),0))} style={{marginTop:12}}><label>{t('billing.pay.voucherReference')}<Input aria-label={t('billing.pay.voucherReferenceAria',{name:g.name})} maxLength={120} value={references[g.partyCode]||''} onChange={e=>setReferences(old=>({...old,[g.partyCode]:e.target.value}))}/></label></Card>)}
 <Form.Item name="notes" label={t('common.notes')}><Input.TextArea maxLength={2000}/></Form.Item>
 </>}
 {mode==='account'&&<><Form.Item name="code" label={t('billing.accounts.code')} rules={[{required:true,message:t('common.required')}]}><Input maxLength={40}/></Form.Item><Form.Item name="name" label={t('billing.accounts.name')} rules={[{required:true,message:t('common.required')}]}><Input maxLength={120}/></Form.Item><Form.Item name="type" label={t('billing.accounts.type')} rules={[{required:true,message:t('common.required')}]}><Select options={['Asset','Liability','Equity','Revenue','Expense'].map(value=>({value,label:billingLabel(t,'accountTypes',value)}))}/></Form.Item><Form.Item name="isCashBank" label={t('billing.pay.cashBankAccount')} valuePropName="checked"><Switch/></Form.Item><Form.Item name="isActive" label={t('common.active')} valuePropName="checked"><Switch/></Form.Item></>}
 {mode==='void'&&<><Alert type="warning" title={target?.posted?t('billing.void.postedWarning'):t('billing.void.draftWarning')}/><Form.Item name="date" label={t('billing.void.reversalDate')} rules={[{required:true,message:t('common.required')}]}><Input type="date"/></Form.Item><Form.Item name="reason" label={t('billing.columns.reason')} rules={[{required:true,whitespace:true,message:t('common.required')}]}><Input.TextArea maxLength={500}/></Form.Item></>}
 </Form></Modal>
 <Modal centered destroyOnHidden width={900} open={!!preview} title={preview?t('billing.preview.titleWithNumber',{number:preview.number}):t('billing.preview.title')} onCancel={()=>setPreview(undefined)} footer={<ReportPrintButton type={preview?.details.type??"INVOICE"} title={preview?.number??t('billing.preview.document')} id={preview?.id} disabled={!preview}/>}>
 {preview&&<BillingPrintDocument record={preview} kind={previewType} documents={documents} companyName={companyName} choices={choices}/>}
 </Modal>
 </div>
}

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
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const money=(v:number)=>v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})
export const billingPages=[{key:'credit-memos',label:'Credit memos'},{key:'debit-memos',label:'Debit memos'},{key:'INVOICE',label:'Invoices'},{key:'BILL',label:'Bills'},{key:'charges',label:'Invoice & bill charges'},{key:'cash',label:'Customer receipts & expenses paid'},{key:'vouchers',label:'Receipts & payment vouchers'},{key:'currency-report',label:'Currency report'},{key:'currencies',label:'Currency'},{key:'exchange-rates',label:'Currency Exchange Rates'},{key:'mappings',label:'Charge master mappings'},{key:'accounts',label:'Chart of accounts'}]
type Props={sourceKind?:string;sourceId?:string;companyName:string;section?:string}
export function BillingPanel(props:Props) {
 const permissions=useContext(BillingPermissions)
 return permissions.includes('billing.view')?<BillingWorkspace {...props}/>:null
}
function BillingWorkspace({sourceKind,sourceId,companyName,section}:Props) {
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
  catch(e){setError(e instanceof Error?e.message:'Unable to load billing')}
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
  try{await action();setMode(null);setSelected([]);message.success('Saved');await load()}
  catch(e){message.error(e instanceof Error?e.message:'Unable to save')}
  finally{busy.current=false;setSaving(false)}
 }
 const submit=async()=>{
  try{
   const v=await form.validateFields()
   if(mode==='charge'||mode==='new-document'){const source=choices.sources.find(s=>s.id===(sourceId||v.sourceId)&&(!sourceKind||s.kind===sourceKind));if(!source&&(mode==='charge'||sourceId||v.sourceId)){message.error('Select a source record');return}await perform(()=>billingApi.save(mode==='new-document'?'documents/new':'charge-batches',{...v,type:direction==='INCOME'?'INVOICE':'BILL',requestId:requestId.current,sourceKind:source?.kind,sourceId:source?.id}))}
   if(mode==='issue')await perform(()=>billingApi.save('documents',{...v,requestId:requestId.current,charges:chosen.map(c=>({id:c.id,version:c.version}))}))
   if(mode==='account')await perform(()=>billingApi.save('accounts',v))
   if(mode==='pay'){
    if(!paymentGroups.length||paymentGroups.some(g=>!g.reference.trim()||g.allocations.some(a=>!a.paymentAmount))){message.error('Enter an allocation, a payment amount and a reference for every voucher group');return}
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
   if(!current)throw new Error('Document no longer available. Refresh billing.')
   setPreview(current);setPreviewType(kind)
  }catch(e){message.error(e instanceof Error?e.message:'Unable to open print preview')}
 }
 const currencyField=<CurrencyFields form={form}/>
 const partyOptions=(direction==='INCOME'?choices.customers:choices.vendors).filter(p=>p.isActive).map(p=>({value:p.code,label:p.name+' · '+p.code}))
 const pages=[
 {key:'credit-memos',label:'Credit memos',children:<MemoPanel type="CREDIT_MEMO" sourceId={sourceId} sourceKind={sourceKind}/>},{key:'debit-memos',label:'Debit memos',children:<MemoPanel type="DEBIT_MEMO" sourceId={sourceId} sourceKind={sourceKind}/>},
 {key:'currency-report',label:'Currency report',children:<CurrencyReport sourceKind={sourceKind} sourceId={sourceId}/>},
 {key:'cash',label:'Customer receipts & expenses paid',children:<CashPostingPanel sourceKind={sourceKind} sourceId={sourceId}/>},
 {key:'charges',label:'Invoice & bill charges',children:<>
 <Alert type="info" showIcon title="Capture charges, then select them to create an invoice or bill. Existing pickup income and expense records remain available separately; avoid recording the same cost twice."/>
 <Space wrap style={{margin:'16px 0'}}>{can('capture')&&<Button type="primary" onClick={()=>{open('charge');form.setFieldValue('accountCode',undefined)}}>Add charges</Button>}{can('issue')&&<Button disabled={!chosen.length||!compatible} onClick={()=>open('issue')}>Convert selected to invoice / bill ({chosen.length})</Button>}</Space>
 {!compatible&&<Alert type="warning" title="Select charges for only one customer/vendor, type and currency before conversion."/>}
 <DataGrid<Row<Charge>> rowKey="id" loading={loading} dataSource={visibleCharges.filter(search)} rowSelection={can('issue')?{selectedRowKeys:selected,onChange:k=>setSelected(k.map(String)),getCheckboxProps:r=>({disabled:!!r.details.documentId||r.details.cancelled})}:undefined} scroll={{x:1100}} columns={[
 {title:'Number',dataIndex:'number'},{title:'Source',dataIndex:['details','sourceLabel']},{title:'Type',dataIndex:['details','direction'],render:v=>v==='INCOME'?'Customer charge':'Vendor charge'},{title:'Customer / vendor',dataIndex:['details','partyName']},{title:'Description',dataIndex:['details','description']},{title:'Account',dataIndex:['details','accountCode']},{title:'Currency',dataIndex:['details','currency']},{title:'Amount',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:'Base amount',align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},
 {title:'Status',render:(_,r)=>r.details.cancelled?'Cancelled':r.details.documentId?'Converted':'Unconverted'},
 {title:'Actions',key:'actions',render:(_,r)=>!r.details.cancelled&&!r.details.documentId&&can('capture')?<RowActions><Button danger onClick={()=>Modal.confirm({title:'Cancel this unposted charge?',onOk:()=>perform(()=>billingApi.save('charges/'+r.id+'/cancel',{id:r.id,version:r.version}))})}>Cancel charge</Button></RowActions>:null}
 ]}/></>},
 ...(['INVOICE','BILL'] as const).map(type=>({key:type,label:type==='INVOICE'?'Invoices':'Bills',children:<>
 <DataGrid<DocumentRow> rowKey="id" dataSource={visibleDocs.filter(x=>x.details.type===type).filter(search)} scroll={{x:1050}} columns={[
 {title:'Number',dataIndex:'number'},{title:type==='INVOICE'?'Customer':'Vendor',dataIndex:['details','partyName']},{title:'Date',dataIndex:['details','date']},{title:'Due date',dataIndex:['details','dueDate']},{title:'Reference',dataIndex:['details','reference']},{title:'Currency',dataIndex:['details','currency']},{title:'Amount',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:'Base amount',align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},{title:'Memo adjustment',align:'right',render:(_,r)=>formatMoney(r.details.voided?0:r.balance+r.paid-r.details.amount,r.details.currency)},{title:'Paid amount',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData} amount={r.paid}/>},{title:'Balance',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData} amount={r.balance}/>},{title:'Accounting',render:(_,r)=><Tag color={r.journalId?'green':'orange'}>{r.journalId?'Posted':'Draft'}</Tag>},{title:'Status',render:(_,r)=><Tag color={r.details.voided?'default':r.balance===0?'green':'orange'}>{r.details.voided?'Voided':r.balance===0?'Paid':r.paid>0?'Part paid':'Unpaid'}</Tag>},
 {title:'Actions',key:'actions',render:(_,r)=><RowActions>{can('pay')&&!r.journalId&&!r.details.voided&&<Button type="primary" disabled={saving} onClick={()=>perform(()=>billingApi.save('documents/'+r.id+'/post',{id:r.id,version:r.version}))}>Post to accounting</Button>}<Button onClick={()=>show(r,'document')}>View / print</Button>{can('issue')&&!r.details.voided&&r.paid===0&&<Button danger onClick={()=>reverse(r,'documents')}>{r.journalId?'Void':'Cancel draft'}</Button>}</RowActions>}
 ]}/></>})),
 {key:'vouchers',label:'Receipts & payment vouchers',children:<DataGrid<Row<Voucher>> rowKey="id" dataSource={visibleVouchers.filter(search)} scroll={{x:900}} columns={[
 {title:'Voucher',dataIndex:'number'},{title:'Type',dataIndex:['details','type']},{title:'Customer / vendor',dataIndex:['details','partyName']},{title:'Date',dataIndex:['details','date']},{title:'Reference',dataIndex:['details','reference']},{title:'Currency',dataIndex:['details','currency']},{title:'Amount',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:'Base amount',align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},{title:'Status',render:(_,r)=>r.details.voided?'Cancelled / reversed':r.journalId?'Posted':'Draft'},
 {title:'Actions',key:'actions',render:(_,r)=><RowActions>{can('pay')&&!r.journalId&&!r.details.voided&&<Button type="primary" disabled={saving} onClick={()=>perform(()=>billingApi.save('vouchers/'+r.id+'/post',{id:r.id,version:r.version}))}>Post to accounting</Button>}<Button onClick={()=>show(r,'voucher')}>View / print</Button>{can('pay')&&!r.details.voided&&<Button danger onClick={()=>reverse(r,'vouchers')}>{r.journalId?'Reverse voucher':'Cancel draft'}</Button>}</RowActions>}
 ]}/>},
 ...(!sourceId?[{key:'currencies',label:'Currency',children:<CurrencyMasters/>},{key:'exchange-rates',label:'Currency Exchange Rates',children:<CurrencyExchangeRates/>},{key:'mappings',label:'Charge master mappings',children:<ChargeAccountMappings/>},{key:'accounts',label:'Chart of accounts',children:<>
 {can('accounts')&&<Button type="primary" onClick={()=>open('account')} style={{marginBottom:16}}>Add account</Button>}
 <DataGrid<Account> rowKey="code" dataSource={choices.accounts.filter(search)} columns={[{title:'Code',dataIndex:'code'},{title:'Account',dataIndex:'name'},{title:'Type',dataIndex:'type'},{title:'Cash / bank',dataIndex:'isCashBank',render:v=>v?'Yes':'—'},{title:'Status',dataIndex:'isActive',render:v=>v?'Active':'Inactive'},{title:'Actions',key:'actions',render:(_,r)=>can('accounts')&&!['1000','1100','1200','1300','2000','2100','2200','3000','4000','4100','5000','5100','5200','5300','5400','4200-FX','5500','4300','5600'].includes(r.code)?<RowActions><Button onClick={()=>{open('account');form.setFieldsValue(r)}}>Edit</Button></RowActions>:null}]}/></>}]:[])
 ]
 return <div className="billing-workspace">
 <header className="billing-page-heading">
 <h1>{billingPages.find(p=>p.key===activeSection)?.label||'Invoicing & billing'}</h1>
 {(activeSection==='INVOICE'||activeSection==='BILL')&&<p>{activeSection==='INVOICE'?'Create customer invoices, track balances and receive payments.':'Create vendor bills, track balances and record payments.'}</p>}
 </header>
 {(activeSection==='INVOICE'||activeSection==='BILL'||activeSection==='vouchers')&&<Alert style={{marginBottom:16}} type="info" showIcon title="Save, review, then post to accounting" description="Drafts do not create journal entries. Use the row menu to post a reviewed document. Invoices and bills must be posted before allocating payments."/>}
 <div className="billing-toolbar">
 <div className="billing-toolbar-filters">
 <Input.Search className="billing-search" aria-label="Search billing" placeholder="Search number, party or reference" value={query} onChange={e=>setQuery(e.target.value)} allowClear/>
 <Button icon={<ReloadOutlined/>} loading={loading} onClick={()=>void load()}>Refresh</Button>
 </div>
 {(activeSection==='INVOICE'||activeSection==='BILL')&&<div className="billing-toolbar-actions">
 {can('pay')&&<Button onClick={()=>pay(activeSection==='INVOICE'?'RECEIPT':'PAYMENT')}>{activeSection==='INVOICE'?'Receive payment':'Make vendor payments'}</Button>}
 {can('issue')&&can('capture')&&<Button type="primary" icon={<PlusOutlined/>} onClick={()=>{open('new-document');form.setFieldValue('direction',activeSection==='INVOICE'?'INCOME':'EXPENSE')}}>{activeSection==='INVOICE'?'New invoice':'New bill'}</Button>}
 </div>}
 </div>
 {error&&<Alert type="error" title={error}/>}
 {!section&&activeSection&&<Button icon={<ArrowLeftOutlined/>} onClick={()=>setLocalSection(undefined)} style={{marginBottom:16}}>Billing menu</Button>}
 {activeSection?<>{pages.find(p=>p.key===activeSection)?.children}</>:<div className="navigation-menu-tiles">{billingPages.filter(p=>pages.some(x=>x.key===p.key)).map(p=><button key={p.key} className="navigation-menu-tile" onClick={()=>setLocalSection(p.key)}><span className="navigation-menu-icon"><AppstoreOutlined/></span><span>{p.label}</span></button>)}</div>}
 <Modal className={mode==='new-document'?'billing-document-modal':undefined} centered width={mode==='new-document'?1040:mode==='pay'?1050:720} open={!!mode} title={mode==='new-document'?(direction==='INCOME'?'New invoice':'New bill'):mode==='charge'?'Add customer / vendor charges':mode==='issue'?'Convert charges to invoice / bill':mode==='pay'?(paymentType==='RECEIPT'?'Receive customer payment':'Pay vendor bills'):mode==='void'?(target?.posted?'Reverse financial document':'Cancel draft'):'Chart of accounts'} onCancel={()=>!saving&&setMode(null)} onOk={()=>void submit()} okText={mode==='new-document'?(direction==='INCOME'?'Create invoice':'Create bill'):mode==='issue'?'Issue document':mode==='pay'?'Save draft vouchers':'Save'} confirmLoading={saving} destroyOnHidden>
 <Form form={form} className="billing-entry-form" layout="vertical" disabled={saving}>
 {mode==='new-document'&&<NewBillingDocumentForm form={form} choices={choices} currencies={currencyData} sourceId={sourceId} direction={direction} currency={currency}/>}
 {mode==='charge'&&<>
 {!sourceId&&<Form.Item name="sourceId" label="Pickup, job or warehouse receipt" rules={[{required:true}]}><Select allowClear placeholder="Select a pickup, job or warehouse receipt" showSearch optionFilterProp="label" options={choices.sources.map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></Form.Item>}
 <Form.Item name="direction" label="Type" rules={[{required:true}]}><Select options={[{value:'INCOME',label:'Customer charges — Invoice'},{value:'EXPENSE',label:'Vendor charges — Bill'}]} onChange={()=>form.setFieldsValue({partyCode:undefined,lines:[{amount:0}]})}/></Form.Item>
 <Form.Item name="partyCode" label={direction==='INCOME'?'Customer':'Vendor'} rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={partyOptions} onChange={code=>form.setFieldValue('currency',(direction==='INCOME'?choices.customers:choices.vendors).find(p=>p.code===code)?.currency||currencyData?.settings.defaultCurrency)}/></Form.Item>
 {currencyField}
 <Form.List name="lines" rules={[{validator:async(_,v)=>{if(!v?.length)throw new Error('Add at least one charge')}}]}>{(rows,{add,remove},errors)=><>
 {rows.map(row=><Card key={row.key} className="billing-charge-card" size="small" style={{marginBottom:20}} title={'Charge '+(row.name+1)} extra={<Button danger onClick={()=>remove(row.name)}>Remove</Button>}>
 <Form.Item name={[row.name,'chargeMasterId']} label="Charge" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={choices.chargeMasters.filter(m=>m.isActive&&(direction==='INCOME'?m.incomeAccount:m.expenseAccount)).map(m=>({value:m.id,label:m.name}))} onChange={id=>{const m=choices.chargeMasters.find(x=>x.id===id);if(m){form.setFieldValue(['lines',row.name,'amount'],m.defaultRate);form.setFieldValue(['lines',row.name,'description'],m.name)}}}/></Form.Item>
 <Form.Item name={[row.name,'description']} label="Description"><Input maxLength={500}/></Form.Item>
 <Form.Item className="amount-field" name={[row.name,'amount']} label="Amount" rules={[{required:true}]}><InputNumber controls={false} min={0.0001} max={1000000000} precision={currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2} style={{width:'100%'}}/></Form.Item></Card>)}
 <Button onClick={()=>add({amount:0})}>Add another charge</Button><Form.ErrorList errors={errors.errors}/></>}</Form.List>
 <p>Accounts come from the charge master. Ask the accountant to map any missing charge.</p>
 </>}
 {mode==='issue'&&<><Alert type="info" title={chosen.length+' selected charges · '+money(chosen.reduce((s,c)=>s+c.details.amount,0))} description="Income becomes a draft invoice; expense becomes a draft bill. Use Post to accounting after reviewing the document."/><Form.Item name="date" label="Document date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="dueDate" label="Due date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="reference" label="Customer / supplier reference"><Input maxLength={120}/></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea maxLength={2000}/></Form.Item></>}
 {mode==='pay'&&<>
 <Alert type="info" showIcon title={paymentType==='RECEIPT'?'Allocate one receipt across invoices for the same customer.':'Select bills across vendors. Each vendor gets a separate payment voucher and reference.'} description="Allocation amounts use the document currency. Enter the amount paid in the selected payment currency for foreign-currency documents. Amounts may be partial. Save the voucher, then use Post to accounting to update the ledger and paid balances."/>
 <div className="job-form-grid">{currencyField}<Form.Item name="date" label="Payment date" rules={[{required:true}]}><Input type="date"/></Form.Item>
 <Form.Item name="accountCode" label="Cash / bank account" rules={[{required:true}]}><Select options={choices.accounts.filter(a=>a.isActive&&a.isCashBank).map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></Form.Item>
 {paymentType==='RECEIPT'&&<Form.Item name="partyCode" label="Customer" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={choices.customers.map(p=>({value:p.code,label:p.name+' · '+p.code}))} onChange={code=>{setAllocations({});setReferences({});form.setFieldValue('currency',choices.customers.find(p=>p.code===code)?.currency||currencyData?.settings.defaultCurrency)}}/></Form.Item>}</div>
 <DataGrid<DocumentRow> rowKey="id" dataSource={paymentDocs} pagination={{pageSize:8}} scroll={{x:650}} columns={[{title:'Document',dataIndex:'number'},{title:'Party',dataIndex:['details','partyName']},{title:'Balance',align:'right',render:(_,d)=>formatMoney(d.balance,d.details.currency)},{title:'Allocate in document currency',render:(_,d)=><InputNumber controls={false} aria-label={'Allocate '+d.number} min={0} max={d.balance} precision={currencyData?.currencies.find(c=>c.code===d.details.currency)?.decimalPlaces??2} value={allocations[d.id]||0} onChange={v=>{setAllocations(old=>({...old,[d.id]:v||0}));setSettlements(old=>({...old,[d.id]:Number(((v||0)*(d.details.baseAmount||0)/d.details.amount/(exchangeRate||1)).toFixed(currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2))}))}}/>},{title:'Payment amount ('+currency+')',render:(_,d)=>d.details.currency===currency?formatMoney(allocations[d.id]||0,currency):<InputNumber controls={false} min={0} precision={currencyData?.currencies.find(c=>c.code===currency)?.decimalPlaces??2} value={settlements[d.id]} onChange={v=>setSettlements(old=>({...old,[d.id]:v||0}))}/>} ]}/>
 {paymentGroups.map(g=><Card key={g.partyCode} size="small" title={g.name+' · '+currency+' '+money(g.allocations.reduce((s,a)=>s+(a.paymentAmount||0),0))} style={{marginTop:12}}><label>Voucher reference number (required)<Input aria-label={'Voucher reference for '+g.name} maxLength={120} value={references[g.partyCode]||''} onChange={e=>setReferences(old=>({...old,[g.partyCode]:e.target.value}))}/></label></Card>)}
 <Form.Item name="notes" label="Notes"><Input.TextArea maxLength={2000}/></Form.Item>
 </>}
 {mode==='account'&&<><Form.Item name="code" label="Account code" rules={[{required:true}]}><Input maxLength={40}/></Form.Item><Form.Item name="name" label="Account name" rules={[{required:true}]}><Input maxLength={120}/></Form.Item><Form.Item name="type" label="Account type" rules={[{required:true}]}><Select options={['Asset','Liability','Equity','Revenue','Expense'].map(value=>({value}))}/></Form.Item><Form.Item name="isCashBank" label="Cash / bank account" valuePropName="checked"><Switch/></Form.Item><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch/></Form.Item></>}
 {mode==='void'&&<><Alert type="warning" title={target?.posted?"A reversing ledger entry will be posted. Payment reversals restore outstanding balances; document reversals release charges.":"This draft will be cancelled without creating a journal entry. Charges on a cancelled invoice or bill become available again."}/><Form.Item name="date" label="Reversal date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="reason" label="Reason" rules={[{required:true,whitespace:true}]}><Input.TextArea maxLength={500}/></Form.Item></>}
 </Form></Modal>
 <Modal centered destroyOnHidden width={900} open={!!preview} title={preview ? preview.number + " · Print preview" : "Print preview"} onCancel={()=>setPreview(undefined)} footer={<ReportPrintButton type={preview?.details.type??"INVOICE"} title={preview?.number??"Document"} id={preview?.id} disabled={!preview}/>}>
 {preview&&<BillingPrintDocument record={preview} kind={previewType} documents={documents} companyName={companyName} choices={choices}/>}
 </Modal>
 </div>
}























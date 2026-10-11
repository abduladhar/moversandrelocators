import {DualAmount} from './DualAmount'
import { CurrencyFields, formatMoney, useCurrencies } from '../currency'
import { request } from '../api'
import { useContext,useEffect,useRef,useState } from 'react'
import { Alert,Button,Card,Checkbox,Form,Input,InputNumber,Modal,Select,Space,Tag,message } from 'antd'
import { BillingPermissions,billingApi,type CashRow,type Choices,type DocumentRow } from '../billingApi'
import { DataGrid } from './DataGrid'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts, type ReceiptKind } from '../expenseReceipts'

/** Cash entries captured here (numbers RCV-/EPD-) own their receipts; rows from pickup, packing or delivery show that module's receipts read-only. */
const isCapture=(r:CashRow)=>/^(RCV|EPD)-/.test(r.number)
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
const money=(n:number)=>n.toFixed(2)
export function CashPostingPanel({sourceKind,sourceId}:{sourceKind?:string;sourceId?:string}){
 const {data:currencyData}=useCurrencies()
 const perms=useContext(BillingPermissions),canCapture=perms.includes('billing.capture'),canPost=perms.includes('billing.pay')
 const [rows,setRows]=useState<CashRow[]>([]),[choices,setChoices]=useState<Choices>(),[docs,setDocs]=useState<DocumentRow[]>([])
 const [query,setQuery]=useState(''),[status,setStatus]=useState('pending'),[open,setOpen]=useState(false),[posting,setPosting]=useState<CashRow>(),[saving,setSaving]=useState(false),[loading,setLoading]=useState(false)
 const [form]=Form.useForm(),busy=useRef(false),requestId=useRef(''),type=Form.useWatch('type',form)||'RECEIPT',party=Form.useWatch('partyCode',form),settle=Form.useWatch('settle',form)
 const [settlements,setSettlements]=useState<Record<string,number>>({})
 const [amounts,setAmounts]=useState<Record<string,number>>({})
 const [pendingReceipts,setPendingReceipts]=useState<File[]>([])
 const receipts=useReceipts(rows.map(r=>r.id))
 const receiptCell=(r:CashRow)=><ReceiptsButton kind={(isCapture(r)?'CASH':r.details.sourceKind) as ReceiptKind} expenseId={r.id} receipts={receipts.byExpense.get(r.id)??[]} editable={isCapture(r)&&canCapture&&!r.posted} onChanged={()=>void receipts.reload()} title={'Receipts · '+r.number}/>
 const load=async()=>{setLoading(true);try{const [r,c,d]=await Promise.all([request<CashRow[]>('/api/billing/cash'),billingApi.choices(),billingApi.documents()]);setRows(r);setChoices(c);setDocs(d)}catch(e){message.error(e instanceof Error?e.message:'Unable to load posting queue')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[sourceId,sourceKind])
 const show=(row?:CashRow)=>{
  form.resetFields();requestId.current=crypto.randomUUID();setAmounts({});setSettlements({});setPosting(row);setPendingReceipts([])
  form.setFieldsValue({type:row?.details.type||'RECEIPT',date:today(),currency:row?.details.currency||currencyData?.settings.defaultCurrency||'AED',partyCode:row?.details.partyCode,chargeMasterId:row?.details.chargeMasterId,accountCode:'1000',exchangeRate:row?.details.fx?.usdPerUnit,settle:false});setOpen(true)
 }
 const available=docs.filter(d=>!!d.journalId&&!d.details.voided&&d.balance>0&&d.details.type===(type==='RECEIPT'?'INVOICE':'BILL')&&d.details.partyCode===party)
 const submit=async()=>{
  if(busy.current)return
  try{
   const v=await form.validateFields();busy.current=true;setSaving(true)
   if(posting){
    const allocations=settle?available.filter(d=>(amounts[d.id]||0)>0).map(d=>({documentId:d.id,version:d.version,amount:amounts[d.id],paymentAmount:d.details.currency===posting.details.currency?amounts[d.id]:settlements[d.id]})):[]
    if(settle&&(allocations.some(a=>!a.paymentAmount)||Math.round(allocations.reduce((s,a)=>s+(a.paymentAmount||0),0)*10000)!==Math.round(posting.details.amount*10000)))throw new Error('Allocate the exact received/paid amount.')
    await billingApi.save('cash/'+posting.id+'/post',{...v,requestId:requestId.current,expectedVersion:posting.version,allocations})
   }else{
    const source=choices?.sources.find(s=>s.id===(sourceId||v.sourceId)&&(!sourceKind||s.kind===sourceKind))
    if(!source)throw new Error('Select a source record')
    const saved=await billingApi.save<{id:string}>('cash',{...v,sourceKind:source.kind,sourceId:source.id,requestId:requestId.current})
    if(pendingReceipts.length&&saved?.id){const n=await uploadReceipts('CASH',saved.id,pendingReceipts);if(n)message.success(n===1?'Receipt attached':n+' receipts attached')}
   }
   setOpen(false);message.success(posting?'Posted to ledger':'Captured for accountant review');await load();void receipts.reload()
  }catch(e){if(e instanceof Error)message.error(e.message)}finally{busy.current=false;setSaving(false)}
 }
 const filtered=rows.filter(r=>(!sourceId||r.details.sourceKind===sourceKind&&r.details.sourceId===sourceId)&&(status==='all'||(status==='posted'?r.posted:!r.posted))&&JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
 return <>
 <Alert type="info" showIcon title={sourceId?'Customer receipts & expenses paid':'Accountant posting queue'} description="Captured payments are not ledger postings. Review the party, cash/bank account and allocations before posting. Existing pickup receipts and paid crew expenses appear here automatically."/>
 <Space wrap style={{margin:'16px 0'}}><Button loading={loading} onClick={()=>void load()}>Refresh queue</Button>{canCapture&&<Button type="primary" onClick={()=>show()}>Capture received / paid amount</Button>}<Select value={status} onChange={setStatus} options={[{value:'pending',label:'Pending posting'},{value:'posted',label:'Posted'},{value:'all',label:'All records'}]}/><Input.Search allowClear placeholder="Search source, reference or party" value={query} onChange={e=>setQuery(e.target.value)}/></Space>
 <DataGrid<CashRow> rowKey="id" dataSource={filtered} loading={loading} scroll={{x:1050}} columns={[
 {title:'Reference',dataIndex:'number'},{title:'Source',dataIndex:['details','sourceLabel']},{title:'Type',render:(_,r)=>r.details.type==='RECEIPT'?'Customer receipt':'Expense paid'},
 {title:'Party',dataIndex:['details','partyName']},{title:'Date',dataIndex:['details','date']},{title:'Currency',dataIndex:['details','currency']},{title:'Amount',align:'right',render:(_,r)=><DualAmount details={r.details} choices={choices} currencies={currencyData}/>},{title:'Base amount',align:'right',render:(_,r)=>formatMoney(r.details.baseAmount,currencyData?.baseCurrency||'USD')},
 {title:'Receipts',width:90,render:(_,r)=>receiptCell(r)},{title:'Status',render:(_,r)=><Tag color={r.posted?'green':'orange'}>{r.posted?'Posted':'Pending'}</Tag>},{title:'Posting voucher',dataIndex:'postingNumber'},
 {title:'Actions',key:'actions',render:(_,r)=>!r.posted&&canPost?<Button onClick={()=>show(r)}>Review & post</Button>:null}
 ]}/>
 <Modal centered width={850} open={open} title={posting?'Review & post · '+posting.number:'Capture customer receipt / expense paid'} onCancel={()=>!saving&&setOpen(false)} onOk={()=>void submit()} okText={posting?'Post to ledger':'Save for posting'} confirmLoading={saving} destroyOnHidden>
 <Form form={form} layout="vertical" disabled={saving}>
 {posting&&<Card size="small" extra={<Space><span>Receipts</span>{receiptCell(posting)}</Space>}><strong>{posting.details.sourceLabel} · {posting.details.currency} {money(posting.details.amount)}</strong><p>{posting.details.reference} · {posting.details.notes}</p>{!(receipts.byExpense.get(posting.id)?.length)&&<small style={{color:'#b45309'}}>No receipt attached.</small>}</Card>}
 <Form.Item name="type" label="Payment type" rules={[{required:true}]}><Select disabled={!!posting} options={[{value:'RECEIPT',label:'Customer receipt (received payment)'},{value:'EXPENSE_PAID',label:'Expense paid'}]} onChange={()=>form.setFieldsValue({partyCode:undefined,chargeMasterId:undefined})}/></Form.Item>
 {!posting&&!sourceId&&<Form.Item name="sourceId" label="Pickup / Job / Warehouse receipt" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={choices?.sources.map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></Form.Item>}
 <Form.Item name="partyCode" label={type==='RECEIPT'?'Customer':'Vendor / payee'} rules={[{required:true}]}><Select disabled={!!posting?.details.partyCode} showSearch optionFilterProp="label" options={(type==='RECEIPT'?choices?.customers:choices?.vendors)?.filter(p=>p.isActive).map(p=>({value:p.code,label:p.name+' · '+p.code}))} onChange={code=>{setAmounts({});if(!posting)form.setFieldValue('currency',(type==='RECEIPT'?choices?.customers:choices?.vendors)?.find(p=>p.code===code)?.currency||currencyData?.settings.defaultCurrency)}}/></Form.Item>
 <Form.Item name="date" label={posting?'Posting date':'Received / paid date'} rules={[{required:true}]}><Input type="date"/></Form.Item>
 {!posting&&<><CurrencyFields form={form}/><Form.Item name="amount" label="Amount" className="amount-field" rules={[{required:true}]}><InputNumber controls={false} precision={4} min={0.0001} max={1000000000} style={{width:'100%'}}/></Form.Item><Form.Item name="reference" label="Reference number" rules={[{required:true,whitespace:true}]}><Input maxLength={120}/></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea maxLength={2000}/></Form.Item><Form.Item label="Receipt (optional)" extra="Photo of the bill or the payment slip; uploaded when you save."><ReceiptPicker value={pendingReceipts} onChange={setPendingReceipts}/></Form.Item></>}
 {posting&&<><CurrencyFields form={form} locked={!!posting.details.fx}/><Form.Item name="accountCode" label="Cash / bank account" rules={[{required:true}]}><Select options={choices?.accounts.filter(a=>a.isActive&&a.isCashBank).map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></Form.Item><Form.Item name="settle" valuePropName="checked"><Checkbox>Allocate to {type==='RECEIPT'?'invoices':'existing bills'}</Checkbox></Form.Item></>}
 {type==='EXPENSE_PAID'&&!settle&&<Form.Item name="chargeMasterId" label="Expense charge" rules={[{required:true}]}><Select disabled={!!posting?.details.chargeMasterId} showSearch optionFilterProp="label" options={choices?.chargeMasters.filter(m=>m.isActive&&m.expenseAccount).map(m=>({value:m.id,label:m.name}))}/></Form.Item>}
 {posting&&settle&&<><DataGrid<DocumentRow> rowKey="id" dataSource={available} columns={[{title:'Document',dataIndex:'number'},{title:'Balance',align:'right',render:(_,d)=>formatMoney(d.balance,d.details.currency)},{title:'Allocate amount',render:(_,d)=><InputNumber controls={false} aria-label={'Allocate '+d.number} min={0} max={d.balance} precision={4} value={amounts[d.id]||0} onChange={v=>setAmounts(old=>({...old,[d.id]:v||0}))}/>},{title:'Payment amount ('+posting.details.currency+')',render:(_,d)=>d.details.currency===posting.details.currency?formatMoney(amounts[d.id]||0,d.details.currency):<InputNumber controls={false} min={0} precision={4} value={settlements[d.id]} onChange={v=>setSettlements(old=>({...old,[d.id]:v||0}))}/>}]} scroll={{x:700}}/><p>Allocate exactly {posting.details.currency} {money(posting.details.amount)}.</p></>}
 {posting&&!settle&&<Alert type="info" title={type==='RECEIPT'?'Posts to Customer advances (2100). It does not settle any invoice.':'Posts to the selected charge’s expense account. Use bill allocation above if the expense already has a bill.'}/>}
 </Form></Modal></>
}








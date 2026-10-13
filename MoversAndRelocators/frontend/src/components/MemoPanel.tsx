import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {useContext,useEffect,useRef,useState} from 'react'
import {Alert,Button,Form,Input,InputNumber,Modal,Select,Space,Tag,message} from 'antd'
import {BillingPermissions,billingApi,type DocumentRow,type Row} from '../billingApi'
import {request} from '../api'
import {formatMoney,localDate,useCurrencies} from '../currency'
import {DataGrid} from './DataGrid'
import {RowActions} from './RowActions'
import {has,useT} from '../i18n'
export type Memo={type:string;documentId:string;documentNumber:string;documentType:string;chargeId:string;partyCode:string;partyName:string;currency:string;date:string;accountCode:string;amount:number;baseAmount:number;reason:string;voided:boolean}
export function MemoPanel({type,sourceId,sourceKind}:{type:'CREDIT_MEMO'|'DEBIT_MEMO';sourceId?:string;sourceKind?:string}){
 const {t}=useT()
 const permissions=useContext(BillingPermissions),canCreate=permissions.includes('billing.issue'),canPost=permissions.includes('billing.pay')
 const {data:currencies}=useCurrencies()
 const [rows,setRows]=useState<Row<Memo>[]>([]),[docs,setDocs]=useState<DocumentRow[]>([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[open,setOpen]=useState(false),[reversing,setReversing]=useState<Row<Memo>>()
 const [preview,setPreview]=useState<Row<Memo>>()
 const [form]=Form.useForm(),[reverseForm]=Form.useForm(),busy=useRef(false),requestId=useRef('')
 const documentId=Form.useWatch('documentId',form),doc=docs.find(d=>d.id===documentId),credit=type==='CREDIT_MEMO',name=credit?t('billing.memos.creditMemo'):t('billing.memos.debitMemo')
 const load=async()=>{setLoading(true);try{const [m,d]=await Promise.all([request<Row<Memo>[]>('/api/billing/memos'),billingApi.documents()]);setRows(m);setDocs(d)}catch(e){message.error(e instanceof Error?e.message:t('billing.memos.loadError'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[type,sourceId,sourceKind])
 const scoped=(d:DocumentRow)=>!sourceId||d.details.lines.some(l=>l.sourceId===sourceId&&l.sourceKind===sourceKind)
 const act=async(fn:()=>Promise<unknown>)=>{if(busy.current)return;busy.current=true;setSaving(true);try{await fn();setOpen(false);setReversing(undefined);message.success(t('common.saved'));await load()}catch(e){message.error(e instanceof Error?e.message:t('billing.errors.save'))}finally{setSaving(false);busy.current=false}}
 const save=async()=>{try{const v=await form.validateFields();await act(()=>billingApi.save('memos',{...v,type,requestId:requestId.current}))}catch{/* Field errors remain visible. */}}
 const reverse=async()=>{try{const v=await reverseForm.validateFields();if(reversing)await act(()=>billingApi.save('memos/'+reversing.id+'/void',{...v,version:reversing.version}))}catch{/* Field errors remain visible. */}}
 const required=[{required:true,message:t('common.required')}],requiredText=[{required:true,whitespace:true,message:t('common.required')}]
 const docType=(v:string)=>has('billing.docTypes.'+v)?t('billing.docTypes.'+v):v
 return <>
 <Alert type="info" showIcon title={credit?t('billing.memos.creditHelp'):t('billing.memos.debitHelp')} description={t('billing.memos.description')}/>
 <Space wrap style={{margin:'16px 0'}}><Button loading={loading} onClick={()=>void load()}>{t('common.refresh')}</Button>{canCreate&&<Button type="primary" onClick={()=>{form.resetFields();form.setFieldsValue({date:localDate()});requestId.current=crypto.randomUUID();setOpen(true)}}>{credit?t('billing.memos.newCredit'):t('billing.memos.newDebit')}</Button>}</Space>
 <DataGrid rowKey="id" loading={loading} dataSource={rows.filter(r=>r.details.type===type&&docs.some(d=>d.id===r.details.documentId&&scoped(d)))} scroll={{x:1000}} columns={[
 {title:t('billing.columns.number'),dataIndex:'number'},{title:t('billing.columns.originalDocument'),dataIndex:['details','documentNumber']},{title:t('billing.columns.party'),dataIndex:['details','partyName']},{title:t('common.date'),dataIndex:['details','date']},{title:t('common.amount'),align:'right',render:(_,r)=>formatMoney(r.details.amount,r.details.currency)},{title:t('billing.columns.reason'),dataIndex:['details','reason']},{title:t('common.status'),render:(_,r)=><Tag color={r.details.voided?'default':r.journalId?'green':'orange'}>{r.details.voided?t('billing.status.cancelledReversed'):r.journalId?t('billing.status.posted'):t('billing.status.draft')}</Tag>},
 {title:t('common.actions'),key:'actions',render:(_,r)=><RowActions><Button onClick={()=>setPreview(r)}>{t('billing.actions.viewPrint')}</Button>{!r.details.voided&&canPost&&<>{!r.journalId&&<Button disabled={saving} onClick={()=>act(()=>billingApi.save('memos/'+r.id+'/post',{id:r.id,version:r.version}))}>{t('billing.actions.postToAccounting')}</Button>}<Button danger onClick={()=>{reverseForm.resetFields();reverseForm.setFieldValue('date',localDate());setReversing(r)}}>{r.journalId?t('billing.memos.reverse'):t('billing.actions.cancelDraft')}</Button></>}</RowActions>}
 ]}/>
 <Modal centered width={760} open={open} title={credit?t('billing.memos.newCredit'):t('billing.memos.newDebit')} okText={t('billing.memos.saveDraft')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={()=>void save()} onCancel={()=>!saving&&setOpen(false)} destroyOnHidden>
 <Form form={form} layout="vertical" disabled={saving}>
 <Form.Item name="documentId" label={t('billing.memos.postedDocument')} rules={required}><Select showSearch optionFilterProp="label" options={docs.filter(d=>d.journalId&&!d.details.voided&&scoped(d)).map(d=>({value:d.id,label:d.number+' · '+d.details.partyName+' · '+formatMoney(d.balance,d.details.currency)}))} onChange={()=>form.setFieldsValue({chargeId:undefined,amount:undefined})}/></Form.Item>
 {doc&&<Alert style={{marginBottom:20}} type="info" title={t(credit?(doc.details.type==='INVOICE'?'billing.memos.reducesReceivable':'billing.memos.reducesPayable'):(doc.details.type==='INVOICE'?'billing.memos.increasesReceivable':'billing.memos.increasesPayable'),{currency:doc.details.currency})} description={t('billing.memos.currentOutstanding',{amount:formatMoney(doc.balance,doc.details.currency)})}/>}
 <Form.Item name="chargeId" label={t('billing.memos.originalCharge')} rules={required}><Select options={doc?.details.lines.map(l=>({value:l.chargeId,label:l.description+' · '+l.accountCode}))}/></Form.Item>
 <div className="job-form-grid"><Form.Item name="date" label={t('billing.memos.memoDate')} rules={required}><Input type="date"/></Form.Item><Form.Item name="amount" label={doc?t('billing.memos.amountIn',{currency:doc.details.currency}):t('billing.memos.amountInDocumentCurrency')} className="amount-field" rules={required}><InputNumber controls={false} min={0.0001} max={credit?doc?.balance:1000000000} precision={currencies?.currencies.find(c=>c.code===doc?.details.currency)?.decimalPlaces??2} style={{width:'100%'}}/></Form.Item></div>
 <Form.Item name="reason" label={t('billing.columns.reason')} rules={requiredText}><Input.TextArea rows={3} maxLength={1000} showCount/></Form.Item>
 </Form></Modal>
 <Modal centered open={!!reversing} title={reversing?.journalId?t('billing.memos.reverse'):t('billing.memos.cancelDraftMemo')} okText={t('common.confirm')} cancelText={t('common.cancel')} onCancel={()=>!saving&&setReversing(undefined)} onOk={()=>void reverse()} confirmLoading={saving}>
 <Form form={reverseForm} layout="vertical"><Form.Item name="date" label={t('common.date')} rules={required}><Input type="date"/></Form.Item><Form.Item name="reason" label={t('billing.columns.reason')} rules={requiredText}><Input.TextArea maxLength={500}/></Form.Item></Form>
 </Modal>
 <Modal title={t('billing.memos.preview')} open={!!preview} onCancel={()=>setPreview(undefined)} width={800} footer={<ReportPrintButton type={type} title={preview?.number??name} id={preview?.id} disabled={!preview}/>}>
 {preview&&<article className="printable-doc"><header><h1>{name}</h1><strong>{preview.number}</strong></header>
 <p>{preview.details.voided?t('billing.memos.printVoided'):preview.journalId?t('billing.memos.printPosted'):t('billing.print.draft')}</p>
 <p>{preview.details.partyName} · {preview.details.partyCode}</p><p>{t('billing.memos.printDate',{date:preview.details.date})}</p>
 <p>{t('billing.memos.printOriginal',{number:preview.details.documentNumber,type:docType(preview.details.documentType)})}</p>
 <table><thead><tr><th>{t('billing.columns.reason')}</th><th style={{textAlign:'end'}}>{t('common.amount')}</th><th style={{textAlign:'end'}}>{t('billing.columns.baseAmount')}</th></tr></thead><tbody><tr><td>{preview.details.reason}</td><td style={{textAlign:'end'}}>{formatMoney(preview.details.amount,preview.details.currency)}</td><td style={{textAlign:'end'}}>{formatMoney(preview.details.baseAmount,currencies?.baseCurrency??'USD')}</td></tr></tbody></table>
 </article>}
 </Modal>
 </>
}

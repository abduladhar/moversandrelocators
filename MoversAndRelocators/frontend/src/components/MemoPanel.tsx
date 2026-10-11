import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {useContext,useEffect,useRef,useState} from 'react'
import {Alert,Button,Form,Input,InputNumber,Modal,Select,Space,Tag,message} from 'antd'
import {BillingPermissions,billingApi,type DocumentRow,type Row} from '../billingApi'
import {request} from '../api'
import {formatMoney,localDate,useCurrencies} from '../currency'
import {DataGrid} from './DataGrid'
import {RowActions} from './RowActions'
export type Memo={type:string;documentId:string;documentNumber:string;documentType:string;chargeId:string;partyCode:string;partyName:string;currency:string;date:string;accountCode:string;amount:number;baseAmount:number;reason:string;voided:boolean}
export function MemoPanel({type,sourceId,sourceKind}:{type:'CREDIT_MEMO'|'DEBIT_MEMO';sourceId?:string;sourceKind?:string}){
 const permissions=useContext(BillingPermissions),canCreate=permissions.includes('billing.issue'),canPost=permissions.includes('billing.pay')
 const {data:currencies}=useCurrencies()
 const [rows,setRows]=useState<Row<Memo>[]>([]),[docs,setDocs]=useState<DocumentRow[]>([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[open,setOpen]=useState(false),[reversing,setReversing]=useState<Row<Memo>>()
 const [preview,setPreview]=useState<Row<Memo>>()
 const [form]=Form.useForm(),[reverseForm]=Form.useForm(),busy=useRef(false),requestId=useRef('')
 const documentId=Form.useWatch('documentId',form),doc=docs.find(d=>d.id===documentId),credit=type==='CREDIT_MEMO',name=credit?'credit memo':'debit memo'
 const load=async()=>{setLoading(true);try{const [m,d]=await Promise.all([request<Row<Memo>[]>('/api/billing/memos'),billingApi.documents()]);setRows(m);setDocs(d)}catch(e){message.error(e instanceof Error?e.message:'Unable to load memos')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[type,sourceId,sourceKind])
 const scoped=(d:DocumentRow)=>!sourceId||d.details.lines.some(l=>l.sourceId===sourceId&&l.sourceKind===sourceKind)
 const act=async(fn:()=>Promise<unknown>)=>{if(busy.current)return;busy.current=true;setSaving(true);try{await fn();setOpen(false);setReversing(undefined);message.success('Saved');await load()}catch(e){message.error(e instanceof Error?e.message:'Unable to save')}finally{setSaving(false);busy.current=false}}
 const save=async()=>{try{const v=await form.validateFields();await act(()=>billingApi.save('memos',{...v,type,requestId:requestId.current}))}catch{/* Field errors remain visible. */}}
 const reverse=async()=>{try{const v=await reverseForm.validateFields();if(reversing)await act(()=>billingApi.save('memos/'+reversing.id+'/void',{...v,version:reversing.version}))}catch{/* Field errors remain visible. */}}
 return <>
 <Alert type="info" showIcon title={credit?'Reduce a customer invoice or vendor bill':'Increase a customer invoice or vendor bill'} description="Select a posted document and its original charge. Save as draft, review, then post to accounting. The original document currency and saved conversion are used."/>
 <Space wrap style={{margin:'16px 0'}}><Button loading={loading} onClick={()=>void load()}>Refresh</Button>{canCreate&&<Button type="primary" onClick={()=>{form.resetFields();form.setFieldsValue({date:localDate()});requestId.current=crypto.randomUUID();setOpen(true)}}>New {name}</Button>}</Space>
 <DataGrid rowKey="id" loading={loading} dataSource={rows.filter(r=>r.details.type===type&&docs.some(d=>d.id===r.details.documentId&&scoped(d)))} scroll={{x:1000}} columns={[
 {title:'Number',dataIndex:'number'},{title:'Original document',dataIndex:['details','documentNumber']},{title:'Customer / vendor',dataIndex:['details','partyName']},{title:'Date',dataIndex:['details','date']},{title:'Amount',align:'right',render:(_,r)=>formatMoney(r.details.amount,r.details.currency)},{title:'Reason',dataIndex:['details','reason']},{title:'Status',render:(_,r)=><Tag color={r.details.voided?'default':r.journalId?'green':'orange'}>{r.details.voided?'Cancelled / reversed':r.journalId?'Posted':'Draft'}</Tag>},
 {title:'Actions',key:'actions',render:(_,r)=><RowActions><Button onClick={()=>setPreview(r)}>View / print</Button>{!r.details.voided&&canPost&&<>{!r.journalId&&<Button disabled={saving} onClick={()=>act(()=>billingApi.save('memos/'+r.id+'/post',{id:r.id,version:r.version}))}>Post to accounting</Button>}<Button danger onClick={()=>{reverseForm.resetFields();reverseForm.setFieldValue('date',localDate());setReversing(r)}}>{r.journalId?'Reverse memo':'Cancel draft'}</Button></>}</RowActions>}
 ]}/>
 <Modal centered width={760} open={open} title={'New '+name} okText="Save draft" confirmLoading={saving} onOk={()=>void save()} onCancel={()=>!saving&&setOpen(false)} destroyOnHidden>
 <Form form={form} layout="vertical" disabled={saving}>
 <Form.Item name="documentId" label="Posted invoice / bill" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={docs.filter(d=>d.journalId&&!d.details.voided&&scoped(d)).map(d=>({value:d.id,label:d.number+' · '+d.details.partyName+' · '+formatMoney(d.balance,d.details.currency)}))} onChange={()=>form.setFieldsValue({chargeId:undefined,amount:undefined})}/></Form.Item>
 {doc&&<Alert style={{marginBottom:20}} type="info" title={(credit?'Reduces':'Increases')+' '+(doc.details.type==='INVOICE'?'customer receivable':'vendor payable')+' in '+doc.details.currency} description={'Current outstanding: '+formatMoney(doc.balance,doc.details.currency)}/>}
 <Form.Item name="chargeId" label="Original charge" rules={[{required:true}]}><Select options={doc?.details.lines.map(l=>({value:l.chargeId,label:l.description+' · '+l.accountCode}))}/></Form.Item>
 <div className="job-form-grid"><Form.Item name="date" label="Memo date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="amount" label={'Amount ('+(doc?.details.currency||'document currency')+')'} className="amount-field" rules={[{required:true}]}><InputNumber controls={false} min={0.0001} max={credit?doc?.balance:1000000000} precision={currencies?.currencies.find(c=>c.code===doc?.details.currency)?.decimalPlaces??2} style={{width:'100%'}}/></Form.Item></div>
 <Form.Item name="reason" label="Reason" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={3} maxLength={1000} showCount/></Form.Item>
 </Form></Modal>
 <Modal centered open={!!reversing} title={reversing?.journalId?'Reverse memo':'Cancel draft memo'} onCancel={()=>!saving&&setReversing(undefined)} onOk={()=>void reverse()} confirmLoading={saving}>
 <Form form={reverseForm} layout="vertical"><Form.Item name="date" label="Date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="reason" label="Reason" rules={[{required:true,whitespace:true}]}><Input.TextArea maxLength={500}/></Form.Item></Form>
 </Modal>
 <Modal title="Memo preview" open={!!preview} onCancel={()=>setPreview(undefined)} width={800} footer={<ReportPrintButton type={type} title={preview?.number??name} id={preview?.id} disabled={!preview}/>}>
 {preview&&<article className="printable-doc"><header><h1>{name}</h1><strong>{preview.number}</strong></header>
 <p>{preview.details.voided?'VOID / REVERSED':preview.journalId?'POSTED':'DRAFT — NOT POSTED TO ACCOUNTING'}</p>
 <p>{preview.details.partyName} · {preview.details.partyCode}</p><p>Date: {preview.details.date}</p>
 <p>Original document: {preview.details.documentNumber} · {preview.details.documentType}</p>
 <table><thead><tr><th>Reason</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>Base amount</th></tr></thead><tbody><tr><td>{preview.details.reason}</td><td style={{textAlign:'right'}}>{formatMoney(preview.details.amount,preview.details.currency)}</td><td style={{textAlign:'right'}}>{formatMoney(preview.details.baseAmount,currencies?.baseCurrency??'USD')}</td></tr></tbody></table>
 </article>}
 </Modal>
 </>
}



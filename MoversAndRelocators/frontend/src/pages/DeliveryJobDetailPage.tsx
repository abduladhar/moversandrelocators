import {useEffect,useMemo,useRef,useState} from 'react'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts } from '../expenseReceipts'
import {Alert,AutoComplete,Button,Card,Checkbox,Col,Empty,Form,Input,InputNumber,Modal,Popconfirm,Row,Select,Space,Spin,Statistic,Table,Tabs,Tag,Typography,message} from 'antd'
import type {ColumnsType} from 'antd/es/table'
import {ArrowLeftOutlined,CalendarOutlined,CarOutlined,CheckCircleOutlined,CloseCircleOutlined,DeleteOutlined,DollarOutlined,EditOutlined,EnvironmentOutlined,FileDoneOutlined,IdcardOutlined,InboxOutlined,LinkOutlined,PlusOutlined,RollbackOutlined,StopOutlined,TeamOutlined,UploadOutlined,UserOutlined} from '@ant-design/icons'
import {crewApi,type Team as CrewTeam} from '../crewApi'
import {deliveryApi,DELIVERY_STATUS,ITEM_STATUS,type DeliveryAvailable,type DeliveryDetail,type DeliveryItem,type DeliveryMasters,type DeliveryNote,type DeliveryJobBox,type SaveDelivery} from '../deliveryApi'
import type {WarehouseStock} from '../warehouseApi'
import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {BillingPanel} from '../components/BillingPanel'
import {DataGrid} from '../components/DataGrid'
import {SignaturePad,type SignaturePadHandle} from '../components/SignaturePad'
import {TripClockCard} from '../components/TripClockCard'
import {useBilling} from '../billingApi'
import {CurrencyFields,formatMoney,useCurrencies} from '../currency'
import {mapsUrl} from '../packingApi'
import {formatDateTime,useT} from '../i18n'
import {CustomerStatusTags,DeliveryCustomerLinks} from '../components/delivery/DeliveryCustomerLinks'

const when=(v:string|null)=>v?formatDateTime(v):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)
type Act=(f:()=>Promise<DeliveryDetail>,done?:string)=>Promise<DeliveryDetail|undefined>

/** One delivery run: customer delivery notes with item-by-item delivery and signatures, crew and driver, trip, money and billing. */
export function DeliveryJobDetailPage({jobId,onBack,onChanged}:{jobId:string;onBack:()=>void;onChanged:()=>void}){
 const {t}=useT()
 const [detail,setDetail]=useState<DeliveryDetail>(),[masters,setMasters]=useState<DeliveryMasters>(),[busy,setBusy]=useState(false),[tab,setTab]=useState('notes'),[editOpen,setEditOpen]=useState(false),[loadOpen,setLoadOpen]=useState(false)
 const canBill=useBilling()
 const load=()=>Promise.all([deliveryApi.get(jobId),deliveryApi.masters()]).then(([d,m])=>{setDetail(d);setMasters(m)}).catch(e=>fail(e,t('delivery.detail.loadFailed')))
 useEffect(()=>{void load()},[jobId])
 /** Run a mutation that returns the updated delivery. */
 const act:Act=async(f,done)=>{setBusy(true);try{const d=await f();setDetail(d);onChanged();if(done)message.success(done);return d}catch(e){fail(e,t('delivery.detail.actionFailed'));return undefined}finally{setBusy(false)}}
 /** Trip clock steps report failures themselves, so the card stays open on error. */
 const trip=async(f:()=>Promise<DeliveryDetail>)=>{const d=await f();setDetail(d);onChanged()}
 if(!detail||!masters)return <div style={{padding:60,textAlign:'center'}}><Spin/></div>
 const j=detail.job,locked=j.status==='COMPLETED'||j.status==='CANCELLED',status=DELIVERY_STATUS[j.status],cur=detail.accounting.baseCurrency
 const items=detail.notes.flatMap(n=>n.items)
 const notAssigned=t('delivery.detail.fact.notAssigned')

 const kpis=[
  {key:'packages',icon:<InboxOutlined/>,label:t('delivery.detail.kpi.packages'),value:items.length},
  {key:'delivered',icon:<CheckCircleOutlined/>,label:t('delivery.detail.kpi.delivered'),value:j.deliveredCount},
  {key:'returned',icon:<CloseCircleOutlined/>,label:t('delivery.detail.kpi.returned'),value:j.returnedCount},
  {key:'notes',icon:<FileDoneOutlined/>,label:t('delivery.detail.kpi.notesSigned'),value:j.noteCount?j.signedCount+' / '+j.noteCount:'—'},
  {key:'distance',icon:<CarOutlined/>,label:t('delivery.detail.kpi.distance'),value:j.distanceKm!=null?t('delivery.km',{value:j.distanceKm}):'—'},
  {key:'collected',icon:<DollarOutlined/>,label:t('delivery.detail.kpi.collected'),value:<>{formatMoney(detail.accounting.incomeBase,cur)}</>}
 ]
 const facts=[
  {key:'scheduled',icon:<CalendarOutlined/>,label:t('delivery.detail.fact.scheduled'),value:<>{when(j.scheduledAtUtc)}<div><small>{t('delivery.detail.fact.hoursPlanned',{hours:Math.round(j.durationMinutes/6)/10})}</small></div></>},
  {key:'vehicle',icon:<CarOutlined/>,label:t('delivery.detail.fact.vehicle'),value:j.vehicleName??notAssigned},
  {key:'driver',icon:<IdcardOutlined/>,label:t('delivery.detail.fact.driver'),value:j.driverName??notAssigned},
  {key:'crew',icon:<TeamOutlined/>,label:t('delivery.detail.fact.crew'),value:detail.crew.length?detail.crew.map(c=>c.employeeName).join(', '):notAssigned},
  {key:'customers',icon:<UserOutlined/>,label:t('delivery.detail.fact.customers'),value:j.customers.length?j.customers.join(', '):'—'}
 ]

 return <div className="survey-workspace packing-workspace">
  <div className="survey-workspace-header">
   <div className="survey-heading"><Button icon={<ArrowLeftOutlined/>} onClick={onBack} aria-label={t('delivery.detail.back')}/><div><Typography.Text className="eyebrow">{t('delivery.detail.eyebrow')}</Typography.Text><Typography.Title level={2}>{j.deliveryNumber}<span className="survey-heading-customer">{j.customers.length===1?j.customers[0]:j.customers.length?t('delivery.detail.customersCount',{count:j.customers.length}):''}</span><Tag className="survey-status-tag" color={status.color}>{t('delivery.status.'+j.status)}</Tag></Typography.Title></div></div>
   <Space wrap className="survey-heading-actions">
    {j.status==='PLANNED'&&<Button type="primary" icon={<UploadOutlined/>} onClick={()=>setLoadOpen(true)}>{t('delivery.detail.loadPackages')}</Button>}
    <Button icon={<EditOutlined/>} disabled={locked} onClick={()=>setEditOpen(true)}>{t('delivery.detail.editDetails')}</Button>
    {!locked&&<Popconfirm title={t('delivery.detail.cancelTitle')} description={t('delivery.detail.cancelDescription')} okText={t('common.yes')} cancelText={t('common.no')} okButtonProps={{danger:true}} onConfirm={()=>void act(()=>deliveryApi.cancel(jobId),t('delivery.detail.cancelled'))}><Button danger icon={<StopOutlined/>} loading={busy}>{t('delivery.detail.cancelDelivery')}</Button></Popconfirm>}
   </Space>
  </div>
  {locked&&<Alert type={j.status==='COMPLETED'?'success':'warning'} showIcon title={j.status==='COMPLETED'?t('delivery.detail.completedAlert',{date:when(j.completedAtUtc)}):t('delivery.detail.cancelledAlert')}/>}
  {j.status==='PLANNED'&&!items.length&&<Alert type="info" showIcon title={t('delivery.detail.loadHint')}/>}
  <div className="survey-kpi-row packing-kpi-row">{kpis.map(k=><div key={k.key} className={'survey-kpi packing-kpi-'+k.key}><span className="survey-kpi-icon">{k.icon}</span><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
  <Card className="survey-customer-strip"><div className="survey-facts pickup-facts">{facts.map(f=><div key={f.key} className="survey-fact"><span className="survey-fact-icon">{f.icon}</span><div><small>{f.label}</small><div className="survey-fact-value">{f.value}</div></div></div>)}</div>
   {j.notes&&<div className="packing-notes"><small>{t('delivery.detail.notes')}</small>{j.notes}</div>}</Card>
  {j.status!=='CANCELLED'&&<TripClockCard noun="delivery" startedAtUtc={j.startedAtUtc} endedAtUtc={j.completedAtUtc} isPaused={j.isPaused} distanceKm={j.distanceKm}
   events={detail.clock.events.map((e,i)=>({id:String(i),...e}))}
   onStart={at=>items.length?trip(()=>deliveryApi.start(jobId,at)):Promise.reject(new Error(t('delivery.detail.loadBeforeStart')))}
   onPause={(reason,at)=>trip(()=>deliveryApi.pause(jobId,reason,at))} onResume={at=>trip(()=>deliveryApi.resume(jobId,at))}
   onComplete={x=>trip(()=>deliveryApi.complete(jobId,{at:x.at,distanceKm:x.distanceKm}))} onEdit={x=>trip(()=>deliveryApi.distance(jobId,x.distanceKm))}/>}
  <Tabs className="pickup-tabs" activeKey={tab} onChange={setTab} items={[
   {key:'notes',label:<span><FileDoneOutlined/> {t('delivery.detail.tab.notes',{count:detail.notes.length})}</span>,children:<NotesTab detail={detail} act={act}/>},
   {key:'crew',label:<span><TeamOutlined/> {t('delivery.detail.tab.crew')}</span>,children:<CrewTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'money',label:t('delivery.detail.tab.money'),children:<MoneyTab detail={detail} masters={masters} act={act}/>},
   ...(canBill?[{key:'billing',label:t('delivery.detail.tab.billing'),children:<BillingPanel sourceKind="DELIVERY" sourceId={jobId} companyName=""/>}]:[])
  ]}/>
  <EditModal open={editOpen} detail={detail} onClose={()=>setEditOpen(false)} onSave={v=>act(()=>deliveryApi.update(jobId,v),t('delivery.detail.detailsSaved')).then(d=>{if(d)setEditOpen(false)})}/>
  <LoadModal open={loadOpen} onClose={()=>setLoadOpen(false)} onLoad={(w,jb)=>act(()=>deliveryApi.load(jobId,w,jb),t('delivery.detail.packagesLoaded')).then(d=>{if(d)setLoadOpen(false)})}/>
 </div>
}

/* ---------------- delivery notes ---------------- */
function NotesTab({detail,act}:{detail:DeliveryDetail;act:Act}){
 const {t}=useT()
 const [linksFor,setLinksFor]=useState<string|null>(null),[signing,setSigning]=useState<DeliveryNote|null>(null),[editing,setEditing]=useState<DeliveryNote|null>(null),[marking,setMarking]=useState<{item:DeliveryItem;note:DeliveryNote;status:'DELIVERED'|'RETURNED'}|null>(null)
 const j=detail.job,planned=j.status==='PLANNED',out=j.status==='OUT_FOR_DELIVERY'
 if(!detail.notes.length)return <Empty description={planned?t('delivery.notes.emptyPlanned'):t('delivery.notes.empty')}/>
 const columns=(note:DeliveryNote):ColumnsType<DeliveryItem>=>[
  {title:t('delivery.notes.col.package'),dataIndex:'trackingNumber',render:(_,x)=><div className="primary-cell"><strong>{x.trackingNumber}</strong><small>{x.description}</small></div>},
  {title:t('delivery.notes.col.contents'),dataIndex:'contents',ellipsis:true},
  {title:t('delivery.notes.col.loadedFrom'),key:'from',render:(_,x)=><div className="primary-cell"><span>{x.source==='JOB'?t('delivery.notes.fromJob',{reference:x.reference}):x.location}</span><small>{x.source==='JOB'?t('delivery.notes.transportJob'):t('delivery.notes.warehouseRef',{reference:x.reference})}</small></div>},
  {title:t('common.status'),key:'status',render:(_,x)=><div className="primary-cell"><span><Tag color={ITEM_STATUS[x.status].color}>{t('delivery.itemStatus.'+x.status)}</Tag></span>{x.status!=='LOADED'&&<small>{[x.receivedBy&&t('delivery.notes.receivedBy',{name:x.receivedBy}),x.notes,when(x.statusAtUtc)].filter(Boolean).join(' · ')}</small>}</div>},
  {title:'',key:'actions',width:260,render:(_,x)=>note.isSigned?null:<Space size={4} wrap>
   {out&&x.status!=='DELIVERED'&&<Button size="small" type="primary" icon={<CheckCircleOutlined/>} onClick={()=>setMarking({item:x,note,status:'DELIVERED'})}>{t('delivery.notes.delivered')}</Button>}
   {out&&x.status!=='RETURNED'&&<Button size="small" danger icon={<CloseCircleOutlined/>} onClick={()=>setMarking({item:x,note,status:'RETURNED'})}>{t('delivery.notes.notDelivered')}</Button>}
   {out&&x.status!=='LOADED'&&<Button size="small" type="text" icon={<RollbackOutlined/>} onClick={()=>void act(()=>deliveryApi.itemStatus(j.id,x.id,{status:'LOADED'}),t('delivery.notes.setBackToLoaded'))}>{t('delivery.notes.undo')}</Button>}
   {planned&&<Popconfirm title={t('delivery.notes.removeTitle')} description={x.source==='WAREHOUSE'?t('delivery.notes.removeWarehouse'):t('delivery.notes.removeJob')} okText={t('common.yes')} cancelText={t('common.no')} onConfirm={()=>void act(()=>deliveryApi.unload(j.id,x.id),t('delivery.notes.removed'))}><Button size="small" type="text" danger icon={<DeleteOutlined/>}>{t('common.remove')}</Button></Popconfirm>}
  </Space>}
 ]
 return <Space direction="vertical" size={16} style={{width:'100%'}}>
  {out&&<Alert type="info" showIcon title={t('delivery.notes.outHint')}/>}
  {detail.notes.map(note=>{
   const delivered=note.items.filter(i=>i.status==='DELIVERED').length
   const signedDelivered=note.signedItems.filter(i=>i.status==='DELIVERED').length,signedMissing=note.signedItems.filter(i=>i.status!=='DELIVERED').length
   return <Card key={note.id} title={<Space wrap><span>{note.noteNumber}</span><strong>{note.customerName}</strong>{note.isSigned?<Tag color="green">{t('delivery.notes.signed')}</Tag>:<Tag color="gold">{t('delivery.notes.notSigned')}</Tag>}<Tag>{t('delivery.notes.deliveredProgress',{delivered,total:note.items.length})}</Tag><CustomerStatusTags note={note}/></Space>}
    extra={<Space wrap>
     {!note.isSigned&&j.status!=='COMPLETED'&&j.status!=='CANCELLED'&&<Button size="small" icon={<LinkOutlined/>} onClick={()=>setLinksFor(note.id)}>{t('delivery.notes.customerLinks')}</Button>}
     <ReportPrintButton type="DELIVERY_NOTE" title={note.noteNumber+' · '+note.customerName} id={j.id} query={{noteId:note.id}} label={t('delivery.notes.deliveryNote')} size="small"/>
     {!note.isSigned&&j.status!=='COMPLETED'&&j.status!=='CANCELLED'&&<Button size="small" icon={<EditOutlined/>} onClick={()=>setEditing(note)}>{t('delivery.notes.receiver')}</Button>}
     {!note.isSigned&&out&&<Button size="small" type="primary" icon={<EditOutlined/>} onClick={()=>setSigning(note)}>{t('delivery.notes.takeSignature')}</Button>}
    </Space>}>
    <div className="survey-facts pickup-facts" style={{marginBottom:12}}>
     <div className="survey-fact"><span className="survey-fact-icon"><UserOutlined/></span><div><small>{t('delivery.notes.receiver')}</small><div className="survey-fact-value">{note.contactName??note.customerName}{note.phone?' · '+note.phone:''}</div></div></div>
     <div className="survey-fact"><span className="survey-fact-icon"><EnvironmentOutlined/></span><div><small>{t('delivery.notes.deliveryAddress')}</small><div className="survey-fact-value">{note.address||note.customer.latitude!=null?<a href={mapsUrl(note.address??'',note.customer.latitude,note.customer.longitude)} target="_blank" rel="noopener noreferrer">{note.address??t('delivery.notes.location')}{note.customer.latitude!=null?' · '+t('delivery.notes.gps'):''}</a>:'—'}{note.customer.locationNotes&&<div><small>{note.customer.locationNotes}</small></div>}</div></div></div>
     {note.collected>0&&<div className="survey-fact"><span className="survey-fact-icon"><DollarOutlined/></span><div><small>{t('delivery.notes.collected')}</small><div className="survey-fact-value">{formatMoney(note.collected,detail.accounting.baseCurrency)}</div></div></div>}
    </div>
    <Table rowKey="id" size="small" pagination={false} scroll={{x:900}} dataSource={note.items} columns={columns(note)}/>
    {note.isSigned&&<div className="delivery-signature">
     {note.signaturePng&&<img src={note.signaturePng} alt={t('delivery.notes.signatureAlt',{name:note.signerName})} style={{maxWidth:280,maxHeight:110,border:'1px solid #e3e8ef',borderRadius:6,background:'#fff'}}/>}
     <div><strong>{t('delivery.notes.signedBy',{name:note.signerName})}</strong><div style={{color:'#6b7686'}}>{t('delivery.notes.recordedBy',{date:when(note.signedAtUtc),name:note.signedBy})}</div>{note.remarks&&<div>{t('delivery.notes.remarks',{remarks:note.remarks})}</div>}
      <div style={{color:'#6b7686'}}>{signedMissing?t('delivery.notes.coversWithMissing',{delivered:signedDelivered,missing:signedMissing}):t('delivery.notes.covers',{count:signedDelivered})}</div></div>
    </div>}
   </Card>})}
  <DeliveryCustomerLinks detail={detail} note={detail.notes.find(n=>n.id===linksFor)??null} open={linksFor!==null} onClose={()=>setLinksFor(null)} act={act}/>
  <SignModal note={signing} onClose={()=>setSigning(null)} onSign={v=>act(()=>deliveryApi.sign(j.id,signing!.id,v),t('delivery.notes.signedDone')).then(d=>{if(d)setSigning(null)})}/>
  <ReceiverModal note={editing} onClose={()=>setEditing(null)} onSave={v=>act(()=>deliveryApi.note(j.id,editing!.id,v),t('delivery.notes.receiverSaved')).then(d=>{if(d)setEditing(null)})}/>
  <ItemStatusModal value={marking} onClose={()=>setMarking(null)} onSave={v=>act(()=>deliveryApi.itemStatus(j.id,marking!.item.id,{status:marking!.status,...v}),marking!.status==='DELIVERED'?t('delivery.notes.packageDelivered'):t('delivery.notes.packageNotDelivered')).then(d=>{if(d)setMarking(null)})}/>
 </Space>
}

function ItemStatusModal({value,onClose,onSave}:{value:{item:DeliveryItem;note:DeliveryNote;status:'DELIVERED'|'RETURNED'}|null;onClose:()=>void;onSave:(v:{receivedBy?:string|null;notes?:string|null})=>Promise<void>}){
 const {t}=useT()
 const [form]=Form.useForm<{receivedBy?:string;notes?:string}>()
 useEffect(()=>{if(value)form.setFieldsValue({receivedBy:value.item.receivedBy??value.note.contactName??value.note.customerName,notes:value.item.notes??''})},[value])
 const delivered=value?.status==='DELIVERED'
 const number=value?.item.trackingNumber??''
 const reasons=(['notAvailable','refused','wrongAddress','damaged','noAccess'] as const).map(k=>({value:t('delivery.itemModal.reasons.'+k)}))
 return <Modal centered open={value!==null} title={delivered?t('delivery.itemModal.deliveredTitle',{number}):t('delivery.itemModal.notDeliveredTitle',{number})} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({receivedBy:delivered?v.receivedBy||null:null,notes:v.notes||null}))} destroyOnHidden>
  <Form form={form} layout="vertical">
   {delivered&&<Form.Item label={t('delivery.itemModal.receivedBy')} name="receivedBy" rules={[{max:160}]}><Input/></Form.Item>}
   <Form.Item label={delivered?t('delivery.itemModal.conditionNotes'):t('delivery.itemModal.reason')} name="notes" rules={[{required:!delivered,message:t('delivery.itemModal.reasonRequired')},{max:500}]}>
    {delivered?<Input placeholder={t('delivery.itemModal.goodCondition')}/>:<AutoComplete options={reasons} placeholder={t('delivery.itemModal.reasonPlaceholder')}/>}
   </Form.Item>
   {!delivered&&<Alert type="info" showIcon title={value?.item.source==='WAREHOUSE'?t('delivery.itemModal.returnWarehouse'):t('delivery.itemModal.returnJob')}/>}
  </Form>
 </Modal>
}

function ReceiverModal({note,onClose,onSave}:{note:DeliveryNote|null;onClose:()=>void;onSave:(v:{contactName:string|null;phone:string|null;address:string|null})=>Promise<void>}){
 const {t}=useT()
 const [form]=Form.useForm()
 useEffect(()=>{if(note)form.setFieldsValue({contactName:note.contactName??'',phone:note.phone??'',address:note.address??''})},[note])
 return <Modal centered open={note!==null} title={t('delivery.receiverModal.title',{name:note?.customerName??''})} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({contactName:v.contactName||null,phone:v.phone||null,address:v.address||null}))} destroyOnHidden>
  <Form form={form} layout="vertical">
   <Form.Item label={t('delivery.receiverModal.contactName')} name="contactName" rules={[{max:160}]}><Input/></Form.Item>
   <Form.Item label={t('delivery.receiverModal.phone')} name="phone" rules={[{max:40}]}><Input/></Form.Item>
   <Form.Item label={t('delivery.receiverModal.address')} name="address" rules={[{max:500}]}><Input.TextArea autoSize={{minRows:2,maxRows:4}}/></Form.Item>
  </Form>
 </Modal>
}

/** Customer signature on their delivery note. Ticked packages are recorded as delivered to the signer. */
function SignModal({note,onClose,onSign}:{note:DeliveryNote|null;onClose:()=>void;onSign:(v:{signerName:string;signaturePng:string;remarks:string|null;deliveredItemIds:string[]})=>Promise<void>}){
 const {t}=useT()
 const pad=useRef<SignaturePadHandle>(null),[form]=Form.useForm<{signerName:string;remarks?:string}>(),[ticked,setTicked]=useState<string[]>([])
 useEffect(()=>{if(note){form.setFieldsValue({signerName:note.contactName??note.customerName,remarks:''});setTicked(note.items.filter(i=>i.status!=='RETURNED').map(i=>i.id))}},[note])
 const sign=async()=>{const v=await form.validateFields();const png=pad.current?.toDataUrl()
  if(!png){message.error(t('delivery.signModal.signMissing'));return}
  if(!ticked.length&&!note?.items.some(i=>i.status==='DELIVERED')){message.error(t('delivery.signModal.tickMissing'));return}
  await onSign({signerName:v.signerName,signaturePng:png,remarks:v.remarks||null,deliveredItemIds:ticked})}
 return <Modal centered width={720} open={note!==null} title={t('delivery.signModal.title',{number:note?.noteNumber??''})} okText={t('delivery.signModal.confirm')} cancelText={t('common.cancel')} onCancel={onClose} onOk={()=>void sign()} destroyOnHidden>
  {note&&<>
   <Typography.Paragraph type="secondary">{note.customerName}{note.address?' · '+note.address:''}</Typography.Paragraph>
   <Card size="small" title={t('delivery.signModal.packagesReceived')} style={{marginBottom:12}}>
    {note.items.map(i=><div key={i.id} style={{padding:'4px 0'}}>
     <Checkbox checked={ticked.includes(i.id)||i.status==='DELIVERED'} disabled={i.status==='DELIVERED'||i.status==='RETURNED'} onChange={e=>setTicked(e.target.checked?[...ticked,i.id]:ticked.filter(x=>x!==i.id))}>
      <strong>{i.trackingNumber}</strong> · {i.description}{i.status==='RETURNED'?<Tag color="volcano" style={{marginInlineStart:6}}>{t('delivery.itemStatus.RETURNED')}</Tag>:null}
     </Checkbox></div>)}
   </Card>
   <Alert type="info" showIcon style={{marginBottom:12}} title={t('delivery.signModal.statement')}/>
   <Form form={form} layout="vertical" requiredMark={false}>
    <Form.Item label={t('delivery.signModal.signedBy')} name="signerName" rules={[{required:true,message:t('delivery.signModal.signedByRequired')},{max:160}]}><Input/></Form.Item>
    <Form.Item label={t('delivery.signModal.remarks')} name="remarks" rules={[{max:1000}]}><Input.TextArea autoSize={{minRows:1,maxRows:3}}/></Form.Item>
   </Form>
   <SignaturePad ref={pad} label={t('delivery.signModal.padLabel')}/>
  </>}
 </Modal>
}

/* ---------------- loading ---------------- */
function LoadModal({open,onClose,onLoad}:{open:boolean;onClose:()=>void;onLoad:(warehouseBoxIds:string[],jobBoxes:{jobId:string;boxId:string}[])=>Promise<void>}){
 const {t}=useT()
 const [available,setAvailable]=useState<DeliveryAvailable>(),[warehouseKeys,setWarehouseKeys]=useState<string[]>([]),[jobKeys,setJobKeys]=useState<string[]>([]),[query,setQuery]=useState(''),[source,setSource]=useState('warehouse'),[saving,setSaving]=useState(false)
 useEffect(()=>{if(!open)return;setAvailable(undefined);setWarehouseKeys([]);setJobKeys([]);setQuery('');deliveryApi.available().then(setAvailable).catch(e=>fail(e,t('delivery.loadModal.availableFailed')))},[open])
 const match=(...v:(string|null|undefined)[])=>v.join(' ').toLowerCase().includes(query.toLowerCase())
 const jobKey=(x:DeliveryJobBox)=>x.jobId+'|'+x.box.id
 const warehouse=(available?.warehouse??[]).filter(s=>match(s.trackingNumber,s.customerName,s.location,s.contents,s.description))
 const jobs=(available?.jobs??[]).filter(x=>match(x.jobNumber,x.box.trackingNumber,x.box.customerName,x.box.contents,x.destination))
 const count=warehouseKeys.length+jobKeys.length
 const load=async()=>{setSaving(true);try{await onLoad(warehouseKeys,jobKeys.map(k=>{const [jobId,boxId]=k.split('|');return {jobId,boxId}}))}finally{setSaving(false)}}
 const box=(s:WarehouseStock)=><div className="primary-cell"><strong>{s.trackingNumber}</strong><small>{s.description}</small></div>
 return <Modal title={t('delivery.loadModal.title')} open={open} width={1080} onCancel={()=>!saving&&onClose()} okText={t('delivery.loadModal.ok',{count})} cancelText={t('common.cancel')} confirmLoading={saving} okButtonProps={{disabled:!count}} onOk={()=>void load()} destroyOnHidden>
  {!available?<div style={{padding:40,textAlign:'center'}}><Spin/></div>:<>
   <Input.Search style={{marginBottom:12,maxWidth:380}} aria-label={t('delivery.loadModal.search')} placeholder={t('delivery.loadModal.searchPlaceholder')} allowClear value={query} onChange={e=>setQuery(e.target.value)}/>
   <Tabs activeKey={source} onChange={setSource} items={[
    {key:'warehouse',label:t('delivery.loadModal.fromWarehouse',{selected:warehouseKeys.length,total:available.warehouse.length}),children:<>
     <DataGrid<WarehouseStock> rowKey="id" size="small" rowSelection={{selectedRowKeys:warehouseKeys,onChange:k=>setWarehouseKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={warehouse}
      columns={[{title:t('delivery.loadModal.col.package'),key:'box',render:(_,s)=>box(s)},{title:t('delivery.loadModal.col.customer'),dataIndex:'customerName'},{title:t('delivery.loadModal.col.warehouseRack'),dataIndex:'location'},{title:t('delivery.loadModal.col.receipt'),dataIndex:'reference'},{title:t('delivery.loadModal.col.contents'),dataIndex:'contents',ellipsis:true}]}/>
     <Alert type="info" showIcon title={t('delivery.loadModal.warehouseHint')}/>
    </>},
    {key:'jobs',label:t('delivery.loadModal.fromJobs',{selected:jobKeys.length,total:available.jobs.length}),children:<>
     <DataGrid<DeliveryJobBox> rowKey={jobKey} size="small" rowSelection={{selectedRowKeys:jobKeys,onChange:k=>setJobKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={jobs}
      columns={[{title:t('delivery.loadModal.col.job'),key:'job',render:(_,x)=><div className="primary-cell"><strong>{x.jobNumber}</strong><small>{x.jobStatus==='ARRIVED'?t('delivery.loadModal.arrived'):t('delivery.loadModal.inTransit')} · {x.destination}</small></div>},
       {title:t('delivery.loadModal.col.package'),key:'box',render:(_,x)=>box(x.box)},{title:t('delivery.loadModal.col.customer'),key:'customer',render:(_,x)=>x.box.customerName},{title:t('delivery.loadModal.col.deliverTo'),key:'to',render:(_,x)=>x.shipping?.dropAddress??x.shipping?.consignee?.address??'—'},{title:t('delivery.loadModal.col.contents'),key:'contents',ellipsis:true,render:(_,x)=>x.box.contents}]}/>
     <Alert type="info" showIcon title={t('delivery.loadModal.jobsHint')}/>
    </>}
   ]}/>
  </>}
 </Modal>
}

/* ---------------- crew, driver and vehicle ---------------- */
function CrewTab({detail,masters,locked,act}:{detail:DeliveryDetail;masters:DeliveryMasters;locked:boolean;act:Act}){
 const {t}=useT()
 const initial=()=>({rows:detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})),driver:detail.job.driverEmployeeId,vehicle:detail.job.vehicleId})
 const [state,setState]=useState(initial()),[teams,setTeams]=useState<CrewTeam[]>([])
 useEffect(()=>{crewApi.teams().then(setTeams).catch(()=>setTeams([]))},[])
 useEffect(()=>setState(initial()),[detail.crew,detail.job.driverEmployeeId,detail.job.vehicleId])
 const {rows}=state,setRows=(r:typeof rows)=>setState({...state,rows:r})
 // Fallback role names are stored on the crew record as data, so they stay as the master list names them.
 const roles=masters.crewRoles.length?masters.crewRoles.map(r=>r.name):['Team leader','Driver','Helper']
 const used=new Set(rows.map(r=>r.employeeId)),dirty=JSON.stringify(state)!==JSON.stringify(initial())
 const vehicle=masters.vehicles.find(v=>v.id===state.vehicle)
 const assignTeam=(id:string)=>{const team=teams.find(x=>x.id===id);if(!team)return
  const members=team.members.filter(m=>!m.leftAtUtc)
  setRows([...rows.filter(r=>r.employeeId&&!members.some(m=>m.employeeId===r.employeeId)),...members.map(m=>({employeeId:m.employeeId,role:m.role}))])}
 const save=()=>act(()=>deliveryApi.crew(detail.job.id,{crew:rows,driverEmployeeId:state.driver??null,vehicleId:state.vehicle??null}),t('delivery.crewTab.saved'))
 return <Row gutter={[16,16]}>
  <Col xs={24} lg={9}><Card title={t('delivery.crewTab.vehicleAndDriver')}>
   <Form layout="vertical">
    <Form.Item label={t('delivery.crewTab.vehicle')}><Select allowClear showSearch optionFilterProp="label" disabled={locked} placeholder={masters.vehicles.length?t('delivery.crewTab.selectVehicle'):t('delivery.crewTab.addVehicles')} value={state.vehicle??undefined} onChange={v=>setState({...state,vehicle:v??null})}
     options={masters.vehicles.map(v=>({value:v.id,label:v.registrationNumber+' · '+v.name}))}/></Form.Item>
    {vehicle?.driverName&&<Typography.Paragraph type="secondary">{t('delivery.crewTab.usualDriver',{name:vehicle.driverName})}{vehicle.driverPhone?' · '+vehicle.driverPhone:''}</Typography.Paragraph>}
    <Form.Item label={t('delivery.crewTab.driver')} extra={t('delivery.crewTab.driverExtra')}><Select allowClear showSearch optionFilterProp="label" disabled={locked} placeholder={t('delivery.crewTab.selectDriver')} value={state.driver??undefined} onChange={v=>setState({...state,driver:v??null})}
     options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:used.has(e.id)}))}/></Form.Item>
   </Form>
  </Card></Col>
  <Col xs={24} lg={15}><Card title={t('delivery.crewTab.crew')} extra={<Space wrap>
   <Select style={{minWidth:220}} placeholder={t('delivery.crewTab.assignTeam')} disabled={locked||!teams.length} value={null} onChange={assignTeam}
    options={teams.filter(x=>x.isActive&&x.currentMembers>0).map(x=>({value:x.id,label:t('delivery.crewTab.teamMembers',{name:x.name,count:x.currentMembers})}))}/>
  </Space>}>
   {rows.map((r,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
    <Select style={{minWidth:240}} showSearch optionFilterProp="label" placeholder={t('delivery.crewTab.employee')} disabled={locked} value={r.employeeId||undefined} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,employeeId:v}:x))} options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:(used.has(e.id)&&e.id!==r.employeeId)||e.id===state.driver}))}/>
    <Select style={{minWidth:180}} showSearch optionFilterProp="label" disabled={locked} value={r.role||undefined} options={roles.map(value=>({value,label:value}))} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,role:v}:x))} placeholder={t('delivery.crewTab.role')}/>
    <Button danger type="text" icon={<DeleteOutlined/>} aria-label={t('common.remove')} disabled={locked} onClick={()=>setRows(rows.filter((_,n)=>n!==i))}/>
   </Space>)}
   {!rows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('delivery.crewTab.noCrew')}/>}
   <Button type="dashed" icon={<PlusOutlined/>} disabled={locked} onClick={()=>setRows([...rows,{employeeId:'',role:roles.find(r=>/helper/i.test(r))??roles[0]??'Helper'}])}>{t('delivery.crewTab.addMember')}</Button>
  </Card></Col>
  <Col span={24}><Space><Button type="primary" disabled={locked||!dirty||rows.some(r=>!r.employeeId||!r.role)} onClick={()=>void save()}>{t('delivery.crewTab.save')}</Button>{dirty&&<Typography.Text type="warning">{t('delivery.crewTab.unsaved')}</Typography.Text>}</Space></Col>
 </Row>
}

/* ---------------- money ---------------- */
type MoneyForm={currency?:string;exchangeRate?:number;amount:number;paymentMethod:string;category:string;notes?:string;deliveryNoteId?:string;paidByEmployeeId?:string}
function MoneyTab({detail,masters,act}:{detail:DeliveryDetail;masters:DeliveryMasters;act:Act}){
 const {t,language}=useT()
 const {data:currencyData}=useCurrencies()
 const [open,setOpen]=useState<'INCOME'|'EXPENSE'|null>(null),[receipt,setReceipt]=useState<string|null>(null),[form]=Form.useForm<MoneyForm>()
 const [pending,setPending]=useState<File[]>([])
 const receipts=useReceipts(detail.transactions.filter(x=>x.type==='EXPENSE').map(x=>x.id))
 const methods=masters.paymentMethods.length?masters.paymentMethods.map(m=>({value:m.code,label:m.name})):[{value:'CASH',label:t('delivery.money.cash')}]
 const cancelled=detail.job.status==='CANCELLED',cur=detail.accounting.baseCurrency
 const start=(type:'INCOME'|'EXPENSE')=>{form.resetFields();setPending([]);form.setFieldsValue({paidByEmployeeId:detail.job.driverEmployeeId??(detail.crew.length===1?detail.crew[0].employeeId:undefined),currency:currencyData?.settings.defaultCurrency,paymentMethod:methods[0]?.value,category:type==='INCOME'?masters.incomeCategories[0]?.name:masters.expenseCategories[0]?.code,deliveryNoteId:detail.notes.length===1?detail.notes[0].id:undefined});setOpen(type)}
 const save=async()=>{const v=await form.validateFields();const type=open!;const before=new Set(detail.transactions.map(x=>x.id))
  const d=await act(()=>deliveryApi.transaction(detail.job.id,{type,...v,deliveryNoteId:type==='INCOME'?v.deliveryNoteId??null:null}),type==='INCOME'?t('delivery.money.collectionRecorded'):t('delivery.money.expenseRecorded'))
  if(d){setOpen(null);const created=d.transactions.find(x=>!before.has(x.id))
   if(type==='INCOME')setReceipt(created?.id??null)
   // Receipt photos/files picked in the form are uploaded to the new expense.
   else if(created&&pending.length){const files=pending;setPending([]);void uploadReceipts('DELIVERY',created.id,files).then(n=>{if(n){message.success(t('delivery.money.receiptsAttached',{count:n}));void receipts.reload()}})}}}
 type Tx=DeliveryDetail['transactions'][number]
 const columns=useMemo(()=>[
  {title:t('delivery.money.col.number'),dataIndex:'transactionNumber'},
  {title:t('common.type'),dataIndex:'type',render:(v:string)=><Tag color={v==='INCOME'?'green':'volcano'}>{v==='INCOME'?t('delivery.money.collected'):t('delivery.money.paid')}</Tag>},
  {title:t('common.customer'),dataIndex:'customerName',render:(v:string|null)=>v??'—'},
  {title:t('delivery.money.col.category'),dataIndex:'category',render:(v:string)=>masters.expenseCategories.find(c=>c.code===v)?.name??v},
  {title:t('delivery.money.col.paidBy'),dataIndex:'paidByName',render:(v:string|null|undefined,x:{type:string})=>x.type==='EXPENSE'?(v??'—'):''},
  {title:t('delivery.money.col.method'),dataIndex:'paymentMethod',render:(v:string)=>methods.find(m=>m.value===v)?.label??v},
  {title:t('common.amount'),align:'right' as const,render:(_:unknown,x:Tx)=><>{formatMoney(x.amount,x.currency||cur)}<br/><small style={{color:'#6b7686'}}>{formatMoney(x.baseAmount,cur)}</small></>},
  {title:t('common.date'),dataIndex:'createdAtUtc',render:when},
  {title:'',render:(_:unknown,x:Tx)=>x.type==='INCOME'?<ReportPrintButton type="DELIVERY_RECEIPT" title={t('delivery.money.receiptTitle',{number:x.transactionNumber})} id={detail.job.id} query={{transactionId:x.id}} label={t('delivery.money.receipt')} size="small"/>:<ReceiptsButton kind='DELIVERY' expenseId={x.id} receipts={receipts.byExpense.get(x.id)??[]} onChanged={()=>void receipts.reload()} title={t('delivery.money.receiptsTitle',{number:x.transactionNumber})}/>}
 ],[masters,detail,receipts.byExpense,language])
 const receiptTx=detail.transactions.find(x=>x.id===receipt)
 return <>
  {receiptTx&&<Alert style={{marginBottom:12}} type="success" showIcon title={t('delivery.money.collectionDone',{number:receiptTx.transactionNumber})} action={<ReportPrintButton type="DELIVERY_RECEIPT" title={t('delivery.money.receiptTitle',{number:receiptTx.transactionNumber})} id={detail.job.id} query={{transactionId:receiptTx.id}} label={t('delivery.money.printReceipt')} buttonType="primary"/>} closable={{onClose:()=>setReceipt(null)}}/>}
  <Row gutter={[12,12]} style={{marginBottom:12}}>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('delivery.money.collectedStat',{currency:cur})} value={detail.accounting.incomeBase} precision={2} styles={{content:{color:'#176b52'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('delivery.money.expensesStat',{currency:cur})} value={detail.accounting.expenseBase} precision={2} styles={{content:{color:'#d4380d'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('delivery.money.netStat',{currency:cur})} value={detail.accounting.incomeBase-detail.accounting.expenseBase} precision={2}/></Card></Col>
  </Row>
  <Card title={t('delivery.money.title')} extra={<Space><Button type="primary" icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('INCOME')}>{t('delivery.money.collectPayment')}</Button><Button icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('EXPENSE')}>{t('delivery.money.recordExpense')}</Button></Space>}>
   <Table rowKey="id" size="middle" pagination={false} scroll={{x:900}} dataSource={detail.transactions} columns={columns} locale={{emptyText:t('delivery.money.empty')}}/>
   {detail.accounting.totals.length>1&&<p style={{marginTop:8,color:'#6b7686'}}>{t('delivery.money.byCurrency',{totals:detail.accounting.totals.map(x=>t('delivery.money.currencyTotal',{currency:x.currency,income:formatMoney(x.income,x.currency),expense:formatMoney(x.expense,x.currency)})).join(' · ')})}</p>}
   <Alert style={{marginTop:12}} type="info" showIcon title={t('delivery.money.accounting')} description={t('delivery.money.accountingHint')}/>
  </Card>
  <Modal centered width={860} open={open!==null} title={open==='INCOME'?t('delivery.money.collectTitle'):t('delivery.money.expenseTitle')} okText={t('common.save')} cancelText={t('common.cancel')} onOk={()=>void save()} onCancel={()=>setOpen(null)} destroyOnHidden>
   <Form form={form} layout="vertical" requiredMark={false}>
    {open==='INCOME'&&<Form.Item label={t('delivery.money.collectedFrom')} name="deliveryNoteId" extra={t('delivery.money.collectedFromExtra')}><Select allowClear placeholder={t('delivery.money.customerOnDelivery')} options={detail.notes.map(n=>({value:n.id,label:n.customerName+' · '+n.noteNumber}))}/></Form.Item>}
    <div className="money-form-grid">
     <CurrencyFields form={form}/>
     <Form.Item label={t('common.amount')} name="amount" rules={[{required:true,message:t('delivery.money.amountRequired')}]}><InputNumber min={0.01} max={999999999} precision={4} style={{width:'100%'}}/></Form.Item>
     <Form.Item label={t('delivery.money.paymentMethod')} name="paymentMethod" rules={[{required:true,message:t('common.required')}]}><Select options={methods}/></Form.Item>
     <Form.Item label={open==='INCOME'?t('delivery.money.purpose'):t('delivery.money.expenseCategory')} name="category" rules={[{required:true,message:t('delivery.money.categoryRequired')}]}>
      {open==='INCOME'?<AutoComplete options={masters.incomeCategories.map(c=>({value:c.name}))} placeholder={t('delivery.money.purposePlaceholder')}/>:<Select options={masters.expenseCategories.map(c=>({value:c.code,label:c.name}))}/>}
     </Form.Item>
    </div>
    {open==='EXPENSE'&&<Form.Item label={t('delivery.money.col.paidBy')} name="paidByEmployeeId" extra={t('delivery.money.paidByExtra')}><Select allowClear showSearch optionFilterProp="label" placeholder={t('delivery.money.selectEmployee')} options={masters.employees.map(e=>({value:e.id,label:e.name}))}/></Form.Item>}
    <Form.Item label={t('common.notes')} name="notes"><Input maxLength={500} placeholder={open==='EXPENSE'?t('delivery.money.expenseNotesPlaceholder'):undefined}/></Form.Item>
   {open==='EXPENSE'&&<Form.Item label={t('delivery.money.receiptOptional')} extra={t('delivery.money.receiptExtra')}><ReceiptPicker value={pending} onChange={setPending}/></Form.Item>}
   </Form>
  </Modal>
 </>
}

/* ---------------- delivery details ---------------- */
type Fields={scheduledAtLocal:string;durationMinutes:number;notes?:string}
export const fromFields=(v:Fields):SaveDelivery=>({scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString(),durationMinutes:v.durationMinutes,notes:v.notes||null})
function EditModal({open,detail,onClose,onSave}:{open:boolean;detail:DeliveryDetail;onClose:()=>void;onSave:(v:SaveDelivery)=>Promise<void>}){
 const {t}=useT()
 const [form]=Form.useForm(),j=detail.job
 const local=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 useEffect(()=>{if(open)form.setFieldsValue({scheduledAtLocal:local(j.scheduledAtUtc),durationMinutes:j.durationMinutes,notes:j.notes??''})},[open])
 return <Modal centered open={open} title={t('delivery.detail.editTitle',{number:j.deliveryNumber})} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave(fromFields(v)))} destroyOnHidden>
  <DeliveryFields form={form}/>
 </Modal>
}

export function DeliveryFields({form}:{form:ReturnType<typeof Form.useForm>[0]}){
 const {t}=useT()
 return <Form form={form} layout="vertical" requiredMark="optional">
  <Row gutter={12}>
   <Col xs={24} md={14}><Form.Item label={t('delivery.fields.when')} name="scheduledAtLocal" rules={[{required:true,message:t('delivery.fields.whenRequired')}]}><Input type="datetime-local"/></Form.Item></Col>
   <Col xs={24} md={10}><Form.Item label={t('delivery.fields.duration')} name="durationMinutes" rules={[{required:true,message:t('common.required')}]} extra={t('delivery.fields.durationExtra')}><InputNumber min={15} max={1440} step={15} style={{width:'100%'}}/></Form.Item></Col>
  </Row>
  <Form.Item label={t('common.notes')} name="notes"><Input.TextArea maxLength={2000} autoSize={{minRows:2,maxRows:5}} placeholder={t('delivery.fields.notesPlaceholder')}/></Form.Item>
 </Form>
}

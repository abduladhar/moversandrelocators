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
import {CustomerStatusTags,DeliveryCustomerLinks} from '../components/delivery/DeliveryCustomerLinks'

const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)
type Act=(f:()=>Promise<DeliveryDetail>,done?:string)=>Promise<DeliveryDetail|undefined>
const SIGN_STATEMENT='I confirm I received the packages listed as delivered, in the condition noted.'

/** One delivery run: customer delivery notes with item-by-item delivery and signatures, crew and driver, trip, money and billing. */
export function DeliveryJobDetailPage({jobId,onBack,onChanged}:{jobId:string;onBack:()=>void;onChanged:()=>void}){
 const [detail,setDetail]=useState<DeliveryDetail>(),[masters,setMasters]=useState<DeliveryMasters>(),[busy,setBusy]=useState(false),[tab,setTab]=useState('notes'),[editOpen,setEditOpen]=useState(false),[loadOpen,setLoadOpen]=useState(false)
 const canBill=useBilling()
 const load=()=>Promise.all([deliveryApi.get(jobId),deliveryApi.masters()]).then(([d,m])=>{setDetail(d);setMasters(m)}).catch(e=>fail(e,'Unable to load the delivery'))
 useEffect(()=>{void load()},[jobId])
 /** Run a mutation that returns the updated delivery. */
 const act:Act=async(f,done)=>{setBusy(true);try{const d=await f();setDetail(d);onChanged();if(done)message.success(done);return d}catch(e){fail(e,'Action failed');return undefined}finally{setBusy(false)}}
 /** Trip clock steps report failures themselves, so the card stays open on error. */
 const trip=async(f:()=>Promise<DeliveryDetail>)=>{const d=await f();setDetail(d);onChanged()}
 if(!detail||!masters)return <div style={{padding:60,textAlign:'center'}}><Spin/></div>
 const j=detail.job,locked=j.status==='COMPLETED'||j.status==='CANCELLED',status=DELIVERY_STATUS[j.status],cur=detail.accounting.baseCurrency
 const items=detail.notes.flatMap(n=>n.items)

 const kpis=[
  {key:'packages',icon:<InboxOutlined/>,label:'Packages',value:items.length},
  {key:'delivered',icon:<CheckCircleOutlined/>,label:'Delivered',value:j.deliveredCount},
  {key:'returned',icon:<CloseCircleOutlined/>,label:'Not delivered',value:j.returnedCount},
  {key:'notes',icon:<FileDoneOutlined/>,label:'Notes signed',value:j.noteCount?j.signedCount+' / '+j.noteCount:'—'},
  {key:'distance',icon:<CarOutlined/>,label:'Distance',value:j.distanceKm!=null?j.distanceKm+' km':'—'},
  {key:'collected',icon:<DollarOutlined/>,label:'Collected',value:<>{formatMoney(detail.accounting.incomeBase,cur)}</>}
 ]
 const facts=[
  {key:'scheduled',icon:<CalendarOutlined/>,label:'Scheduled',value:<>{when(j.scheduledAtUtc)}<div><small>{Math.round(j.durationMinutes/6)/10} h planned</small></div></>},
  {key:'vehicle',icon:<CarOutlined/>,label:'Vehicle',value:j.vehicleName??'Not assigned'},
  {key:'driver',icon:<IdcardOutlined/>,label:'Driver',value:j.driverName??'Not assigned'},
  {key:'crew',icon:<TeamOutlined/>,label:'Crew',value:detail.crew.length?detail.crew.map(c=>c.employeeName).join(', '):'Not assigned'},
  {key:'customers',icon:<UserOutlined/>,label:'Customers',value:j.customers.length?j.customers.join(', '):'—'}
 ]

 return <div className="survey-workspace packing-workspace">
  <div className="survey-workspace-header">
   <div className="survey-heading"><Button icon={<ArrowLeftOutlined/>} onClick={onBack} aria-label="Back to deliveries"/><div><Typography.Text className="eyebrow">DELIVERY</Typography.Text><Typography.Title level={2}>{j.deliveryNumber}<span className="survey-heading-customer">{j.customers.length===1?j.customers[0]:j.customers.length?j.customers.length+' customers':''}</span><Tag className="survey-status-tag" color={status.color}>{status.label}</Tag></Typography.Title></div></div>
   <Space wrap className="survey-heading-actions">
    {j.status==='PLANNED'&&<Button type="primary" icon={<UploadOutlined/>} onClick={()=>setLoadOpen(true)}>Load packages</Button>}
    <Button icon={<EditOutlined/>} disabled={locked} onClick={()=>setEditOpen(true)}>Edit details</Button>
    {!locked&&<Popconfirm title="Cancel this delivery?" description="Loaded warehouse packages go back to their warehouse location." okButtonProps={{danger:true}} onConfirm={()=>void act(()=>deliveryApi.cancel(jobId),'Delivery cancelled')}><Button danger icon={<StopOutlined/>} loading={busy}>Cancel delivery</Button></Popconfirm>}
   </Space>
  </div>
  {locked&&<Alert type={j.status==='COMPLETED'?'success':'warning'} showIcon title={j.status==='COMPLETED'?'Completed '+when(j.completedAtUtc)+'. Packages and notes are locked; money can still be recorded and the distance corrected.':'Cancelled. Its packages were released.'}/>}
  {j.status==='PLANNED'&&!items.length&&<Alert type="info" showIcon title="Load the packages for this run: from warehouse stock, or from a transport job that has departed or arrived. A delivery note is created for each customer."/>}
  <div className="survey-kpi-row packing-kpi-row">{kpis.map(k=><div key={k.key} className={'survey-kpi packing-kpi-'+k.key}><span className="survey-kpi-icon">{k.icon}</span><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
  <Card className="survey-customer-strip"><div className="survey-facts pickup-facts">{facts.map(f=><div key={f.key} className="survey-fact"><span className="survey-fact-icon">{f.icon}</span><div><small>{f.label}</small><div className="survey-fact-value">{f.value}</div></div></div>)}</div>
   {j.notes&&<div className="packing-notes"><small>Notes</small>{j.notes}</div>}</Card>
  {j.status!=='CANCELLED'&&<TripClockCard noun="delivery" startedAtUtc={j.startedAtUtc} endedAtUtc={j.completedAtUtc} isPaused={j.isPaused} distanceKm={j.distanceKm}
   events={detail.clock.events.map((e,i)=>({id:String(i),...e}))}
   onStart={at=>items.length?trip(()=>deliveryApi.start(jobId,at)):Promise.reject(new Error('Load at least one package before the delivery leaves.'))}
   onPause={(reason,at)=>trip(()=>deliveryApi.pause(jobId,reason,at))} onResume={at=>trip(()=>deliveryApi.resume(jobId,at))}
   onComplete={x=>trip(()=>deliveryApi.complete(jobId,{at:x.at,distanceKm:x.distanceKm}))} onEdit={x=>trip(()=>deliveryApi.distance(jobId,x.distanceKm))}/>}
  <Tabs className="pickup-tabs" activeKey={tab} onChange={setTab} items={[
   {key:'notes',label:<span><FileDoneOutlined/> Delivery notes ({detail.notes.length})</span>,children:<NotesTab detail={detail} act={act}/>},
   {key:'crew',label:<span><TeamOutlined/> Crew &amp; driver</span>,children:<CrewTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'money',label:'Collections & expenses',children:<MoneyTab detail={detail} masters={masters} act={act}/>},
   ...(canBill?[{key:'billing',label:'Invoicing & billing',children:<BillingPanel sourceKind="DELIVERY" sourceId={jobId} companyName=""/>}]:[])
  ]}/>
  <EditModal open={editOpen} detail={detail} onClose={()=>setEditOpen(false)} onSave={v=>act(()=>deliveryApi.update(jobId,v),'Details saved').then(d=>{if(d)setEditOpen(false)})}/>
  <LoadModal open={loadOpen} onClose={()=>setLoadOpen(false)} onLoad={(w,jb)=>act(()=>deliveryApi.load(jobId,w,jb),'Packages loaded').then(d=>{if(d)setLoadOpen(false)})}/>
 </div>
}

/* ---------------- delivery notes ---------------- */
function NotesTab({detail,act}:{detail:DeliveryDetail;act:Act}){
 const [linksFor,setLinksFor]=useState<string|null>(null),[signing,setSigning]=useState<DeliveryNote|null>(null),[editing,setEditing]=useState<DeliveryNote|null>(null),[marking,setMarking]=useState<{item:DeliveryItem;note:DeliveryNote;status:'DELIVERED'|'RETURNED'}|null>(null)
 const j=detail.job,planned=j.status==='PLANNED',out=j.status==='OUT_FOR_DELIVERY'
 if(!detail.notes.length)return <Empty description={planned?'No packages loaded yet. Use Load packages.':'No packages on this delivery.'}/>
 const columns=(note:DeliveryNote):ColumnsType<DeliveryItem>=>[
  {title:'Package',dataIndex:'trackingNumber',render:(_,x)=><div className="primary-cell"><strong>{x.trackingNumber}</strong><small>{x.description}</small></div>},
  {title:'Contents',dataIndex:'contents',ellipsis:true},
  {title:'Loaded from',key:'from',render:(_,x)=><div className="primary-cell"><span>{x.source==='JOB'?'Job '+x.reference:x.location}</span><small>{x.source==='JOB'?'Transport job':'Warehouse · '+x.reference}</small></div>},
  {title:'Status',key:'status',render:(_,x)=><div className="primary-cell"><span><Tag color={ITEM_STATUS[x.status].color}>{ITEM_STATUS[x.status].label}</Tag></span>{x.status!=='LOADED'&&<small>{[x.receivedBy&&'Received by '+x.receivedBy,x.notes,when(x.statusAtUtc)].filter(Boolean).join(' · ')}</small>}</div>},
  {title:'',key:'actions',width:260,render:(_,x)=>note.isSigned?null:<Space size={4} wrap>
   {out&&x.status!=='DELIVERED'&&<Button size="small" type="primary" icon={<CheckCircleOutlined/>} onClick={()=>setMarking({item:x,note,status:'DELIVERED'})}>Delivered</Button>}
   {out&&x.status!=='RETURNED'&&<Button size="small" danger icon={<CloseCircleOutlined/>} onClick={()=>setMarking({item:x,note,status:'RETURNED'})}>Not delivered</Button>}
   {out&&x.status!=='LOADED'&&<Button size="small" type="text" icon={<RollbackOutlined/>} onClick={()=>void act(()=>deliveryApi.itemStatus(j.id,x.id,{status:'LOADED'}),'Package set back to loaded')}>Undo</Button>}
   {planned&&<Popconfirm title="Take this package off the delivery?" description={x.source==='WAREHOUSE'?'It goes back to its warehouse location.':'It stays on its job.'} onConfirm={()=>void act(()=>deliveryApi.unload(j.id,x.id),'Package removed')}><Button size="small" type="text" danger icon={<DeleteOutlined/>}>Remove</Button></Popconfirm>}
  </Space>}
 ]
 return <Space direction="vertical" size={16} style={{width:'100%'}}>
  {out&&<Alert type="info" showIcon title="Mark each package delivered or not delivered, then take the customer's signature on their note. The run can be completed once every package is marked."/>}
  {detail.notes.map(note=>{
   const delivered=note.items.filter(i=>i.status==='DELIVERED').length
   return <Card key={note.id} title={<Space wrap><span>{note.noteNumber}</span><strong>{note.customerName}</strong>{note.isSigned?<Tag color="green">Signed</Tag>:<Tag color="gold">Not signed</Tag>}<Tag>{delivered}/{note.items.length} delivered</Tag><CustomerStatusTags note={note}/></Space>}
    extra={<Space wrap>
     {!note.isSigned&&j.status!=='COMPLETED'&&j.status!=='CANCELLED'&&<Button size="small" icon={<LinkOutlined/>} onClick={()=>setLinksFor(note.id)}>Customer links</Button>}
     <ReportPrintButton type="DELIVERY_NOTE" title={note.noteNumber+' · '+note.customerName} id={j.id} query={{noteId:note.id}} label="Delivery note" size="small"/>
     {!note.isSigned&&j.status!=='COMPLETED'&&j.status!=='CANCELLED'&&<Button size="small" icon={<EditOutlined/>} onClick={()=>setEditing(note)}>Receiver</Button>}
     {!note.isSigned&&out&&<Button size="small" type="primary" icon={<EditOutlined/>} onClick={()=>setSigning(note)}>Take signature</Button>}
    </Space>}>
    <div className="survey-facts pickup-facts" style={{marginBottom:12}}>
     <div className="survey-fact"><span className="survey-fact-icon"><UserOutlined/></span><div><small>Receiver</small><div className="survey-fact-value">{note.contactName??note.customerName}{note.phone?' · '+note.phone:''}</div></div></div>
     <div className="survey-fact"><span className="survey-fact-icon"><EnvironmentOutlined/></span><div><small>Delivery address</small><div className="survey-fact-value">{note.address||note.customer.latitude!=null?<a href={mapsUrl(note.address??'',note.customer.latitude,note.customer.longitude)} target="_blank" rel="noopener noreferrer">{note.address??'Location'}{note.customer.latitude!=null?' · GPS':''}</a>:'—'}{note.customer.locationNotes&&<div><small>{note.customer.locationNotes}</small></div>}</div></div></div>
     {note.collected>0&&<div className="survey-fact"><span className="survey-fact-icon"><DollarOutlined/></span><div><small>Collected</small><div className="survey-fact-value">{formatMoney(note.collected,detail.accounting.baseCurrency)}</div></div></div>}
    </div>
    <Table rowKey="id" size="small" pagination={false} scroll={{x:900}} dataSource={note.items} columns={columns(note)}/>
    {note.isSigned&&<div className="delivery-signature">
     {note.signaturePng&&<img src={note.signaturePng} alt={'Signature of '+note.signerName} style={{maxWidth:280,maxHeight:110,border:'1px solid #e3e8ef',borderRadius:6,background:'#fff'}}/>}
     <div><strong>Signed by {note.signerName}</strong><div style={{color:'#6b7686'}}>{when(note.signedAtUtc)} · recorded by {note.signedBy}</div>{note.remarks&&<div>Remarks: {note.remarks}</div>}
      <div style={{color:'#6b7686'}}>Covers {note.signedItems.filter(i=>i.status==='DELIVERED').length} delivered package(s){note.signedItems.some(i=>i.status!=='DELIVERED')?', '+note.signedItems.filter(i=>i.status!=='DELIVERED').length+' not received':''}.</div></div>
    </div>}
   </Card>})}
  <DeliveryCustomerLinks detail={detail} note={detail.notes.find(n=>n.id===linksFor)??null} open={linksFor!==null} onClose={()=>setLinksFor(null)} act={act}/>
  <SignModal note={signing} onClose={()=>setSigning(null)} onSign={v=>act(()=>deliveryApi.sign(j.id,signing!.id,v),'Delivery note signed').then(d=>{if(d)setSigning(null)})}/>
  <ReceiverModal note={editing} onClose={()=>setEditing(null)} onSave={v=>act(()=>deliveryApi.note(j.id,editing!.id,v),'Receiver saved').then(d=>{if(d)setEditing(null)})}/>
  <ItemStatusModal value={marking} onClose={()=>setMarking(null)} onSave={v=>act(()=>deliveryApi.itemStatus(j.id,marking!.item.id,{status:marking!.status,...v}),marking!.status==='DELIVERED'?'Package delivered':'Package marked not delivered').then(d=>{if(d)setMarking(null)})}/>
 </Space>
}

function ItemStatusModal({value,onClose,onSave}:{value:{item:DeliveryItem;note:DeliveryNote;status:'DELIVERED'|'RETURNED'}|null;onClose:()=>void;onSave:(v:{receivedBy?:string|null;notes?:string|null})=>Promise<void>}){
 const [form]=Form.useForm<{receivedBy?:string;notes?:string}>()
 useEffect(()=>{if(value)form.setFieldsValue({receivedBy:value.item.receivedBy??value.note.contactName??value.note.customerName,notes:value.item.notes??''})},[value])
 const delivered=value?.status==='DELIVERED'
 return <Modal centered open={value!==null} title={(delivered?'Delivered · ':'Not delivered · ')+(value?.item.trackingNumber??'')} okText="Save" onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({receivedBy:delivered?v.receivedBy||null:null,notes:v.notes||null}))} destroyOnHidden>
  <Form form={form} layout="vertical">
   {delivered&&<Form.Item label="Received by" name="receivedBy" rules={[{max:160}]}><Input/></Form.Item>}
   <Form.Item label={delivered?'Condition / notes':'Reason'} name="notes" rules={[{required:!delivered,message:'Enter why it was not delivered'},{max:500}]}>
    {delivered?<Input placeholder="Good condition"/>:<AutoComplete options={['Customer not available','Customer refused','Wrong address','Damaged in transit','No access to building'].map(value=>({value}))} placeholder="Why it was not delivered"/>}
   </Form.Item>
   {!delivered&&<Alert type="info" showIcon title={value?.item.source==='WAREHOUSE'?'When the run completes, this package goes back to its warehouse location.':'This package stays with its transport job.'}/>}
  </Form>
 </Modal>
}

function ReceiverModal({note,onClose,onSave}:{note:DeliveryNote|null;onClose:()=>void;onSave:(v:{contactName:string|null;phone:string|null;address:string|null})=>Promise<void>}){
 const [form]=Form.useForm()
 useEffect(()=>{if(note)form.setFieldsValue({contactName:note.contactName??'',phone:note.phone??'',address:note.address??''})},[note])
 return <Modal centered open={note!==null} title={'Receiver · '+(note?.customerName??'')} okText="Save" onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({contactName:v.contactName||null,phone:v.phone||null,address:v.address||null}))} destroyOnHidden>
  <Form form={form} layout="vertical">
   <Form.Item label="Receiver (if not the customer)" name="contactName" rules={[{max:160}]}><Input/></Form.Item>
   <Form.Item label="Phone" name="phone" rules={[{max:40}]}><Input/></Form.Item>
   <Form.Item label="Delivery address" name="address" rules={[{max:500}]}><Input.TextArea autoSize={{minRows:2,maxRows:4}}/></Form.Item>
  </Form>
 </Modal>
}

/** Customer signature on their delivery note. Ticked packages are recorded as delivered to the signer. */
function SignModal({note,onClose,onSign}:{note:DeliveryNote|null;onClose:()=>void;onSign:(v:{signerName:string;signaturePng:string;remarks:string|null;deliveredItemIds:string[]})=>Promise<void>}){
 const pad=useRef<SignaturePadHandle>(null),[form]=Form.useForm<{signerName:string;remarks?:string}>(),[ticked,setTicked]=useState<string[]>([])
 useEffect(()=>{if(note){form.setFieldsValue({signerName:note.contactName??note.customerName,remarks:''});setTicked(note.items.filter(i=>i.status!=='RETURNED').map(i=>i.id))}},[note])
 const sign=async()=>{const v=await form.validateFields();const png=pad.current?.toDataUrl()
  if(!png){message.error('Ask the customer to sign in the box.');return}
  if(!ticked.length&&!note?.items.some(i=>i.status==='DELIVERED')){message.error('Tick at least one package the customer received.');return}
  await onSign({signerName:v.signerName,signaturePng:png,remarks:v.remarks||null,deliveredItemIds:ticked})}
 return <Modal centered width={720} open={note!==null} title={'Sign delivery note '+(note?.noteNumber??'')} okText="Confirm signature" onCancel={onClose} onOk={()=>void sign()} destroyOnHidden>
  {note&&<>
   <Typography.Paragraph type="secondary">{note.customerName}{note.address?' · '+note.address:''}</Typography.Paragraph>
   <Card size="small" title="Packages received" style={{marginBottom:12}}>
    {note.items.map(i=><div key={i.id} style={{padding:'4px 0'}}>
     <Checkbox checked={ticked.includes(i.id)||i.status==='DELIVERED'} disabled={i.status==='DELIVERED'||i.status==='RETURNED'} onChange={e=>setTicked(e.target.checked?[...ticked,i.id]:ticked.filter(x=>x!==i.id))}>
      <strong>{i.trackingNumber}</strong> · {i.description}{i.status==='RETURNED'?<Tag color="volcano" style={{marginLeft:6}}>Not delivered</Tag>:null}
     </Checkbox></div>)}
   </Card>
   <Alert type="info" showIcon style={{marginBottom:12}} title={SIGN_STATEMENT}/>
   <Form form={form} layout="vertical" requiredMark={false}>
    <Form.Item label="Signed by" name="signerName" rules={[{required:true,message:'Enter who is signing'},{max:160}]}><Input/></Form.Item>
    <Form.Item label="Remarks (condition, missing items…)" name="remarks" rules={[{max:1000}]}><Input.TextArea autoSize={{minRows:1,maxRows:3}}/></Form.Item>
   </Form>
   <SignaturePad ref={pad} label="Customer signs here"/>
  </>}
 </Modal>
}

/* ---------------- loading ---------------- */
function LoadModal({open,onClose,onLoad}:{open:boolean;onClose:()=>void;onLoad:(warehouseBoxIds:string[],jobBoxes:{jobId:string;boxId:string}[])=>Promise<void>}){
 const [available,setAvailable]=useState<DeliveryAvailable>(),[warehouseKeys,setWarehouseKeys]=useState<string[]>([]),[jobKeys,setJobKeys]=useState<string[]>([]),[query,setQuery]=useState(''),[source,setSource]=useState('warehouse'),[saving,setSaving]=useState(false)
 useEffect(()=>{if(!open)return;setAvailable(undefined);setWarehouseKeys([]);setJobKeys([]);setQuery('');deliveryApi.available().then(setAvailable).catch(e=>fail(e,'Unable to load available packages'))},[open])
 const match=(...v:(string|null|undefined)[])=>v.join(' ').toLowerCase().includes(query.toLowerCase())
 const jobKey=(x:DeliveryJobBox)=>x.jobId+'|'+x.box.id
 const warehouse=(available?.warehouse??[]).filter(s=>match(s.trackingNumber,s.customerName,s.location,s.contents,s.description))
 const jobs=(available?.jobs??[]).filter(x=>match(x.jobNumber,x.box.trackingNumber,x.box.customerName,x.box.contents,x.destination))
 const count=warehouseKeys.length+jobKeys.length
 const load=async()=>{setSaving(true);try{await onLoad(warehouseKeys,jobKeys.map(k=>{const [jobId,boxId]=k.split('|');return {jobId,boxId}}))}finally{setSaving(false)}}
 const box=(s:WarehouseStock)=><div className="primary-cell"><strong>{s.trackingNumber}</strong><small>{s.description}</small></div>
 return <Modal title="Load packages" open={open} width={1080} onCancel={()=>!saving&&onClose()} okText={'Load '+count+' package'+(count===1?'':'s')} confirmLoading={saving} okButtonProps={{disabled:!count}} onOk={()=>void load()} destroyOnHidden>
  {!available?<div style={{padding:40,textAlign:'center'}}><Spin/></div>:<>
   <Input.Search style={{marginBottom:12,maxWidth:380}} aria-label="Search packages" placeholder="Customer, package, location or job" allowClear value={query} onChange={e=>setQuery(e.target.value)}/>
   <Tabs activeKey={source} onChange={setSource} items={[
    {key:'warehouse',label:'From warehouse ('+warehouseKeys.length+'/'+available.warehouse.length+')',children:<>
     <DataGrid<WarehouseStock> rowKey="id" size="small" rowSelection={{selectedRowKeys:warehouseKeys,onChange:k=>setWarehouseKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={warehouse}
      columns={[{title:'Package',key:'box',render:(_,s)=>box(s)},{title:'Customer',dataIndex:'customerName'},{title:'Warehouse / rack',dataIndex:'location'},{title:'Receipt',dataIndex:'reference'},{title:'Contents',dataIndex:'contents',ellipsis:true}]}/>
     <Alert type="info" showIcon title="Packages already loaded onto a transport job are not listed here. Add those from the From jobs tab."/>
    </>},
    {key:'jobs',label:'From jobs ('+jobKeys.length+'/'+available.jobs.length+')',children:<>
     <DataGrid<DeliveryJobBox> rowKey={jobKey} size="small" rowSelection={{selectedRowKeys:jobKeys,onChange:k=>setJobKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={jobs}
      columns={[{title:'Job',key:'job',render:(_,x)=><div className="primary-cell"><strong>{x.jobNumber}</strong><small>{x.jobStatus==='ARRIVED'?'Arrived':'In transit'} · {x.destination}</small></div>},
       {title:'Package',key:'box',render:(_,x)=>box(x.box)},{title:'Customer',key:'customer',render:(_,x)=>x.box.customerName},{title:'Deliver to',key:'to',render:(_,x)=>x.shipping?.dropAddress??x.shipping?.consignee?.address??'—'},{title:'Contents',key:'contents',ellipsis:true,render:(_,x)=>x.box.contents}]}/>
     <Alert type="info" showIcon title="Only jobs that have departed or arrived are listed."/>
    </>}
   ]}/>
  </>}
 </Modal>
}

/* ---------------- crew, driver and vehicle ---------------- */
function CrewTab({detail,masters,locked,act}:{detail:DeliveryDetail;masters:DeliveryMasters;locked:boolean;act:Act}){
 const initial=()=>({rows:detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})),driver:detail.job.driverEmployeeId,vehicle:detail.job.vehicleId})
 const [state,setState]=useState(initial()),[teams,setTeams]=useState<CrewTeam[]>([])
 useEffect(()=>{crewApi.teams().then(setTeams).catch(()=>setTeams([]))},[])
 useEffect(()=>setState(initial()),[detail.crew,detail.job.driverEmployeeId,detail.job.vehicleId])
 const {rows}=state,setRows=(r:typeof rows)=>setState({...state,rows:r})
 const roles=masters.crewRoles.length?masters.crewRoles.map(r=>r.name):['Team leader','Driver','Helper']
 const used=new Set(rows.map(r=>r.employeeId)),dirty=JSON.stringify(state)!==JSON.stringify(initial())
 const vehicle=masters.vehicles.find(v=>v.id===state.vehicle)
 const assignTeam=(id:string)=>{const team=teams.find(t=>t.id===id);if(!team)return
  const members=team.members.filter(m=>!m.leftAtUtc)
  setRows([...rows.filter(r=>r.employeeId&&!members.some(m=>m.employeeId===r.employeeId)),...members.map(m=>({employeeId:m.employeeId,role:m.role}))])}
 const save=()=>act(()=>deliveryApi.crew(detail.job.id,{crew:rows,driverEmployeeId:state.driver??null,vehicleId:state.vehicle??null}),'Crew and vehicle saved')
 return <Row gutter={[16,16]}>
  <Col xs={24} lg={9}><Card title="Vehicle and driver">
   <Form layout="vertical">
    <Form.Item label="Vehicle"><Select allowClear showSearch optionFilterProp="label" disabled={locked} placeholder={masters.vehicles.length?'Select a vehicle':'Add vehicles in Operations setup'} value={state.vehicle??undefined} onChange={v=>setState({...state,vehicle:v??null})}
     options={masters.vehicles.map(v=>({value:v.id,label:v.registrationNumber+' · '+v.name}))}/></Form.Item>
    {vehicle?.driverName&&<Typography.Paragraph type="secondary">Usual driver: {vehicle.driverName}{vehicle.driverPhone?' · '+vehicle.driverPhone:''}</Typography.Paragraph>}
    <Form.Item label="Driver" extra="Booked for the run like the crew, so a double booking is caught."><Select allowClear showSearch optionFilterProp="label" disabled={locked} placeholder="Select the driver" value={state.driver??undefined} onChange={v=>setState({...state,driver:v??null})}
     options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:used.has(e.id)}))}/></Form.Item>
   </Form>
  </Card></Col>
  <Col xs={24} lg={15}><Card title="Crew" extra={<Space wrap>
   <Select style={{minWidth:220}} placeholder="Assign a team" disabled={locked||!teams.length} value={null} onChange={assignTeam}
    options={teams.filter(t=>t.isActive&&t.currentMembers>0).map(t=>({value:t.id,label:t.name+' · '+t.currentMembers+' member'+(t.currentMembers===1?'':'s')}))}/>
  </Space>}>
   {rows.map((r,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
    <Select style={{minWidth:240}} showSearch optionFilterProp="label" placeholder="Employee" disabled={locked} value={r.employeeId||undefined} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,employeeId:v}:x))} options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:(used.has(e.id)&&e.id!==r.employeeId)||e.id===state.driver}))}/>
    <Select style={{minWidth:180}} showSearch optionFilterProp="label" disabled={locked} value={r.role||undefined} options={roles.map(value=>({value,label:value}))} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,role:v}:x))} placeholder="Crew role"/>
    <Button danger type="text" icon={<DeleteOutlined/>} disabled={locked} onClick={()=>setRows(rows.filter((_,n)=>n!==i))}/>
   </Space>)}
   {!rows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No crew assigned"/>}
   <Button type="dashed" icon={<PlusOutlined/>} disabled={locked} onClick={()=>setRows([...rows,{employeeId:'',role:roles.find(r=>/helper/i.test(r))??roles[0]??'Helper'}])}>Add crew member</Button>
  </Card></Col>
  <Col span={24}><Space><Button type="primary" disabled={locked||!dirty||rows.some(r=>!r.employeeId||!r.role)} onClick={()=>void save()}>Save crew, driver and vehicle</Button>{dirty&&<Typography.Text type="warning">Unsaved changes</Typography.Text>}</Space></Col>
 </Row>
}

/* ---------------- money ---------------- */
type MoneyForm={currency?:string;exchangeRate?:number;amount:number;paymentMethod:string;category:string;notes?:string;deliveryNoteId?:string}
function MoneyTab({detail,masters,act}:{detail:DeliveryDetail;masters:DeliveryMasters;act:Act}){
 const {data:currencyData}=useCurrencies()
 const [open,setOpen]=useState<'INCOME'|'EXPENSE'|null>(null),[receipt,setReceipt]=useState<string|null>(null),[form]=Form.useForm<MoneyForm>()
 const [pending,setPending]=useState<File[]>([])
 const receipts=useReceipts(detail.transactions.filter(t=>t.type==='EXPENSE').map(t=>t.id))
 const methods=masters.paymentMethods.length?masters.paymentMethods.map(m=>({value:m.code,label:m.name})):[{value:'CASH',label:'Cash'}]
 const cancelled=detail.job.status==='CANCELLED',cur=detail.accounting.baseCurrency
 const start=(type:'INCOME'|'EXPENSE')=>{form.resetFields();setPending([]);form.setFieldsValue({currency:currencyData?.settings.defaultCurrency,paymentMethod:methods[0]?.value,category:type==='INCOME'?masters.incomeCategories[0]?.name:masters.expenseCategories[0]?.code,deliveryNoteId:detail.notes.length===1?detail.notes[0].id:undefined});setOpen(type)}
 const save=async()=>{const v=await form.validateFields();const type=open!;const before=new Set(detail.transactions.map(t=>t.id))
  const d=await act(()=>deliveryApi.transaction(detail.job.id,{type,...v,deliveryNoteId:type==='INCOME'?v.deliveryNoteId??null:null}),type==='INCOME'?'Collection recorded':'Expense recorded')
  if(d){setOpen(null);const created=d.transactions.find(t=>!before.has(t.id))
   if(type==='INCOME')setReceipt(created?.id??null)
   // Receipt photos/files picked in the form are uploaded to the new expense.
   else if(created&&pending.length){const files=pending;setPending([]);void uploadReceipts('DELIVERY',created.id,files).then(n=>{if(n){message.success(n===1?'Receipt attached':n+' receipts attached');void receipts.reload()}})}}}
 type Tx=DeliveryDetail['transactions'][number]
 const columns=useMemo(()=>[
  {title:'Number',dataIndex:'transactionNumber'},
  {title:'Type',dataIndex:'type',render:(v:string)=><Tag color={v==='INCOME'?'green':'volcano'}>{v==='INCOME'?'Collected':'Paid'}</Tag>},
  {title:'Customer',dataIndex:'customerName',render:(v:string|null)=>v??'—'},
  {title:'Category',dataIndex:'category',render:(v:string)=>masters.expenseCategories.find(c=>c.code===v)?.name??v},
  {title:'Method',dataIndex:'paymentMethod',render:(v:string)=>methods.find(m=>m.value===v)?.label??v},
  {title:'Amount',align:'right' as const,render:(_:unknown,x:Tx)=><>{formatMoney(x.amount,x.currency||cur)}<br/><small style={{color:'#6b7686'}}>{formatMoney(x.baseAmount,cur)}</small></>},
  {title:'Date',dataIndex:'createdAtUtc',render:when},
  {title:'',render:(_:unknown,x:Tx)=>x.type==='INCOME'?<ReportPrintButton type="DELIVERY_RECEIPT" title={'Receipt '+x.transactionNumber} id={detail.job.id} query={{transactionId:x.id}} label="Receipt" size="small"/>:<ReceiptsButton kind='DELIVERY' expenseId={x.id} receipts={receipts.byExpense.get(x.id)??[]} onChanged={()=>void receipts.reload()} title={'Receipts · '+x.transactionNumber}/>}
 ],[masters,detail,receipts.byExpense])
 const receiptTx=detail.transactions.find(t=>t.id===receipt)
 return <>
  {receiptTx&&<Alert style={{marginBottom:12}} type="success" showIcon title={'Collection '+receiptTx.transactionNumber+' recorded.'} action={<ReportPrintButton type="DELIVERY_RECEIPT" title={'Receipt '+receiptTx.transactionNumber} id={detail.job.id} query={{transactionId:receiptTx.id}} label="Print receipt" buttonType="primary"/>} closable={{onClose:()=>setReceipt(null)}}/>}
  <Row gutter={[12,12]} style={{marginBottom:12}}>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Collected · '+cur} value={detail.accounting.incomeBase} precision={2} styles={{content:{color:'#176b52'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Expenses · '+cur} value={detail.accounting.expenseBase} precision={2} styles={{content:{color:'#d4380d'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Net · '+cur} value={detail.accounting.incomeBase-detail.accounting.expenseBase} precision={2}/></Card></Col>
  </Row>
  <Card title="Collections and expenses" extra={<Space><Button type="primary" icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('INCOME')}>Collect payment</Button><Button icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('EXPENSE')}>Record expense</Button></Space>}>
   <Table rowKey="id" size="middle" pagination={false} scroll={{x:900}} dataSource={detail.transactions} columns={columns} locale={{emptyText:'No money recorded on this delivery'}}/>
   {detail.accounting.totals.length>1&&<p style={{marginTop:8,color:'#6b7686'}}>By currency: {detail.accounting.totals.map(t=>t.currency+' collected '+formatMoney(t.income,t.currency)+', paid '+formatMoney(t.expense,t.currency)).join(' · ')}</p>}
   <Alert style={{marginTop:12}} type="info" showIcon title="Accounting" description="Each collection and expense appears in Accounting › Cash posting queue as source DELIVERY. The accountant posts it to a cash/bank account (collections to customer advances or invoices; expenses to the mapped expense account)."/>
  </Card>
  <Modal centered width={860} open={open!==null} title={open==='INCOME'?'Collect payment from customer':'Record expense paid'} okText="Save" onOk={()=>void save()} onCancel={()=>setOpen(null)} destroyOnHidden>
   <Form form={form} layout="vertical" requiredMark={false}>
    {open==='INCOME'&&<Form.Item label="Collected from" name="deliveryNoteId" extra="The customer whose delivery note this payment belongs to."><Select allowClear placeholder="Customer on this delivery" options={detail.notes.map(n=>({value:n.id,label:n.customerName+' · '+n.noteNumber}))}/></Form.Item>}
    <div className="money-form-grid">
     <CurrencyFields form={form}/>
     <Form.Item label="Amount" name="amount" rules={[{required:true,message:'Enter the amount'}]}><InputNumber min={0.01} max={999999999} precision={4} style={{width:'100%'}}/></Form.Item>
     <Form.Item label="Payment method" name="paymentMethod" rules={[{required:true}]}><Select options={methods}/></Form.Item>
     <Form.Item label={open==='INCOME'?'Purpose':'Expense category'} name="category" rules={[{required:true,message:'Choose a category'}]}>
      {open==='INCOME'?<AutoComplete options={masters.incomeCategories.map(c=>({value:c.name}))} placeholder="Delivery charge, Balance…"/>:<Select options={masters.expenseCategories.map(c=>({value:c.code,label:c.name}))}/>}
     </Form.Item>
    </div>
    <Form.Item label="Notes" name="notes"><Input maxLength={500} placeholder={open==='EXPENSE'?'Fuel, toll, parking…':undefined}/></Form.Item>
   {open==='EXPENSE'&&<Form.Item label="Receipt (optional)" extra="Take a photo of the bill or attach a PDF; it is uploaded when you save."><ReceiptPicker value={pending} onChange={setPending}/></Form.Item>}
   </Form>
  </Modal>
 </>
}

/* ---------------- delivery details ---------------- */
type Fields={scheduledAtLocal:string;durationMinutes:number;notes?:string}
export const fromFields=(v:Fields):SaveDelivery=>({scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString(),durationMinutes:v.durationMinutes,notes:v.notes||null})
function EditModal({open,detail,onClose,onSave}:{open:boolean;detail:DeliveryDetail;onClose:()=>void;onSave:(v:SaveDelivery)=>Promise<void>}){
 const [form]=Form.useForm(),j=detail.job
 const local=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 useEffect(()=>{if(open)form.setFieldsValue({scheduledAtLocal:local(j.scheduledAtUtc),durationMinutes:j.durationMinutes,notes:j.notes??''})},[open])
 return <Modal centered open={open} title={'Edit '+j.deliveryNumber} okText="Save" onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave(fromFields(v)))} destroyOnHidden>
  <DeliveryFields form={form}/>
 </Modal>
}

export function DeliveryFields({form}:{form:ReturnType<typeof Form.useForm>[0]}){
 return <Form form={form} layout="vertical" requiredMark="optional">
  <Row gutter={12}>
   <Col xs={24} md={14}><Form.Item label="Delivery date and time" name="scheduledAtLocal" rules={[{required:true,message:'Choose when the delivery leaves'}]}><Input type="datetime-local"/></Form.Item></Col>
   <Col xs={24} md={10}><Form.Item label="Expected duration (minutes)" name="durationMinutes" rules={[{required:true}]} extra="Used to catch crew double bookings."><InputNumber min={15} max={1440} step={15} style={{width:'100%'}}/></Form.Item></Col>
  </Row>
  <Form.Item label="Notes" name="notes"><Input.TextArea maxLength={2000} autoSize={{minRows:2,maxRows:5}} placeholder="Route, access instructions…"/></Form.Item>
 </Form>
}

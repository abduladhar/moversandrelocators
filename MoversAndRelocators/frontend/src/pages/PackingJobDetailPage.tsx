import {useEffect,useMemo,useState} from 'react'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts } from '../expenseReceipts'
import { crewApi, type Team as CrewTeam } from '../crewApi'
import {Alert,AutoComplete,Button,Card,Col,Empty,Form,Input,InputNumber,Modal,Popconfirm,Row,Select,Space,Spin,Statistic,Switch,Table,Tabs,Tag,Tooltip,Typography,message} from 'antd'
import {ArrowLeftOutlined,CalendarOutlined,CheckCircleOutlined,DeleteOutlined,DollarOutlined,EditOutlined,EnvironmentOutlined,InboxOutlined,LinkOutlined,MailOutlined,PhoneOutlined,PlayCircleOutlined,PlusOutlined,PrinterOutlined,RollbackOutlined,ShoppingOutlined,StopOutlined,TagsOutlined,TeamOutlined,UnorderedListOutlined,UserOutlined} from '@ant-design/icons'
import {PackingCustomerTab} from '../components/packing/PackingCustomerTab'
import {mapsUrl,packingApi,STATUS_LABEL,type PackingBox,type PackingDetail,type PackingMasters,type PackingStatus,type SavePackingBox} from '../packingApi'
import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import {BillingPanel} from '../components/BillingPanel'
import {useBilling} from '../billingApi'
import {CurrencyFields,formatMoney,useCurrencies} from '../currency'

const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

/** One packing job: boxes and labels, crew, materials, income/expense and billing. */
export function PackingJobDetailPage({jobId,onBack,onChanged}:{jobId:string;onBack:()=>void;onChanged:()=>void}){
 const [detail,setDetail]=useState<PackingDetail>(),[masters,setMasters]=useState<PackingMasters>(),[busy,setBusy]=useState(false),[tab,setTab]=useState('boxes'),[editOpen,setEditOpen]=useState(false)
 const canBill=useBilling()
 const load=()=>Promise.all([packingApi.get(jobId),packingApi.masters()]).then(([d,m])=>{setDetail(d);setMasters(m)}).catch(e=>fail(e,'Unable to load the packing job'))
 useEffect(()=>{void load()},[jobId])
 /** Run a mutation that returns the updated job. */
 const act=async(f:()=>Promise<PackingDetail>,done?:string)=>{setBusy(true);try{const d=await f();setDetail(d);onChanged();if(done)message.success(done);return d}catch(e){fail(e,'Action failed');return undefined}finally{setBusy(false)}}
 if(!detail||!masters)return <div style={{padding:60,textAlign:'center'}}><Spin/></div>
 const j=detail.job,locked=j.status==='COMPLETED'||j.status==='CANCELLED',status=STATUS_LABEL[j.status]
 const items=detail.boxes.reduce((s,b)=>s+b.items.reduce((n,i)=>n+i.quantity,0),0)
 const received=detail.transactions.filter(x=>x.type==='INCOME').reduce((s,x)=>s+(x.baseAmount??0),0)
 const setStatus=(s:PackingStatus,done:string)=>act(()=>packingApi.status(jobId,s),done)

 const kpis=[
  {key:'boxes',icon:<InboxOutlined/>,label:'Boxes',value:detail.boxes.length},
  {key:'items',icon:<UnorderedListOutlined/>,label:'Items packed',value:items},
  {key:'labels',icon:<TagsOutlined/>,label:'Labels to print',value:j.labelsPending},
  {key:'crew',icon:<TeamOutlined/>,label:'Crew',value:detail.crew.length},
  {key:'material',icon:<ShoppingOutlined/>,label:'Material cost',value:<>{formatMoney(detail.accounting.materialCost,detail.accounting.baseCurrency)}</>},
  {key:'received',icon:<DollarOutlined/>,label:'Received',value:<>{formatMoney(received,detail.accounting.baseCurrency)}</>}
 ]
 const facts=[
  {key:'customer',icon:<UserOutlined/>,label:'Customer',value:j.customerName},
  {key:'phone',icon:<PhoneOutlined/>,label:'Phone',value:j.phone},
  {key:'email',icon:<MailOutlined/>,label:'Email',value:j.email||'—'},
  {key:'address',icon:<EnvironmentOutlined/>,label:'Address',value:<a href={mapsUrl(j.address,detail.customer.latitude,detail.customer.longitude)} target="_blank" rel="noopener noreferrer">{j.address}{detail.customer.latitude!=null?' · GPS':''}</a>},
  {key:'scheduled',icon:<CalendarOutlined/>,label:'Scheduled',value:<>{when(j.scheduledAtUtc)}<div><Tag color={j.scheduleConfirmedAtUtc?'green':'gold'}>{j.scheduleConfirmedAtUtc?'Customer confirmed':'Not confirmed'}</Tag></div></>},
  {key:'source',icon:<LinkOutlined/>,label:'Created from',value:j.pickupNumber?'Pickup '+j.pickupNumber:j.quotationNumber?'Quotation '+j.quotationNumber:j.leadNumber?'Sales lead '+j.leadNumber:'Direct'}
 ]

 return <div className="survey-workspace packing-workspace">
  <div className="survey-workspace-header">
   <div className="survey-heading"><Button icon={<ArrowLeftOutlined/>} onClick={onBack} aria-label="Back to packing jobs"/><div><Typography.Text className="eyebrow">PACKING JOB</Typography.Text><Typography.Title level={2}>{j.jobNumber}<span className="survey-heading-customer">{j.customerName}</span><Tag className="survey-status-tag" color={status.color}>{status.label}</Tag></Typography.Title></div></div>
   <Space wrap className="survey-heading-actions">
    <ReportPrintButton type="PACKING_SHEET" title={j.jobNumber+' packing list'} id={jobId} label="Packing list" disabled={!detail.boxes.length}/>
    <Button icon={<EditOutlined/>} disabled={j.status==='CANCELLED'} onClick={()=>setEditOpen(true)}>Edit details</Button>
    {!locked&&<Popconfirm title="Cancel this packing job?" okButtonProps={{danger:true}} onConfirm={()=>void setStatus('CANCELLED','Job cancelled')}><Button danger icon={<StopOutlined/>}>Cancel job</Button></Popconfirm>}
    {locked&&<Popconfirm title="Reopen this job?" description={j.status==='COMPLETED'?'The material cost journal is reversed and re-posted when you complete again.':undefined} onConfirm={()=>void setStatus('IN_PROGRESS','Job reopened')}><Button icon={<RollbackOutlined/>} loading={busy}>Reopen</Button></Popconfirm>}
    {j.status==='PLANNED'&&<Button icon={<PlayCircleOutlined/>} loading={busy} onClick={()=>void setStatus('IN_PROGRESS','Packing started')}>Start packing</Button>}
    {(j.status==='PLANNED'||j.status==='IN_PROGRESS')&&<Popconfirm title="Complete this packing job?" description={<>Locks boxes, crew and materials and posts the material cost<br/>({formatMoney(detail.accounting.materialCost,detail.accounting.baseCurrency)}: Dr 5100 Material expense / Cr 1300 Packing material stock).</>} okText="Complete" onConfirm={()=>void setStatus('COMPLETED','Packing job completed')}><Button type="primary" icon={<CheckCircleOutlined/>} loading={busy} disabled={!detail.boxes.length}>Complete</Button></Popconfirm>}
   </Space>
  </div>
  {locked&&<Alert type={j.status==='COMPLETED'?'success':'warning'} showIcon title={j.status==='COMPLETED'?'Completed '+when(j.completedAtUtc)+'. Boxes, crew and materials are locked; payments can still be recorded.':'Cancelled. Reopen the job to continue.'}/>}
  <div className="survey-kpi-row packing-kpi-row">{kpis.map(k=><div key={k.key} className={'survey-kpi packing-kpi-'+k.key+(k.key==='labels'&&j.labelsPending?' is-pending':'')}><span className="survey-kpi-icon">{k.icon}</span><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
  <Card className="survey-customer-strip"><div className="survey-facts pickup-facts">{facts.map(f=><div key={f.key} className="survey-fact"><span className="survey-fact-icon">{f.icon}</span><div><small>{f.label}</small><div className="survey-fact-value">{f.value}</div></div></div>)}</div>
   {j.notes&&<div className="packing-notes"><small>Notes</small>{j.notes}</div>}</Card>
  <Tabs className="pickup-tabs" activeKey={tab} onChange={setTab} items={[
   {key:'boxes',label:<span><TagsOutlined/> Boxes &amp; labels ({detail.boxes.length})</span>,children:<BoxesTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'crew',label:<span><TeamOutlined/> Crew ({detail.crew.length})</span>,children:<CrewTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'materials',label:'Materials',children:<MaterialsTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'customer',label:<span>Customer confirmation{detail.customer.itemsResponse==='CORRECTIONS'&&detail.customer.itemsResponseCurrent?<Tag color="red" style={{marginLeft:6}}>Corrections</Tag>:null}</span>,children:<PackingCustomerTab detail={detail} act={act}/>},
   {key:'money',label:'Income & expense',children:<MoneyTab detail={detail} masters={masters} act={act}/>},
   ...(canBill?[{key:'billing',label:'Invoicing & billing',children:<BillingPanel sourceKind="PACKING" sourceId={jobId} companyName=""/>}]:[])
  ]}/>
  <EditJobModal open={editOpen} detail={detail} onClose={()=>setEditOpen(false)} onSave={v=>act(()=>packingApi.update(jobId,v),'Details saved').then(d=>{if(d)setEditOpen(false)})}/>
 </div>
}

type Act=(f:()=>Promise<PackingDetail>,done?:string)=>Promise<PackingDetail|undefined>

/* ---------------- boxes & labels ---------------- */
function BoxesTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const jobId=detail.job.id
 const [editing,setEditing]=useState<PackingBox|'new'|null>(null),[selected,setSelected]=useState<string[]>([]),[justPacked,setJustPacked]=useState<string[]>([])
 const pending=detail.boxes.filter(b=>!b.labelPrintedAtUtc).map(b=>b.id)
 const printed=(ids:string[])=>()=>void act(()=>packingApi.labelsPrinted(jobId,ids)).then(()=>{setJustPacked([]);setSelected([])})
 const LabelButton=({ids,label,primary}:{ids:string[];label:string;primary?:boolean})=><ReportPrintButton type="PACKING_LABELS" title={detail.job.jobNumber+' labels'} id={jobId} query={{boxIds:ids.join(',')}} label={label} icon={<PrinterOutlined/>} buttonType={primary?'primary':'default'} disabled={!ids.length} onPrinted={printed(ids)}/>
 const save=async(v:SavePackingBox)=>{
  const before=new Set(detail.boxes.map(b=>b.id))
  const d=await act(()=>editing==='new'?packingApi.addBox(jobId,v):packingApi.updateBox(jobId,(editing as PackingBox).id,v),editing==='new'?((v.copies??1)>1?(v.copies+' boxes packed'):'Box packed'):'Box updated')
  if(d){if(editing==='new')setJustPacked(d.boxes.filter(b=>!before.has(b.id)).map(b=>b.id));setEditing(null)}
 }
 return <>
  {justPacked.length>0&&<Alert style={{marginBottom:12}} type="success" showIcon title={'Packed '+detail.boxes.filter(b=>justPacked.includes(b.id)).map(b=>b.trackingNumber).join(', ')+' — print the label and stick it on the box.'} action={<LabelButton ids={justPacked} label={justPacked.length>1?'Print '+justPacked.length+' labels':'Print label'} primary/>} closable={{onClose:()=>setJustPacked([])}}/>}
  <div className="packing-toolbar">
   <Button type="primary" icon={<PlusOutlined/>} disabled={locked||!masters.boxTypes.length} onClick={()=>setEditing('new')}>Pack a box</Button>
   <Space wrap>
    <LabelButton ids={pending} label={'Print pending labels ('+pending.length+')'}/>
    <LabelButton ids={selected} label={'Print selected ('+selected.length+')'}/>
    <LabelButton ids={detail.boxes.map(b=>b.id)} label="Reprint all"/>
   </Space>
  </div>
  {!masters.boxTypes.length&&<Alert type="warning" showIcon title="No active box types. Add them under Operations setup › Box types."/>}
  <Table<PackingBox> className="packing-box-table" rowKey="id" size="middle" dataSource={detail.boxes} pagination={false} scroll={{x:900}} locale={{emptyText:<Empty description="No boxes packed yet"/>}}
   rowSelection={{selectedRowKeys:selected,onChange:k=>setSelected(k as string[])}}
   columns={[
    {title:'#',width:48,render:(_,b,i)=>i+1},
    {title:'Box',width:260,render:(_,b)=><div className="primary-cell"><strong className="packing-tracking">{b.trackingNumber}</strong><small>{b.boxTypeName}{b.customMaterials?' · materials edited':''}</small></div>},
    {title:'Room',dataIndex:'roomName',width:160,render:v=>v||'—'},
    {title:'Contents',render:(_,b)=><div className="packing-contents">{b.items.map((i,n)=><Tag key={n}>{i.itemName} × {i.quantity}{i.notes?' · '+i.notes:''}</Tag>)}{b.isFragile&&<Tag color="red">Fragile</Tag>}{b.notes&&<small>{b.notes}</small>}</div>},
    {title:'Label',width:130,render:(_,b)=>b.labelPrintedAtUtc?<Tooltip title={'Printed '+b.labelPrintCount+'× · last '+when(b.labelPrintedAtUtc)}><Tag color="green">Printed</Tag></Tooltip>:<Tag color="orange">Not printed</Tag>},
    {title:'Actions',width:190,align:'right',render:(_,b)=><Space size={6}>
     <LabelButton ids={[b.id]} label="Label"/>
     <Tooltip title="Edit box"><Button icon={<EditOutlined/>} disabled={locked} onClick={()=>setEditing(b)} aria-label="Edit box"/></Tooltip>
     <Popconfirm title={'Remove '+b.trackingNumber+'?'} description="Its label will no longer be valid." onConfirm={()=>void act(()=>packingApi.deleteBox(jobId,b.id),'Box removed')}><Tooltip title="Remove box"><Button danger icon={<DeleteOutlined/>} disabled={locked} aria-label="Remove box"/></Tooltip></Popconfirm>
    </Space>}
   ]}/>
  <BoxModal open={editing!==null} box={editing==='new'?undefined:editing??undefined} masters={masters} rooms={[...new Set(detail.boxes.map(b=>b.roomName).filter((x):x is string=>!!x))]} onCancel={()=>setEditing(null)} onSave={save}/>
 </>
}

function BoxModal({open,box,masters,rooms,onCancel,onSave}:{open:boolean;box?:PackingBox;masters:PackingMasters;rooms:string[];onCancel:()=>void;onSave:(v:SavePackingBox)=>Promise<void>}){
 const [form]=Form.useForm<SavePackingBox>(),[saving,setSaving]=useState(false)
 const boxTypeId=Form.useWatch('boxTypeId',form)
 const recipe=masters.boxTypes.find(b=>b.id===boxTypeId)?.recipe??[]
 /** Materials used per box. Follows the box type recipe until the crew edits it (custom). */
 const [mats,setMats]=useState<{materialId:string;quantity:number|null}[]>([]),[custom,setCustom]=useState(false)
 const fromRecipe=(typeId?:string)=>(masters.boxTypes.find(b=>b.id===typeId)?.recipe??[]).map(r=>({materialId:r.materialId,quantity:r.quantity}))
 useEffect(()=>{if(!open)return;if(box?.customMaterials){setMats(box.materials.map(m=>({materialId:m.materialId,quantity:m.quantity})));setCustom(true)}else{setMats(fromRecipe(box?.boxTypeId??masters.boxTypes[0]?.id));setCustom(false)}},[open,box])
 useEffect(()=>{if(open&&!custom)setMats(fromRecipe(boxTypeId))},[boxTypeId])
 const editMats=(next:typeof mats)=>{setMats(next);setCustom(true)}
 const unit=(id:string)=>masters.materials.find(m=>m.id===id)?.unit??''
 const matsValid=mats.every(m=>m.materialId&&m.quantity&&m.quantity>0)&&new Set(mats.map(m=>m.materialId)).size===mats.length
 useEffect(()=>{if(open)form.setFieldsValue(box?{boxTypeId:box.boxTypeId,roomName:box.roomName,isFragile:box.isFragile,notes:box.notes,items:box.items.map(i=>({itemName:i.itemName,quantity:i.quantity,notes:i.notes})),copies:1}:{boxTypeId:masters.boxTypes[0]?.id,roomName:'',isFragile:false,notes:'',items:[{itemName:'',quantity:1}],copies:1})},[open,box])
 const ok=async()=>{const v=await form.validateFields();if(custom&&!matsValid){message.error('Choose each material once with a quantity above zero.');return}
  setSaving(true);try{await onSave({...v,items:(v.items??[]).filter(i=>i?.itemName?.trim()),materials:custom?mats.map(m=>({materialId:m.materialId,quantity:m.quantity!})):null})}finally{setSaving(false)}}
 return <Modal centered width={720} open={open} title={box?'Edit box '+box.trackingNumber:'Pack a box'} okText={box?'Save box':'Pack box'} confirmLoading={saving} onOk={()=>void ok()} onCancel={onCancel} destroyOnHidden>
  <Form form={form} layout="vertical" requiredMark={false} className="packing-box-form">
   <Row gutter={16}>
    <Col xs={24} md={12}><Form.Item label="Box type" name="boxTypeId" rules={[{required:true,message:'Choose a box type'}]}><Select options={masters.boxTypes.map(b=>({value:b.id,label:b.name+' ('+b.code+')'}))}/></Form.Item></Col>
    <Col xs={24} md={12}><Form.Item label="Room" name="roomName"><AutoComplete options={rooms.map(value=>({value}))} placeholder="Kitchen, Bedroom 1…" filterOption/></Form.Item></Col>
   </Row>
   <Form.List name="items">{(fields,{add,remove})=><div className="packing-items">
    <div className="packing-section-title">Contents</div>
    <div className="packing-item-row packing-item-head"><span>Item</span><span>Qty</span><span>Notes</span><span/></div>
    {fields.map(f=><div key={f.key} className="packing-item-row">
     <Form.Item name={[f.name,'itemName']} rules={[{max:160}]}><Input placeholder="e.g. Plates, Books"/></Form.Item>
     <Form.Item name={[f.name,'quantity']} rules={[{required:true,type:'number',min:1,max:10000,message:'1–10000'}]}><InputNumber min={1} max={10000} style={{width:'100%'}}/></Form.Item>
     <Form.Item name={[f.name,'notes']}><Input placeholder="Optional"/></Form.Item>
     <Tooltip title="Remove item"><Button type="text" danger icon={<DeleteOutlined/>} disabled={fields.length<2} onClick={()=>remove(f.name)} aria-label="Remove item"/></Tooltip>
    </div>)}
    <Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({itemName:'',quantity:1})}>Add item</Button>
   </div>}</Form.List>
   <div className="packing-materials">
    <div className="packing-section-head">
     <div><div className="packing-section-title">Materials used</div><small>{custom?'Recorded for this box':recipe.length?'Standard for this box type — change it if you used more or less':'This box type has no standard materials'}</small></div>
     {custom&&<Button type="link" size="small" icon={<RollbackOutlined/>} onClick={()=>{setMats(fromRecipe(boxTypeId));setCustom(false)}}>Use box type standard</Button>}
    </div>
    {mats.length>0&&<div className="packing-material-row packing-item-head"><span>Material</span><span>Qty</span><span/></div>}
    {mats.map((m,i)=><div key={i} className="packing-material-row">
     <Select showSearch optionFilterProp="label" placeholder="Material" value={m.materialId||undefined} status={!m.materialId?'error':undefined} onChange={v=>editMats(mats.map((x,n)=>n===i?{...x,materialId:v}:x))}
      options={masters.materials.map(o=>({value:o.id,label:o.name,disabled:mats.some((x,n)=>n!==i&&x.materialId===o.id)}))}/>
     <InputNumber min={0.001} max={100000} step={0.25} value={m.quantity} status={!m.quantity?'error':undefined} suffix={unit(m.materialId)} style={{width:'100%'}} onChange={v=>editMats(mats.map((x,n)=>n===i?{...x,quantity:v}:x))}/>
     <Tooltip title="Remove material"><Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>editMats(mats.filter((_,n)=>n!==i))} aria-label="Remove material"/></Tooltip>
    </div>)}
    <Button type="dashed" block icon={<PlusOutlined/>} disabled={!masters.materials.length} onClick={()=>editMats([...mats,{materialId:'',quantity:1}])}>Add material</Button>
   </div>
   <Form.Item label="Box notes" name="notes"><Input maxLength={500} placeholder="Optional"/></Form.Item>
   <div className="packing-box-options">
    <div className="packing-option"><Form.Item name="isFragile" valuePropName="checked" noStyle><Switch/></Form.Item><div><strong>Fragile</strong><small>Printed on the label as FRAGILE</small></div></div>
    {!box&&<div className="packing-option"><Form.Item name="copies" noStyle><InputNumber min={1} max={50} style={{width:72}}/></Form.Item><div><strong>Identical boxes</strong><small>Same contents, each with its own tracking number and label</small></div></div>}
   </div>
  </Form>
 </Modal>
}

/* ---------------- crew ---------------- */
function CrewTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const [rows,setRows]=useState(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})))
 const [teams,setTeams]=useState<CrewTeam[]>([])
 useEffect(()=>{crewApi.teams().then(setTeams).catch(()=>setTeams([]))},[])
 useEffect(()=>setRows(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role}))),[detail.crew])
 const roles=masters.crewRoles.length?masters.crewRoles.map(r=>r.name):['Lead','Packer','Helper','Driver']
 const used=new Set(rows.map(r=>r.employeeId))
 const dirty=JSON.stringify(rows)!==JSON.stringify(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})))
 // Assigning a team drops in its current members with the role each holds in that team. The team itself is
 // stamped on each row by the server when the crew is saved, from the member's membership at that moment.
 const assignTeam=(id:string)=>{const team=teams.find(t=>t.id===id);if(!team)return
  const members=team.members.filter(m=>!m.leftAtUtc)
  setRows(prev=>[...prev.filter(r=>r.employeeId&&!members.some(m=>m.employeeId===r.employeeId)),...members.map(m=>({employeeId:m.employeeId,role:m.role}))])}
 return <Card title="Crew assigned to this job" extra={<Space wrap>
  <Select style={{minWidth:230}} placeholder="Assign a team" disabled={locked||!teams.length} value={null} onChange={assignTeam}
   options={teams.filter(t=>t.isActive&&t.currentMembers>0).map(t=>({value:t.id,label:t.name+" · "+t.currentMembers+" member"+(t.currentMembers===1?"":"s")}))}/>
  <Button type="primary" disabled={locked||!dirty||rows.some(r=>!r.employeeId||!r.role)} onClick={()=>void act(()=>packingApi.crew(detail.job.id,rows),'Crew saved')}>Save crew</Button>
 </Space>}>
  {rows.map((r,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
   <Select style={{minWidth:260}} showSearch optionFilterProp="label" placeholder="Employee" disabled={locked} value={r.employeeId||undefined} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,employeeId:v}:x))} options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:used.has(e.id)&&e.id!==r.employeeId}))}/>
   <Select style={{minWidth:200}} showSearch optionFilterProp="label" disabled={locked} value={r.role||undefined} options={roles.map(value=>({value,label:value}))} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,role:v}:x))} placeholder="Crew role"/>
   <Button danger type="text" icon={<DeleteOutlined/>} disabled={locked} onClick={()=>setRows(rows.filter((_,n)=>n!==i))}/>
  </Space>)}
  {!rows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No crew assigned"/>}
  <Button type="dashed" icon={<PlusOutlined/>} disabled={locked} onClick={()=>setRows([...rows,{employeeId:'',role:rows.length?roles[1]??'Packer':roles[0]??'Lead'}])}>Add crew member</Button>
 </Card>
}

/* ---------------- materials ---------------- */
function MaterialsTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const extrasOf=(d:PackingDetail)=>d.materials.filter(m=>!m.isBoxRecipe).map(m=>({materialId:m.materialId,quantity:m.quantity,unitCost:m.unitCost as number|null}))
 const [extras,setExtras]=useState(extrasOf(detail))
 useEffect(()=>setExtras(extrasOf(detail)),[detail.materials])
 const recipe=detail.materials.filter(m=>m.isBoxRecipe),cur=detail.accounting.baseCurrency
 const dirty=JSON.stringify(extras)!==JSON.stringify(extrasOf(detail))
 return <Row gutter={[16,16]}>
  <Col xs={24} lg={12}><Card title="From packed boxes (box recipes)" extra={<Tag>Automatic</Tag>}>
   <Table size="small" rowKey="materialId" pagination={false} dataSource={recipe} locale={{emptyText:'Pack boxes to see the materials they use'}} columns={[{title:'Material',dataIndex:'materialName'},{title:'Quantity',render:(_,m)=>m.quantity+' '+m.unit},{title:'Unit cost',align:'right',render:(_,m)=>formatMoney(m.unitCost,cur)},{title:'Cost',align:'right',render:(_,m)=>formatMoney(m.totalCost,cur)}]}/>
  </Card></Col>
  <Col xs={24} lg={12}><Card title="Extra materials used" extra={<Button type="primary" disabled={locked||!dirty||extras.some(x=>!x.materialId||!(x.quantity>0))} onClick={()=>void act(()=>packingApi.materials(detail.job.id,extras),'Materials saved')}>Save materials</Button>}>
   {extras.map((x,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
    <Select style={{minWidth:200}} showSearch optionFilterProp="label" placeholder="Material" disabled={locked} value={x.materialId||undefined} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,materialId:v,unitCost:null}:e))} options={masters.materials.map(m=>({value:m.id,label:m.name+' ('+m.unit+')'}))}/>
    <InputNumber min={0.001} max={100000} disabled={locked} value={x.quantity} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,quantity:v??0}:e))} placeholder="Qty"/>
    <InputNumber min={0} disabled={locked} value={x.unitCost??undefined} placeholder={'Cost '+(masters.materials.find(m=>m.id===x.materialId)?.currentUnitCost??'')} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,unitCost:v}:e))}/>
    <Button danger type="text" icon={<DeleteOutlined/>} disabled={locked} onClick={()=>setExtras(extras.filter((_,n)=>n!==i))}/>
   </Space>)}
   <Button type="dashed" icon={<PlusOutlined/>} disabled={locked||!masters.materials.length} onClick={()=>setExtras([...extras,{materialId:'',quantity:1,unitCost:null}])}>Add material</Button>
   <p style={{color:'#6b7686',marginTop:8,fontSize:12}}>Leave the cost blank to use the material's current cost.</p>
  </Card></Col>
  <Col span={24}><Alert type="info" showIcon title={'Total material cost '+formatMoney(detail.accounting.materialCost,cur)+(detail.accounting.materialPosted?' — posted to accounting ('+detail.accounting.materialJournalReference+').':' — posted to accounting when the job is completed (Dr 5100 Material expense / Cr 1300 Packing material stock).')}/></Col>
 </Row>
}

/* ---------------- income & expense ---------------- */
type MoneyForm={currency?:string;exchangeRate?:number;amount:number;paymentMethod:string;category:string;notes?:string}
function MoneyTab({detail,masters,act}:{detail:PackingDetail;masters:PackingMasters;act:Act}){
 const {data:currencyData}=useCurrencies()
 const [open,setOpen]=useState<'INCOME'|'EXPENSE'|null>(null),[receipt,setReceipt]=useState<string|null>(null),[form]=Form.useForm<MoneyForm>()
 const [pending,setPending]=useState<File[]>([])
 const receipts=useReceipts(detail.transactions.filter(t=>t.type==='EXPENSE').map(t=>t.id))
 const methods=masters.paymentMethods.length?masters.paymentMethods.map(m=>({value:m.code,label:m.name})):[{value:'CASH',label:'Cash'}]
 const cancelled=detail.job.status==='CANCELLED',cur=detail.accounting.baseCurrency
 const start=(type:'INCOME'|'EXPENSE')=>{form.resetFields();setPending([]);form.setFieldsValue({currency:currencyData?.settings.defaultCurrency,paymentMethod:methods[0]?.value,category:type==='INCOME'?masters.incomeCategories[0]?.name:masters.expenseCategories[0]?.code});setOpen(type)}
 const save=async()=>{const v=await form.validateFields();const type=open!;const before=new Set(detail.transactions.map(t=>t.id))
  const d=await act(()=>packingApi.transaction(detail.job.id,{type,...v}),type==='INCOME'?'Payment recorded':'Expense recorded')
  if(d){setOpen(null);const created=d.transactions.find(t=>!before.has(t.id))
   if(type==='INCOME')setReceipt(created?.id??null)
   // Receipt photos/files picked in the form are uploaded to the new expense.
   else if(created&&pending.length){const files=pending;setPending([]);void uploadReceipts('PACKING',created.id,files).then(n=>{if(n){message.success(n===1?'Receipt attached':n+' receipts attached');void receipts.reload()}})}}}
 const columns=useMemo(()=>[
  {title:'Number',dataIndex:'transactionNumber'},
  {title:'Type',dataIndex:'type',render:(v:string)=><Tag color={v==='INCOME'?'green':'volcano'}>{v==='INCOME'?'Received':'Paid'}</Tag>},
  {title:'Category',dataIndex:'category',render:(v:string)=>masters.expenseCategories.find(c=>c.code===v)?.name??v},
  {title:'Method',dataIndex:'paymentMethod',render:(v:string)=>methods.find(m=>m.value===v)?.label??v},
  {title:'Amount',align:'right' as const,render:(_:unknown,x:PackingDetail['transactions'][number])=><>{formatMoney(x.amount,x.currency||cur)}<br/><small style={{color:'#6b7686'}}>{formatMoney(x.baseAmount,cur)}</small></>},
  {title:'Date',dataIndex:'createdAtUtc',render:when},
  {title:'',render:(_:unknown,x:PackingDetail['transactions'][number])=>x.type==='INCOME'?<ReportPrintButton type="PACKING_RECEIPT" title={'Receipt '+x.transactionNumber} id={detail.job.id} query={{transactionId:x.id}} label="Receipt" size="small"/>:<ReceiptsButton kind='PACKING' expenseId={x.id} receipts={receipts.byExpense.get(x.id)??[]} onChanged={()=>void receipts.reload()} title={'Receipts · '+x.transactionNumber}/>}
 ],[masters,detail,receipts.byExpense])
 const receiptTx=detail.transactions.find(t=>t.id===receipt)
 return <>
  {receiptTx&&<Alert style={{marginBottom:12}} type="success" showIcon title={'Payment '+receiptTx.transactionNumber+' recorded.'} action={<ReportPrintButton type="PACKING_RECEIPT" title={'Receipt '+receiptTx.transactionNumber} id={detail.job.id} query={{transactionId:receiptTx.id}} label="Print receipt" buttonType="primary"/>} closable={{onClose:()=>setReceipt(null)}}/>}
  <Row gutter={[12,12]} style={{marginBottom:12}}>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Received · '+cur} value={detail.accounting.incomeBase} precision={2} styles={{content:{color:'#176b52'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Paid out · '+cur} value={detail.accounting.expenseBase} precision={2} styles={{content:{color:'#d4380d'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={'Net after materials · '+cur} value={detail.accounting.incomeBase-detail.accounting.expenseBase-detail.accounting.materialCost} precision={2}/></Card></Col>
  </Row>
  <Card title="Payments and expenses" extra={<Space><Button type="primary" icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('INCOME')}>Receive payment</Button><Button icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('EXPENSE')}>Record expense</Button></Space>}>
   <Table rowKey="id" size="middle" pagination={false} scroll={{x:800}} dataSource={detail.transactions} columns={columns} locale={{emptyText:'No money recorded on this job'}}/>
   {detail.accounting.totals.length>1&&<p style={{marginTop:8,color:'#6b7686'}}>By currency: {detail.accounting.totals.map(t=>t.currency+' received '+formatMoney(t.income,t.currency)+', paid '+formatMoney(t.expense,t.currency)).join(' · ')}</p>}
   <Alert style={{marginTop:12}} type="info" showIcon title="Accounting" description="Each payment and expense appears in Accounting › Cash posting queue as source PACKING. The accountant posts it to a cash/bank account (receipts to customer advances or invoices; expenses to the mapped expense account). Invoices and bills for this job are raised on the Invoicing & billing tab."/>
  </Card>
  <Modal centered width={860} open={open!==null} title={open==='INCOME'?'Receive payment from customer':'Record expense paid'} okText="Save" onOk={()=>void save()} onCancel={()=>setOpen(null)} destroyOnHidden>
   <Form form={form} layout="vertical" requiredMark={false}>
    <div className="money-form-grid">
     <CurrencyFields form={form}/>
     <Form.Item label="Amount" name="amount" rules={[{required:true,message:'Enter the amount'}]}><InputNumber min={0.01} max={999999999} precision={4} style={{width:'100%'}}/></Form.Item>
     <Form.Item label="Payment method" name="paymentMethod" rules={[{required:true}]}><Select options={methods}/></Form.Item>
     <Form.Item label={open==='INCOME'?'Purpose':'Expense category'} name="category" rules={[{required:true,message:'Choose a category'}]}>
      {open==='INCOME'?<AutoComplete options={masters.incomeCategories.map(c=>({value:c.name}))} placeholder="Advance, Balance…"/>:<Select options={masters.expenseCategories.map(c=>({value:c.code,label:c.name}))}/>}
     </Form.Item>
    </div>
    <Form.Item label="Notes" name="notes"><Input maxLength={500}/></Form.Item>
   {open==='EXPENSE'&&<Form.Item label="Receipt (optional)" extra="Take a photo of the bill or attach a PDF; it is uploaded when you save."><ReceiptPicker value={pending} onChange={setPending}/></Form.Item>}
   </Form>
  </Modal>
 </>
}

/* ---------------- job details ---------------- */
function EditJobModal({open,detail,onClose,onSave}:{open:boolean;detail:PackingDetail;onClose:()=>void;onSave:(v:{customerName:string;phone:string;email:string|null;address:string;scheduledAtUtc:string;notes:string|null})=>Promise<void>}){
 const [form]=Form.useForm(),j=detail.job
 const local=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 useEffect(()=>{if(open)form.setFieldsValue({customerName:j.customerName,phone:j.phone,email:j.email??'',address:j.address,scheduledAtLocal:local(j.scheduledAtUtc),notes:j.notes??''})},[open])
 return <Modal centered open={open} title={'Edit '+j.jobNumber} okText="Save" onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({customerName:v.customerName,phone:v.phone,email:v.email||null,address:v.address,notes:v.notes||null,scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString()}))} destroyOnHidden>
  <JobFields form={form}/>
 </Modal>
}

export function JobFields({form,addressLabel='Packing address'}:{form:ReturnType<typeof Form.useForm>[0];addressLabel?:string}){
 return <Form form={form} layout="vertical" requiredMark="optional">
  <Form.Item label="Customer name" name="customerName" rules={[{required:true,message:'Enter the customer name'},{max:160}]}><Input/></Form.Item>
  <Row gutter={12}><Col xs={24} md={12}><Form.Item label="Phone" name="phone" rules={[{required:true,message:'Enter a phone number'},{max:40}]}><Input/></Form.Item></Col>
   <Col xs={24} md={12}><Form.Item label="Email" name="email" rules={[{type:'email',message:'Enter a valid email'}]}><Input/></Form.Item></Col></Row>
  <Form.Item label={addressLabel} name="address" rules={[{required:true,message:'Enter the address'},{max:500}]}><Input.TextArea autoSize={{minRows:2,maxRows:4}}/></Form.Item>
  <Row gutter={12}><Col xs={24} md={12}><Form.Item label="Scheduled" name="scheduledAtLocal" rules={[{required:true}]}><Input type="datetime-local"/></Form.Item></Col></Row>
  <Form.Item label="Notes" name="notes"><Input.TextArea maxLength={2000} autoSize={{minRows:2,maxRows:5}}/></Form.Item>
 </Form>
}

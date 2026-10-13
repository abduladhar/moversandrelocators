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
import {formatDateTime,useT} from '../i18n'

const when=(v:string|null)=>v?formatDateTime(v):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

/** One packing job: boxes and labels, crew, materials, income/expense and billing. */
export function PackingJobDetailPage({jobId,onBack,onChanged}:{jobId:string;onBack:()=>void;onChanged:()=>void}){
 const [detail,setDetail]=useState<PackingDetail>(),[masters,setMasters]=useState<PackingMasters>(),[busy,setBusy]=useState(false),[tab,setTab]=useState('boxes'),[editOpen,setEditOpen]=useState(false)
 const canBill=useBilling(),{t}=useT()
 const load=()=>Promise.all([packingApi.get(jobId),packingApi.masters()]).then(([d,m])=>{setDetail(d);setMasters(m)}).catch(e=>fail(e,t('packing.detail.loadFailed')))
 useEffect(()=>{void load()},[jobId])
 /** Run a mutation that returns the updated job. */
 const act=async(f:()=>Promise<PackingDetail>,done?:string)=>{setBusy(true);try{const d=await f();setDetail(d);onChanged();if(done)message.success(done);return d}catch(e){fail(e,t('packing.detail.actionFailed'));return undefined}finally{setBusy(false)}}
 if(!detail||!masters)return <div style={{padding:60,textAlign:'center'}}><Spin/></div>
 const j=detail.job,locked=j.status==='COMPLETED'||j.status==='CANCELLED',status={color:STATUS_LABEL[j.status].color,label:t('packing.status.'+j.status)}
 const items=detail.boxes.reduce((s,b)=>s+b.items.reduce((n,i)=>n+i.quantity,0),0)
 const received=detail.transactions.filter(x=>x.type==='INCOME').reduce((s,x)=>s+(x.baseAmount??0),0)
 const setStatus=(s:PackingStatus,done:string)=>act(()=>packingApi.status(jobId,s),done)

 const kpis=[
  {key:'boxes',icon:<InboxOutlined/>,label:t('packing.boxes'),value:detail.boxes.length},
  {key:'items',icon:<UnorderedListOutlined/>,label:t('packing.detail.itemsPacked'),value:items},
  {key:'labels',icon:<TagsOutlined/>,label:t('packing.detail.labelsToPrint'),value:j.labelsPending},
  {key:'crew',icon:<TeamOutlined/>,label:t('packing.crew'),value:detail.crew.length},
  {key:'material',icon:<ShoppingOutlined/>,label:t('packing.detail.materialCost'),value:<>{formatMoney(detail.accounting.materialCost,detail.accounting.baseCurrency)}</>},
  {key:'received',icon:<DollarOutlined/>,label:t('packing.detail.received'),value:<>{formatMoney(received,detail.accounting.baseCurrency)}</>}
 ]
 const facts=[
  {key:'customer',icon:<UserOutlined/>,label:t('common.customer'),value:j.customerName},
  {key:'phone',icon:<PhoneOutlined/>,label:t('common.phone'),value:j.phone},
  {key:'email',icon:<MailOutlined/>,label:t('common.email'),value:j.email||'—'},
  {key:'address',icon:<EnvironmentOutlined/>,label:t('common.address'),value:<a href={mapsUrl(j.address,detail.customer.latitude,detail.customer.longitude)} target="_blank" rel="noopener noreferrer">{j.address}{detail.customer.latitude!=null?' · GPS':''}</a>},
  {key:'scheduled',icon:<CalendarOutlined/>,label:t('packing.scheduled'),value:<>{when(j.scheduledAtUtc)}<div><Tag color={j.scheduleConfirmedAtUtc?'green':'gold'}>{j.scheduleConfirmedAtUtc?t('packing.detail.customerConfirmed'):t('packing.detail.notConfirmed')}</Tag></div></>},
  {key:'source',icon:<LinkOutlined/>,label:t('packing.detail.createdFrom'),value:j.pickupNumber?t('packing.pickupNumber',{number:j.pickupNumber}):j.quotationNumber?t('packing.quotationNumber',{number:j.quotationNumber}):j.leadNumber?t('packing.salesLeadNumber',{number:j.leadNumber}):t('packing.direct')}
 ]

 return <div className="survey-workspace packing-workspace">
  <div className="survey-workspace-header">
   <div className="survey-heading"><Button icon={<ArrowLeftOutlined/>} onClick={onBack} aria-label={t('packing.detail.back')}/><div><Typography.Text className="eyebrow">{t('packing.detail.eyebrow')}</Typography.Text><Typography.Title level={2}>{j.jobNumber}<span className="survey-heading-customer">{j.customerName}</span><Tag className="survey-status-tag" color={status.color}>{status.label}</Tag></Typography.Title></div></div>
   <Space wrap className="survey-heading-actions">
    <ReportPrintButton type="PACKING_SHEET" title={t('packing.detail.packingListTitle',{number:j.jobNumber})} id={jobId} label={t('packing.packingList')} disabled={!detail.boxes.length}/>
    <Button icon={<EditOutlined/>} disabled={j.status==='CANCELLED'} onClick={()=>setEditOpen(true)}>{t('packing.detail.editDetails')}</Button>
    {!locked&&<Popconfirm title={t('packing.detail.cancelTitle')} okText={t('common.yes')} cancelText={t('common.no')} okButtonProps={{danger:true}} onConfirm={()=>void setStatus('CANCELLED',t('packing.detail.cancelled'))}><Button danger icon={<StopOutlined/>}>{t('packing.detail.cancelJob')}</Button></Popconfirm>}
    {locked&&<Popconfirm title={t('packing.detail.reopenTitle')} description={j.status==='COMPLETED'?t('packing.detail.reopenHelp'):undefined} okText={t('packing.detail.reopen')} cancelText={t('common.cancel')} onConfirm={()=>void setStatus('IN_PROGRESS',t('packing.detail.reopened'))}><Button icon={<RollbackOutlined/>} loading={busy}>{t('packing.detail.reopen')}</Button></Popconfirm>}
    {j.status==='PLANNED'&&<Button icon={<PlayCircleOutlined/>} loading={busy} onClick={()=>void setStatus('IN_PROGRESS',t('packing.detail.started'))}>{t('packing.detail.start')}</Button>}
    {(j.status==='PLANNED'||j.status==='IN_PROGRESS')&&<Popconfirm title={t('packing.detail.completeTitle')} description={<>{t('packing.detail.completeHelp')}<br/>{t('packing.detail.completePosting',{amount:formatMoney(detail.accounting.materialCost,detail.accounting.baseCurrency)})}</>} okText={t('packing.detail.complete')} cancelText={t('common.cancel')} onConfirm={()=>void setStatus('COMPLETED',t('packing.detail.completed'))}><Button type="primary" icon={<CheckCircleOutlined/>} loading={busy} disabled={!detail.boxes.length}>{t('packing.detail.complete')}</Button></Popconfirm>}
   </Space>
  </div>
  {locked&&<Alert type={j.status==='COMPLETED'?'success':'warning'} showIcon title={j.status==='COMPLETED'?t('packing.detail.completedBanner',{date:when(j.completedAtUtc)}):t('packing.detail.cancelledBanner')}/>}
  <div className="survey-kpi-row packing-kpi-row">{kpis.map(k=><div key={k.key} className={'survey-kpi packing-kpi-'+k.key+(k.key==='labels'&&j.labelsPending?' is-pending':'')}><span className="survey-kpi-icon">{k.icon}</span><div><small>{k.label}</small><strong>{k.value}</strong></div></div>)}</div>
  <Card className="survey-customer-strip"><div className="survey-facts pickup-facts">{facts.map(f=><div key={f.key} className="survey-fact"><span className="survey-fact-icon">{f.icon}</span><div><small>{f.label}</small><div className="survey-fact-value">{f.value}</div></div></div>)}</div>
   {j.notes&&<div className="packing-notes"><small>{t('common.notes')}</small>{j.notes}</div>}</Card>
  <Tabs className="pickup-tabs" activeKey={tab} onChange={setTab} items={[
   {key:'boxes',label:<span><TagsOutlined/> {t('packing.detail.tabBoxes',{count:detail.boxes.length})}</span>,children:<BoxesTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'crew',label:<span><TeamOutlined/> {t('packing.detail.tabCrew',{count:detail.crew.length})}</span>,children:<CrewTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'materials',label:t('packing.detail.tabMaterials'),children:<MaterialsTab detail={detail} masters={masters} locked={locked} act={act}/>},
   {key:'customer',label:<span>{t('packing.detail.tabCustomer')}{detail.customer.itemsResponse==='CORRECTIONS'&&detail.customer.itemsResponseCurrent?<Tag color="red" style={{marginInlineStart:6}}>{t('packing.detail.corrections')}</Tag>:null}</span>,children:<PackingCustomerTab detail={detail} act={act}/>},
   {key:'money',label:t('packing.detail.tabMoney'),children:<MoneyTab detail={detail} masters={masters} act={act}/>},
   ...(canBill?[{key:'billing',label:t('packing.detail.tabBilling'),children:<BillingPanel sourceKind="PACKING" sourceId={jobId} companyName=""/>}]:[])
  ]}/>
  <EditJobModal open={editOpen} detail={detail} onClose={()=>setEditOpen(false)} onSave={v=>act(()=>packingApi.update(jobId,v),t('packing.detail.saved')).then(d=>{if(d)setEditOpen(false)})}/>
 </div>
}

type Act=(f:()=>Promise<PackingDetail>,done?:string)=>Promise<PackingDetail|undefined>

/* ---------------- boxes & labels ---------------- */
function BoxesTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const jobId=detail.job.id,{t}=useT()
 const [editing,setEditing]=useState<PackingBox|'new'|null>(null),[selected,setSelected]=useState<string[]>([]),[justPacked,setJustPacked]=useState<string[]>([])
 const pending=detail.boxes.filter(b=>!b.labelPrintedAtUtc).map(b=>b.id)
 const printed=(ids:string[])=>()=>void act(()=>packingApi.labelsPrinted(jobId,ids)).then(()=>{setJustPacked([]);setSelected([])})
 const LabelButton=({ids,label,primary}:{ids:string[];label:string;primary?:boolean})=><ReportPrintButton type="PACKING_LABELS" title={t('packing.boxesTab.labelsTitle',{number:detail.job.jobNumber})} id={jobId} query={{boxIds:ids.join(',')}} label={label} icon={<PrinterOutlined/>} buttonType={primary?'primary':'default'} disabled={!ids.length} onPrinted={printed(ids)}/>
 const save=async(v:SavePackingBox)=>{
  const before=new Set(detail.boxes.map(b=>b.id))
  const d=await act(()=>editing==='new'?packingApi.addBox(jobId,v):packingApi.updateBox(jobId,(editing as PackingBox).id,v),editing==='new'?t('packing.boxesTab.packed',{count:v.copies??1}):t('packing.boxesTab.updated'))
  if(d){if(editing==='new')setJustPacked(d.boxes.filter(b=>!before.has(b.id)).map(b=>b.id));setEditing(null)}
 }
 return <>
  {justPacked.length>0&&<Alert style={{marginBottom:12}} type="success" showIcon title={t('packing.boxesTab.justPacked',{boxes:detail.boxes.filter(b=>justPacked.includes(b.id)).map(b=>b.trackingNumber).join(', ')})} action={<LabelButton ids={justPacked} label={t('packing.boxesTab.printLabels',{count:justPacked.length})} primary/>} closable={{onClose:()=>setJustPacked([])}}/>}
  <div className="packing-toolbar">
   <Button type="primary" icon={<PlusOutlined/>} disabled={locked||!masters.boxTypes.length} onClick={()=>setEditing('new')}>{t('packing.packABox')}</Button>
   <Space wrap>
    <LabelButton ids={pending} label={t('packing.boxesTab.printPending',{count:pending.length})}/>
    <LabelButton ids={selected} label={t('packing.boxesTab.printSelected',{count:selected.length})}/>
    <LabelButton ids={detail.boxes.map(b=>b.id)} label={t('packing.boxesTab.reprintAll')}/>
   </Space>
  </div>
  {!masters.boxTypes.length&&<Alert type="warning" showIcon title={t('packing.boxesTab.noBoxTypes')}/>}
  <Table<PackingBox> className="packing-box-table" rowKey="id" size="middle" dataSource={detail.boxes} pagination={false} scroll={{x:900}} locale={{emptyText:<Empty description={t('packing.noBoxesYet')}/>}}
   rowSelection={{selectedRowKeys:selected,onChange:k=>setSelected(k as string[])}}
   columns={[
    {title:'#',width:48,render:(_,b,i)=>i+1},
    {title:t('packing.boxesTab.colBox'),width:260,render:(_,b)=><div className="primary-cell"><strong className="packing-tracking">{b.trackingNumber}</strong><small>{b.boxTypeName}{b.customMaterials?' · '+t('packing.boxesTab.materialsEdited'):''}</small></div>},
    {title:t('common.room'),dataIndex:'roomName',width:160,render:v=>v||'—'},
    {title:t('packing.contents'),render:(_,b)=><div className="packing-contents">{b.items.map((i,n)=><Tag key={n}>{i.itemName} × {i.quantity}{i.notes?' · '+i.notes:''}</Tag>)}{b.isFragile&&<Tag color="red">{t('packing.fragile')}</Tag>}{b.notes&&<small>{b.notes}</small>}</div>},
    {title:t('packing.boxesTab.colLabel'),width:130,render:(_,b)=>b.labelPrintedAtUtc?<Tooltip title={t('packing.boxesTab.printedTip',{count:b.labelPrintCount,date:when(b.labelPrintedAtUtc)})}><Tag color="green">{t('packing.boxesTab.printed')}</Tag></Tooltip>:<Tag color="orange">{t('packing.boxesTab.notPrinted')}</Tag>},
    {title:t('common.actions'),width:190,align:'right',render:(_,b)=><Space size={6}>
     <LabelButton ids={[b.id]} label={t('packing.boxesTab.colLabel')}/>
     <Tooltip title={t('packing.boxesTab.editBox')}><Button icon={<EditOutlined/>} disabled={locked} onClick={()=>setEditing(b)} aria-label={t('packing.boxesTab.editBox')}/></Tooltip>
     <Popconfirm title={t('packing.boxesTab.removeTitle',{number:b.trackingNumber})} description={t('packing.boxesTab.removeHelp')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={()=>void act(()=>packingApi.deleteBox(jobId,b.id),t('packing.boxesTab.removed'))}><Tooltip title={t('packing.boxesTab.removeBox')}><Button danger icon={<DeleteOutlined/>} disabled={locked} aria-label={t('packing.boxesTab.removeBox')}/></Tooltip></Popconfirm>
    </Space>}
   ]}/>
  <BoxModal open={editing!==null} box={editing==='new'?undefined:editing??undefined} masters={masters} rooms={[...new Set(detail.boxes.map(b=>b.roomName).filter((x):x is string=>!!x))]} onCancel={()=>setEditing(null)} onSave={save}/>
 </>
}

function BoxModal({open,box,masters,rooms,onCancel,onSave}:{open:boolean;box?:PackingBox;masters:PackingMasters;rooms:string[];onCancel:()=>void;onSave:(v:SavePackingBox)=>Promise<void>}){
 const [form]=Form.useForm<SavePackingBox>(),[saving,setSaving]=useState(false),{t}=useT()
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
 const ok=async()=>{const v=await form.validateFields();if(custom&&!matsValid){message.error(t('packing.boxModal.materialsInvalid'));return}
  setSaving(true);try{await onSave({...v,items:(v.items??[]).filter(i=>i?.itemName?.trim()),materials:custom?mats.map(m=>({materialId:m.materialId,quantity:m.quantity!})):null})}finally{setSaving(false)}}
 return <Modal centered width={720} open={open} title={box?t('packing.boxModal.editTitle',{number:box.trackingNumber}):t('packing.packABox')} okText={box?t('packing.boxModal.saveBox'):t('packing.boxModal.packBox')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={()=>void ok()} onCancel={onCancel} destroyOnHidden>
  <Form form={form} layout="vertical" requiredMark={false} className="packing-box-form">
   <Row gutter={16}>
    <Col xs={24} md={12}><Form.Item label={t('packing.boxModal.boxType')} name="boxTypeId" rules={[{required:true,message:t('packing.boxModal.chooseBoxType')}]}><Select options={masters.boxTypes.map(b=>({value:b.id,label:b.name+' ('+b.code+')'}))}/></Form.Item></Col>
    <Col xs={24} md={12}><Form.Item label={t('common.room')} name="roomName"><AutoComplete options={rooms.map(value=>({value}))} placeholder={t('packing.boxModal.roomPlaceholder')} filterOption/></Form.Item></Col>
   </Row>
   <Form.List name="items">{(fields,{add,remove})=><div className="packing-items">
    <div className="packing-section-title">{t('packing.contents')}</div>
    <div className="packing-item-row packing-item-head"><span>{t('common.item')}</span><span>{t('packing.qty')}</span><span>{t('common.notes')}</span><span/></div>
    {fields.map(f=><div key={f.key} className="packing-item-row">
     <Form.Item name={[f.name,'itemName']} rules={[{max:160}]}><Input placeholder={t('packing.boxModal.itemPlaceholder')}/></Form.Item>
     <Form.Item name={[f.name,'quantity']} rules={[{required:true,type:'number',min:1,max:10000,message:'1–10000'}]}><InputNumber min={1} max={10000} style={{width:'100%'}}/></Form.Item>
     <Form.Item name={[f.name,'notes']}><Input placeholder={t('common.optional')}/></Form.Item>
     <Tooltip title={t('packing.boxModal.removeItem')}><Button type="text" danger icon={<DeleteOutlined/>} disabled={fields.length<2} onClick={()=>remove(f.name)} aria-label={t('packing.boxModal.removeItem')}/></Tooltip>
    </div>)}
    <Button type="dashed" block icon={<PlusOutlined/>} onClick={()=>add({itemName:'',quantity:1})}>{t('packing.boxModal.addItem')}</Button>
   </div>}</Form.List>
   <div className="packing-materials">
    <div className="packing-section-head">
     <div><div className="packing-section-title">{t('packing.boxModal.materialsUsed')}</div><small>{custom?t('packing.boxModal.recordedForBox'):recipe.length?t('packing.boxModal.standardForType'):t('packing.boxModal.noStandard')}</small></div>
     {custom&&<Button type="link" size="small" icon={<RollbackOutlined/>} onClick={()=>{setMats(fromRecipe(boxTypeId));setCustom(false)}}>{t('packing.boxModal.useStandard')}</Button>}
    </div>
    {mats.length>0&&<div className="packing-material-row packing-item-head"><span>{t('packing.material')}</span><span>{t('packing.qty')}</span><span/></div>}
    {mats.map((m,i)=><div key={i} className="packing-material-row">
     <Select showSearch optionFilterProp="label" placeholder={t('packing.material')} value={m.materialId||undefined} status={!m.materialId?'error':undefined} onChange={v=>editMats(mats.map((x,n)=>n===i?{...x,materialId:v}:x))}
      options={masters.materials.map(o=>({value:o.id,label:o.name,disabled:mats.some((x,n)=>n!==i&&x.materialId===o.id)}))}/>
     <InputNumber min={0.001} max={100000} step={0.25} value={m.quantity} status={!m.quantity?'error':undefined} suffix={unit(m.materialId)} style={{width:'100%'}} onChange={v=>editMats(mats.map((x,n)=>n===i?{...x,quantity:v}:x))}/>
     <Tooltip title={t('packing.removeMaterial')}><Button type="text" danger icon={<DeleteOutlined/>} onClick={()=>editMats(mats.filter((_,n)=>n!==i))} aria-label={t('packing.removeMaterial')}/></Tooltip>
    </div>)}
    <Button type="dashed" block icon={<PlusOutlined/>} disabled={!masters.materials.length} onClick={()=>editMats([...mats,{materialId:'',quantity:1}])}>{t('packing.addMaterial')}</Button>
   </div>
   <Form.Item label={t('packing.boxModal.boxNotes')} name="notes"><Input maxLength={500} placeholder={t('common.optional')}/></Form.Item>
   <div className="packing-box-options">
    <div className="packing-option"><Form.Item name="isFragile" valuePropName="checked" noStyle><Switch/></Form.Item><div><strong>{t('packing.fragile')}</strong><small>{t('packing.boxModal.fragileHelp')}</small></div></div>
    {!box&&<div className="packing-option"><Form.Item name="copies" noStyle><InputNumber min={1} max={50} style={{width:72}}/></Form.Item><div><strong>{t('packing.boxModal.identical')}</strong><small>{t('packing.boxModal.identicalHelp')}</small></div></div>}
   </div>
  </Form>
 </Modal>
}

/* ---------------- crew ---------------- */
function CrewTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const [rows,setRows]=useState(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})))
 const [teams,setTeams]=useState<CrewTeam[]>([]),{t}=useT()
 useEffect(()=>{crewApi.teams().then(setTeams).catch(()=>setTeams([]))},[])
 useEffect(()=>setRows(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role}))),[detail.crew])
 const roles=masters.crewRoles.length?masters.crewRoles.map(r=>r.name):['Lead','Packer','Helper','Driver']
 const used=new Set(rows.map(r=>r.employeeId))
 const dirty=JSON.stringify(rows)!==JSON.stringify(detail.crew.map(c=>({employeeId:c.employeeId,role:c.role})))
 // Assigning a team drops in its current members with the role each holds in that team. The team itself is
 // stamped on each row by the server when the crew is saved, from the member's membership at that moment.
 const assignTeam=(id:string)=>{const team=teams.find(x=>x.id===id);if(!team)return
  const members=team.members.filter(m=>!m.leftAtUtc)
  setRows(prev=>[...prev.filter(r=>r.employeeId&&!members.some(m=>m.employeeId===r.employeeId)),...members.map(m=>({employeeId:m.employeeId,role:m.role}))])}
 return <Card title={t('packing.crewTab.title')} extra={<Space wrap>
  <Select style={{minWidth:230}} placeholder={t('packing.crewTab.assignTeam')} disabled={locked||!teams.length} value={null} onChange={assignTeam}
   options={teams.filter(x=>x.isActive&&x.currentMembers>0).map(x=>({value:x.id,label:x.name+' · '+t('packing.crewTab.memberCount',{count:x.currentMembers})}))}/>
  <Button type="primary" disabled={locked||!dirty||rows.some(r=>!r.employeeId||!r.role)} onClick={()=>void act(()=>packingApi.crew(detail.job.id,rows),t('packing.crewTab.saved'))}>{t('packing.crewTab.save')}</Button>
 </Space>}>
  {rows.map((r,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
   <Select style={{minWidth:260}} showSearch optionFilterProp="label" placeholder={t('common.employee')} disabled={locked} value={r.employeeId||undefined} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,employeeId:v}:x))} options={masters.employees.map(e=>({value:e.id,label:e.name,disabled:used.has(e.id)&&e.id!==r.employeeId}))}/>
   <Select style={{minWidth:200}} showSearch optionFilterProp="label" disabled={locked} value={r.role||undefined} options={roles.map(value=>({value,label:value}))} onChange={v=>setRows(rows.map((x,n)=>n===i?{...x,role:v}:x))} placeholder={t('packing.crewTab.role')}/>
   <Button danger type="text" icon={<DeleteOutlined/>} disabled={locked} aria-label={t('common.remove')} onClick={()=>setRows(rows.filter((_,n)=>n!==i))}/>
  </Space>)}
  {!rows.length&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('packing.crewTab.none')}/>}
  <Button type="dashed" icon={<PlusOutlined/>} disabled={locked} onClick={()=>setRows([...rows,{employeeId:'',role:rows.length?roles[1]??'Packer':roles[0]??'Lead'}])}>{t('packing.crewTab.add')}</Button>
 </Card>
}

/* ---------------- materials ---------------- */
function MaterialsTab({detail,masters,locked,act}:{detail:PackingDetail;masters:PackingMasters;locked:boolean;act:Act}){
 const extrasOf=(d:PackingDetail)=>d.materials.filter(m=>!m.isBoxRecipe).map(m=>({materialId:m.materialId,quantity:m.quantity,unitCost:m.unitCost as number|null}))
 const [extras,setExtras]=useState(extrasOf(detail)),{t}=useT()
 useEffect(()=>setExtras(extrasOf(detail)),[detail.materials])
 const recipe=detail.materials.filter(m=>m.isBoxRecipe),cur=detail.accounting.baseCurrency
 const dirty=JSON.stringify(extras)!==JSON.stringify(extrasOf(detail))
 return <Row gutter={[16,16]}>
  <Col xs={24} lg={12}><Card title={t('packing.materialsTab.fromBoxes')} extra={<Tag>{t('packing.materialsTab.automatic')}</Tag>}>
   <Table size="small" rowKey="materialId" pagination={false} dataSource={recipe} locale={{emptyText:t('packing.materialsTab.empty')}} columns={[{title:t('packing.material'),dataIndex:'materialName'},{title:t('common.quantity'),render:(_,m)=>m.quantity+' '+m.unit},{title:t('packing.materialsTab.unitCost'),align:'right',render:(_,m)=>formatMoney(m.unitCost,cur)},{title:t('packing.materialsTab.cost'),align:'right',render:(_,m)=>formatMoney(m.totalCost,cur)}]}/>
  </Card></Col>
  <Col xs={24} lg={12}><Card title={t('packing.materialsTab.extra')} extra={<Button type="primary" disabled={locked||!dirty||extras.some(x=>!x.materialId||!(x.quantity>0))} onClick={()=>void act(()=>packingApi.materials(detail.job.id,extras),t('packing.materialsTab.saved'))}>{t('packing.materialsTab.save')}</Button>}>
   {extras.map((x,i)=><Space key={i} style={{display:'flex',marginBottom:8}} wrap>
    <Select style={{minWidth:200}} showSearch optionFilterProp="label" placeholder={t('packing.material')} disabled={locked} value={x.materialId||undefined} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,materialId:v,unitCost:null}:e))} options={masters.materials.map(m=>({value:m.id,label:m.name+' ('+m.unit+')'}))}/>
    <InputNumber min={0.001} max={100000} disabled={locked} value={x.quantity} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,quantity:v??0}:e))} placeholder={t('packing.qty')}/>
    <InputNumber min={0} disabled={locked} value={x.unitCost??undefined} placeholder={t('packing.materialsTab.costPlaceholder',{cost:masters.materials.find(m=>m.id===x.materialId)?.currentUnitCost??''})} onChange={v=>setExtras(extras.map((e,n)=>n===i?{...e,unitCost:v}:e))}/>
    <Button danger type="text" icon={<DeleteOutlined/>} disabled={locked} aria-label={t('packing.removeMaterial')} onClick={()=>setExtras(extras.filter((_,n)=>n!==i))}/>
   </Space>)}
   <Button type="dashed" icon={<PlusOutlined/>} disabled={locked||!masters.materials.length} onClick={()=>setExtras([...extras,{materialId:'',quantity:1,unitCost:null}])}>{t('packing.addMaterial')}</Button>
   <p style={{color:'#6b7686',marginTop:8,fontSize:12}}>{t('packing.materialsTab.costHint')}</p>
  </Card></Col>
  <Col span={24}><Alert type="info" showIcon title={detail.accounting.materialPosted?t('packing.materialsTab.totalPosted',{amount:formatMoney(detail.accounting.materialCost,cur),reference:detail.accounting.materialJournalReference??''}):t('packing.materialsTab.totalPending',{amount:formatMoney(detail.accounting.materialCost,cur)})}/></Col>
 </Row>
}

/* ---------------- income & expense ---------------- */
type MoneyForm={currency?:string;exchangeRate?:number;amount:number;paymentMethod:string;category:string;notes?:string;paidByEmployeeId?:string}
function MoneyTab({detail,masters,act}:{detail:PackingDetail;masters:PackingMasters;act:Act}){
 const {data:currencyData}=useCurrencies()
 const [open,setOpen]=useState<'INCOME'|'EXPENSE'|null>(null),[receipt,setReceipt]=useState<string|null>(null),[form]=Form.useForm<MoneyForm>()
 const [pending,setPending]=useState<File[]>([]),{t}=useT()
 const receipts=useReceipts(detail.transactions.filter(t=>t.type==='EXPENSE').map(t=>t.id))
 const methods=masters.paymentMethods.length?masters.paymentMethods.map(m=>({value:m.code,label:m.name})):[{value:'CASH',label:t('packing.money.cash')}]
 const cancelled=detail.job.status==='CANCELLED',cur=detail.accounting.baseCurrency
 const start=(type:'INCOME'|'EXPENSE')=>{form.resetFields();setPending([]);form.setFieldsValue({paidByEmployeeId:detail.crew.length===1?detail.crew[0].employeeId:undefined,currency:currencyData?.settings.defaultCurrency,paymentMethod:methods[0]?.value,category:type==='INCOME'?masters.incomeCategories[0]?.name:masters.expenseCategories[0]?.code});setOpen(type)}
 const save=async()=>{const v=await form.validateFields();const type=open!;const before=new Set(detail.transactions.map(t=>t.id))
  const d=await act(()=>packingApi.transaction(detail.job.id,{type,...v}),type==='INCOME'?t('packing.money.paymentRecorded'):t('packing.money.expenseRecorded'))
  if(d){setOpen(null);const created=d.transactions.find(t=>!before.has(t.id))
   if(type==='INCOME')setReceipt(created?.id??null)
   // Receipt photos/files picked in the form are uploaded to the new expense.
   else if(created&&pending.length){const files=pending;setPending([]);void uploadReceipts('PACKING',created.id,files).then(n=>{if(n){message.success(t('expenses.receipts.attached',{count:n}));void receipts.reload()}})}}}
 const columns=useMemo(()=>[
  {title:t('packing.money.colNumber'),dataIndex:'transactionNumber'},
  {title:t('common.type'),dataIndex:'type',render:(v:string)=><Tag color={v==='INCOME'?'green':'volcano'}>{v==='INCOME'?t('packing.money.received'):t('packing.money.paid')}</Tag>},
  {title:t('packing.money.colCategory'),dataIndex:'category',render:(v:string)=>masters.expenseCategories.find(c=>c.code===v)?.name??v},
  {title:t('packing.money.paidBy'),dataIndex:'paidByName',render:(v:string|null|undefined,x:{type:string})=>x.type==='EXPENSE'?(v??'—'):''},
  {title:t('packing.money.colMethod'),dataIndex:'paymentMethod',render:(v:string)=>methods.find(m=>m.value===v)?.label??v},
  {title:t('common.amount'),align:'right' as const,render:(_:unknown,x:PackingDetail['transactions'][number])=><>{formatMoney(x.amount,x.currency||cur)}<br/><small style={{color:'#6b7686'}}>{formatMoney(x.baseAmount,cur)}</small></>},
  {title:t('common.date'),dataIndex:'createdAtUtc',render:when},
  {title:'',render:(_:unknown,x:PackingDetail['transactions'][number])=>x.type==='INCOME'?<ReportPrintButton type="PACKING_RECEIPT" title={t('packing.money.receiptTitle',{number:x.transactionNumber})} id={detail.job.id} query={{transactionId:x.id}} label={t('packing.money.receipt')} size="small"/>:<ReceiptsButton kind='PACKING' expenseId={x.id} receipts={receipts.byExpense.get(x.id)??[]} onChanged={()=>void receipts.reload()} title={t('packing.money.receiptsTitle',{number:x.transactionNumber})}/>}
 ],[masters,detail,receipts.byExpense,t])
 const receiptTx=detail.transactions.find(t=>t.id===receipt)
 return <>
  {receiptTx&&<Alert style={{marginBottom:12}} type="success" showIcon title={t('packing.money.paymentBanner',{number:receiptTx.transactionNumber})} action={<ReportPrintButton type="PACKING_RECEIPT" title={t('packing.money.receiptTitle',{number:receiptTx.transactionNumber})} id={detail.job.id} query={{transactionId:receiptTx.id}} label={t('packing.money.printReceipt')} buttonType="primary"/>} closable={{onClose:()=>setReceipt(null)}}/>}
  <Row gutter={[12,12]} style={{marginBottom:12}}>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('packing.money.receivedIn',{currency:cur})} value={detail.accounting.incomeBase} precision={2} styles={{content:{color:'#176b52'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('packing.money.paidOutIn',{currency:cur})} value={detail.accounting.expenseBase} precision={2} styles={{content:{color:'#d4380d'}}}/></Card></Col>
   <Col xs={24} md={8}><Card size="small"><Statistic title={t('packing.money.netIn',{currency:cur})} value={detail.accounting.incomeBase-detail.accounting.expenseBase-detail.accounting.materialCost} precision={2}/></Card></Col>
  </Row>
  <Card title={t('packing.money.title')} extra={<Space><Button type="primary" icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('INCOME')}>{t('packing.money.receive')}</Button><Button icon={<PlusOutlined/>} disabled={cancelled} onClick={()=>start('EXPENSE')}>{t('packing.money.recordExpense')}</Button></Space>}>
   <Table rowKey="id" size="middle" pagination={false} scroll={{x:800}} dataSource={detail.transactions} columns={columns} locale={{emptyText:t('packing.money.empty')}}/>
   {detail.accounting.totals.length>1&&<p style={{marginTop:8,color:'#6b7686'}}>{t('packing.money.byCurrency',{totals:detail.accounting.totals.map(x=>t('packing.money.currencyTotal',{currency:x.currency,received:formatMoney(x.income,x.currency),paid:formatMoney(x.expense,x.currency)})).join(' · ')})}</p>}
   <Alert style={{marginTop:12}} type="info" showIcon title={t('packing.money.accounting')} description={t('packing.money.accountingHelp')}/>
  </Card>
  <Modal centered width={860} open={open!==null} title={open==='INCOME'?t('packing.money.receiveTitle'):t('packing.money.expenseTitle')} okText={t('common.save')} cancelText={t('common.cancel')} onOk={()=>void save()} onCancel={()=>setOpen(null)} destroyOnHidden>
   <Form form={form} layout="vertical" requiredMark={false}>
    <div className="money-form-grid">
     <CurrencyFields form={form}/>
     <Form.Item label={t('common.amount')} name="amount" rules={[{required:true,message:t('packing.money.enterAmount')}]}><InputNumber min={0.01} max={999999999} precision={4} style={{width:'100%'}}/></Form.Item>
     <Form.Item label={t('packing.money.paymentMethod')} name="paymentMethod" rules={[{required:true}]}><Select options={methods}/></Form.Item>
     <Form.Item label={open==='INCOME'?t('packing.money.purpose'):t('packing.money.expenseCategory')} name="category" rules={[{required:true,message:t('packing.money.chooseCategory')}]}>
      {open==='INCOME'?<AutoComplete options={masters.incomeCategories.map(c=>({value:c.name}))} placeholder={t('packing.money.purposePlaceholder')}/>:<Select options={masters.expenseCategories.map(c=>({value:c.code,label:c.name}))}/>}
     </Form.Item>
    </div>
    {open==='EXPENSE'&&<Form.Item label={t('packing.money.paidBy')} name="paidByEmployeeId" extra={t('packing.money.paidByHelp')}><Select allowClear showSearch optionFilterProp="label" placeholder={t('packing.money.selectEmployee')} options={masters.employees.map(e=>({value:e.id,label:e.name}))}/></Form.Item>}
    <Form.Item label={t('common.notes')} name="notes"><Input maxLength={500}/></Form.Item>
   {open==='EXPENSE'&&<Form.Item label={t('expenses.receipts.optionalLabel')} extra={t('expenses.receipts.optionalHelp')}><ReceiptPicker value={pending} onChange={setPending}/></Form.Item>}
   </Form>
  </Modal>
 </>
}

/* ---------------- job details ---------------- */
function EditJobModal({open,detail,onClose,onSave}:{open:boolean;detail:PackingDetail;onClose:()=>void;onSave:(v:{customerName:string;phone:string;email:string|null;address:string;scheduledAtUtc:string;notes:string|null})=>Promise<void>}){
 const [form]=Form.useForm(),j=detail.job,{t}=useT()
 const local=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 useEffect(()=>{if(open)form.setFieldsValue({customerName:j.customerName,phone:j.phone,email:j.email??'',address:j.address,scheduledAtLocal:local(j.scheduledAtUtc),notes:j.notes??''})},[open])
 return <Modal centered open={open} title={t('packing.job.editTitle',{number:j.jobNumber})} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={onClose} onOk={()=>void form.validateFields().then(v=>onSave({customerName:v.customerName,phone:v.phone,email:v.email||null,address:v.address,notes:v.notes||null,scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString()}))} destroyOnHidden>
  <JobFields form={form}/>
 </Modal>
}

export function JobFields({form,addressLabel}:{form:ReturnType<typeof Form.useForm>[0];addressLabel?:string}){
 const {t}=useT()
 return <Form form={form} layout="vertical" requiredMark="optional">
  <Form.Item label={t('packing.job.customerName')} name="customerName" rules={[{required:true,message:t('packing.job.enterCustomerName')},{max:160}]}><Input/></Form.Item>
  <Row gutter={12}><Col xs={24} md={12}><Form.Item label={t('common.phone')} name="phone" rules={[{required:true,message:t('packing.job.enterPhone')},{max:40}]}><Input/></Form.Item></Col>
   <Col xs={24} md={12}><Form.Item label={t('common.email')} name="email" rules={[{type:'email',message:t('packing.job.enterValidEmail')}]}><Input/></Form.Item></Col></Row>
  <Form.Item label={addressLabel??t('packing.job.packingAddress')} name="address" rules={[{required:true,message:t('packing.job.enterAddress')},{max:500}]}><Input.TextArea autoSize={{minRows:2,maxRows:4}}/></Form.Item>
  <Row gutter={12}><Col xs={24} md={12}><Form.Item label={t('packing.scheduled')} name="scheduledAtLocal" rules={[{required:true}]}><Input type="datetime-local"/></Form.Item></Col></Row>
  <Form.Item label={t('common.notes')} name="notes"><Input.TextArea maxLength={2000} autoSize={{minRows:2,maxRows:5}}/></Form.Item>
 </Form>
}

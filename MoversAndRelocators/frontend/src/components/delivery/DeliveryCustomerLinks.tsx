import {useState,type ReactNode} from 'react'
import {Alert,Button,Card,Input,Modal,Popconfirm,Select,Tag,Tooltip,message} from 'antd'
import {CalendarOutlined,CopyOutlined,EnvironmentOutlined,LinkOutlined,StopOutlined,WhatsAppOutlined} from '@ant-design/icons'
import {deliveryApi,type DeliveryDetail,type DeliveryLinkPurpose,type DeliveryNote} from '../../deliveryApi'
import {mapsUrl} from '../../packingApi'

const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
type Act=(f:()=>Promise<DeliveryDetail>,done?:string)=>Promise<DeliveryDetail|undefined>

const LINKS:Record<DeliveryLinkPurpose,{title:string;icon:ReactNode;help:string;ask:string}>={
 SCHEDULE:{title:'Confirm delivery date',icon:<CalendarOutlined/>,help:'The customer confirms the delivery date and time, or asks for another time that suits them.',ask:'please confirm your delivery date and time'},
 LOCATION:{title:'Share location',icon:<EnvironmentOutlined/>,help:'The customer shares the exact GPS location of the delivery address, with directions for the driver.',ask:'please share your delivery location'}
}

/** Tags for the note header: the customer's answer on the date, and whether GPS was shared. */
export function CustomerStatusTags({note}:{note:DeliveryNote}){
 const c=note.customer
 const date=!c.dateResponse?null:!c.dateResponseCurrent?<Tag color="orange">Date answer outdated</Tag>
  :c.dateResponse==='CONFIRMED'?<Tag color="green">Date confirmed</Tag>:<Tag color="red">Asks for {when(c.preferredAtUtc)}</Tag>
 return <>{date}{c.latitude!=null?<Tag color="green" icon={<EnvironmentOutlined/>}>GPS shared</Tag>:c.locationSharedAtUtc?<Tag color="green" icon={<EnvironmentOutlined/>}>Address updated</Tag>:null}</>
}

/** Per-customer links on a delivery note: confirm the delivery date, and share the delivery location. */
export function DeliveryCustomerLinks({detail,note,open,onClose,act}:{detail:DeliveryDetail;note:DeliveryNote|null;open:boolean;onClose:()=>void;act:Act}){
 const [shared,setShared]=useState<{purpose:DeliveryLinkPurpose;url:string}>()
 if(!note)return null
 const c=note.customer,j=detail.job
 const gps=c.latitude!=null&&c.longitude!=null
 const text=shared?'Hello '+note.customerName+', '+LINKS[shared.purpose].ask+' (delivery '+note.noteNumber+'): '+shared.url:''
 const blocked=j.status==='COMPLETED'||j.status==='CANCELLED'?'The delivery is '+j.status.toLowerCase():note.isSigned?'The customer has already signed':undefined
 const dateStatus=!c.dateResponse?<Tag color="gold">Awaiting customer</Tag>:!c.dateResponseCurrent?<Tag color="orange">Outdated</Tag>:c.dateResponse==='CONFIRMED'?<Tag color="green">Confirmed</Tag>:<Tag color="red">Other time requested</Tag>
 return <Modal centered width={980} open={open} title={'Customer links · '+note.customerName+' · '+note.noteNumber} footer={null} onCancel={onClose} destroyOnHidden>
  <div className="packing-customer-grid">
   <LinkCard purpose="SCHEDULE" detail={detail} note={note} act={act} blocked={blocked} onShared={setShared} status={dateStatus}>
    <Fact label="Delivery date" value={when(j.scheduledAtUtc)}/>
    <Fact label="Customer answer" value={!c.dateResponse?'Not yet':(c.dateResponse==='CONFIRMED'?'Confirmed':'Asks for '+when(c.preferredAtUtc))+' · '+when(c.dateRespondedAtUtc)}/>
    {c.dateResponse==='RESCHEDULE'&&c.dateResponseCurrent&&<Alert type="warning" showIcon title="The customer asked for another time" description="This run serves other customers too. Reschedule the run, or take this customer's packages off and deliver them on another run."/>}
    {c.dateResponse&&!c.dateResponseCurrent&&<Alert type="info" showIcon title="The delivery time changed after the customer answered. Send the link again to confirm the new time."/>}
   </LinkCard>
   <LinkCard purpose="LOCATION" detail={detail} note={note} act={act} blocked={blocked} onShared={setShared} status={c.locationSharedAtUtc?<Tag color="green">Shared</Tag>:<Tag color="gold">Awaiting customer</Tag>}>
    <Fact label="Delivery address" value={note.address??'—'}/>
    <Fact label="GPS location" value={gps?<a href={mapsUrl(note.address??'',c.latitude,c.longitude)} target="_blank" rel="noopener noreferrer">{c.latitude!.toFixed(6)}, {c.longitude!.toFixed(6)}</a>:'Not shared'}/>
    {c.locationNotes&&<Fact label="Directions" value={c.locationNotes}/>}
    {c.locationSharedAtUtc&&<Fact label="Shared" value={when(c.locationSharedAtUtc)}/>}
    <Button size="small" icon={<EnvironmentOutlined/>} disabled={!note.address&&!gps} onClick={()=>window.open(mapsUrl(note.address??'',c.latitude,c.longitude),'_blank','noopener')}>Open in Maps</Button>
   </LinkCard>
  </div>
  <Modal centered open={Boolean(shared)} title={shared?'Share · '+LINKS[shared.purpose].title:''} footer={null} onCancel={()=>setShared(undefined)}>
   <Input.TextArea value={shared?.url} readOnly autoSize={{minRows:2,maxRows:3}}/>
   <p className="packing-customer-meta" style={{marginTop:10}}>This link is shown only now. Creating a new one replaces it.</p>
   <div className="survey-share-actions">
    <Tooltip title={note.phone?undefined:'Add the receiver phone first'}><Button className="share-whatsapp" icon={<WhatsAppOutlined/>} disabled={!note.phone} onClick={()=>window.open('https://wa.me/'+(note.phone??'').replace(/\D/g,'')+'?text='+encodeURIComponent(text),'_blank','noopener')}>WhatsApp</Button></Tooltip>
    <Button icon={<CopyOutlined/>} onClick={()=>{void navigator.clipboard.writeText(text);message.success('Message with link copied')}}>Copy message</Button>
    <Button icon={<LinkOutlined/>} onClick={()=>{void navigator.clipboard.writeText(shared?.url??'');message.success('Link copied')}}>Copy link</Button>
   </div>
  </Modal>
 </Modal>
}

function Fact({label,value}:{label:string;value:ReactNode}){return <div className="packing-customer-fact"><dt>{label}</dt><dd>{value}</dd></div>}

/** One link: its status and details, and the controls to create, renew or revoke it. */
function LinkCard({purpose,detail,note,act,blocked,onShared,status,children}:{purpose:DeliveryLinkPurpose;detail:DeliveryDetail;note:DeliveryNote;act:Act;blocked?:string;onShared:(v:{purpose:DeliveryLinkPurpose;url:string})=>void;status:ReactNode;children:ReactNode}){
 const meta=LINKS[purpose],j=detail.job,link=note.customer.links.find(l=>l.purpose===purpose)
 const [days,setDays]=useState(7),[busy,setBusy]=useState(false)
 const create=async()=>{
  setBusy(true)
  try{const r=await deliveryApi.createLink(j.id,note.id,purpose,days);onShared({purpose,url:r.url});await act(()=>deliveryApi.get(j.id))}
  catch(e){message.error(e instanceof Error?e.message:'Unable to create the link')}finally{setBusy(false)}
 }
 return <Card className={'packing-link-card packing-link-'+(purpose==='SCHEDULE'?'schedule':'location')} title={<span className="packing-link-title"><span className="packing-link-icon">{meta.icon}</span>{meta.title}</span>} extra={status}>
  <p className="packing-customer-meta">{meta.help}</p>
  <dl className="packing-customer-facts">{children}</dl>
  <div className="packing-link-footer">
   <div className="packing-link-state"><LinkOutlined/>{link?<span>Link active until <strong>{when(link.expiresAtUtc)}</strong></span>:<span>No link sent</span>}</div>
   <div className="packing-link-actions">
    <Select size="small" value={days} onChange={setDays} style={{width:110}} options={[1,3,7,14,30].map(d=>({value:d,label:d+(d===1?' day':' days')}))} aria-label="Link validity"/>
    <Tooltip title={blocked}><Button size="small" type="primary" icon={<LinkOutlined/>} loading={busy} disabled={Boolean(blocked)} onClick={()=>void create()}>{link?'New link':'Create link'}</Button></Tooltip>
    {link&&<Popconfirm title={'Revoke the '+meta.title.toLowerCase()+' link?'} description="The customer will no longer be able to open it." okButtonProps={{danger:true}} onConfirm={()=>void act(()=>deliveryApi.revokeLink(j.id,note.id,purpose),'Link revoked')}><Button size="small" danger icon={<StopOutlined/>}>Revoke</Button></Popconfirm>}
   </div>
  </div>
 </Card>
}
